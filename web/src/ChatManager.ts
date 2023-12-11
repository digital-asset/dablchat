import { ContractId, Party } from "@daml/types";
import * as V4 from "@daml.js/daml-chat/lib/Chat/V4";

export interface Chat {
  contractId: ContractId<V4.Chat>,
  chatId: string
  chatMessages: Message[]
  chatCreator: Party,
  chatMembers: Party[]
  chatName: string | null
  chatTopic: string
  isPublic: boolean
  hasNewMessage?: boolean
}

export interface Message extends V4.Message {
  contractId: ContractId<V4.Message>
}

export interface User extends V4.User {
  contractId: ContractId<V4.User>
}

export interface Aliases {
  [user: Party]: string
}

function parseJwt(token: string): any {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
};

function parseUserName(token: string): string {
  const sub = parseJwt(token)['sub']
  const startChar = sub.indexOf('|');
  const endChar = sub.indexOf('@');
  const userNameLength = endChar - startChar - 1;

  return userNameLength > 0 ? sub.substr(startChar + 1, userNameLength) : sub;
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface ChatManager {
  fetchUpdate(): Promise<void>
  acceptInvitation(userInvitation: { contractId: ContractId<V4.UserInvitation> }): Promise<void>
  sendMessage(user: { user: string }, chat: { contractId: ContractId<V4.Chat> }, message: string): Promise<void>
  requestPrivateChat(user: { contractId: ContractId<V4.User> }, name: string, members: Party[], topic: string): Promise<void>
  requestPublicChat(user: { contractId: ContractId<V4.User> }, name: string, topic: string): Promise<void>
  addMembersToChat(user: { user: Party }, chat: { contractId: ContractId<V4.Chat> }, newMembers: Party[]): Promise<void>
  removeMembersFromChat(user: { user: Party }, chat: { contractId: ContractId<V4.Chat> }, membersToRemove: Party[]): Promise<void>
  updateSelfAlias(user: { contractId: ContractId<V4.User> }, alias: string): Promise<void>
  upsertToAddressBook(user: { user: V4.AddressBook.Key }, party: Party, name: string): Promise<void>
  removeFromAddressBook(user: { user: V4.AddressBook.Key }, party: Party): Promise<void>
  requestUserList(user: { contractId: ContractId<V4.User> }): Promise<void>
  renameChat(chat: { contractId: ContractId<V4.Chat> }, newName: string, newTopic: string): Promise<void>
  archiveChat(chat: { contractId: ContractId<V4.Chat> }): Promise<void>
  forwardToSlack(chat: { contractId: ContractId<V4.Chat> }, slackChannelId: string): Promise<void>
  getPublicAutomation(): Promise<any>
  deployArchiveBot(owner: string, artifactHash: string): Promise<void>
  archiveBotRequest(user: { contractId: ContractId<V4.User> }, botName: string, enabled: boolean, message?: string | null): Promise<void>
  undeployArchiveBot(artifactHash: string): Promise<void>
  updateUserSettings(user: { contractId: ContractId<V4.User> }, timedelta: V4.Duration): Promise<void>
}

async function ChatManager(party: string, token: string, updateUser: (user: User, onboarded: boolean) => void, updateState: (user: User, model: Chat[], aliases: Aliases) => void): Promise<ChatManager> {

  const headers = {
    "Authorization": `Bearer ${token.toString()}`,
    'Content-Type': 'application/json'
  }

  const siteSubDomain = () => {
    if (window.location.hostname === 'localhost') {
      return window.location.hostname + (window.location.port ? ':' + window.location.port : '');
    }
    return window.location.host;
  }

  const post = (url: string, options = {}) => {
    Object.assign(options, { method: 'POST', headers });

    return fetch('//' + siteSubDomain() + url, options);
  }

  const fetchPublicToken = async () => {
    const response = await fetch('//' + siteSubDomain() + '/.hub/v1/public/token', { method: 'POST' });
    const jsonResp = await response.json();
    const accessToken = jsonResp['access_token'];
    return accessToken;
  }

  const getDefaultParties = async () => {
    const url = window.location.host;
    const response = await fetch('//' + url + '/.hub/v1/default-parties');
    const jsonResp: any = await response.json();

    const publicPartyResponse = jsonResp["result"].find((p: any) => p["displayName"] === "Public");
    const userAdminPartyResponse = jsonResp["result"].find((p: any) => p["displayName"] === "UserAdmin");
    if (!publicPartyResponse) {
      throw new Error("response missing Public party")
    }
    if (!userAdminPartyResponse) {
      throw new Error("response missing UserAdmin party")
    }

    return {
      publicParty: publicPartyResponse["identifier"],
      userAdminParty: userAdminPartyResponse["identifier"]
    }
  }

  const createUserAccountRequest = async (operator: string, userName: string) => {
    return post('/v1/create', {
      body: JSON.stringify({
        templateId: V4.UserAccountRequest.templateId,
        payload: {
          operator,
          user: party,
          userName
        }
      })
    })
  }

  const parties = await getDefaultParties();
  const operatorId = localStorage.getItem("operator.id") || parties['userAdminParty'];
  localStorage.setItem("operator.id", operatorId)
  localStorage.setItem("public.party", parties['publicParty']);

  const publicToken = await fetchPublicToken();
  localStorage.setItem("public.token", publicToken);

  const publicHeaders = {
    "Authorization": `Bearer ${publicToken.toString()}`,
    'Content-Type': 'application/json'
  }

  const postPublic = (url: string, options = {}) => {
    Object.assign(options, { method: 'POST', headers: publicHeaders });
    return fetch('//' + siteSubDomain() + url, options);
  }

  const getPublic = (url: string, options = {}) => {
    Object.assign(options, { method: 'GET', headers: publicHeaders });
    return fetch('//' + siteSubDomain() + url, options);
  }

  const userName = parseUserName(token)
  const createUserAccountRequestResponse = await createUserAccountRequest(operatorId, userName);

  switch (createUserAccountRequestResponse.status) {
    case 401:
      throw new Error("Authentication failed")
    case 404:
      throw new Error("HTTP JSON failed")
    case 500:
      throw new Error("Internal Server Error")
    default:
  }

  try {
    // Make MAX_ATTEMPTS to fetch the user or their invitation
    let user = null
    let attempts = 0
    const MAX_ATTEMPTS = 3
    while (!user && attempts < MAX_ATTEMPTS) {
      const userContractsResponse = await post('/v1/query', {
        body: JSON.stringify({ 'templateIds': [V4.User.templateId, V4.UserInvitation.templateId] })
      })
      const userContracts = await userContractsResponse.json();

      user = userContracts.result.find((u: any) => u.templateId.endsWith(V4.User.templateId))
        || userContracts.result.find((ui: any) => ui.templateId.endsWith(V4.UserInvitation.templateId));

      if (!user) {
        attempts += 1
        await sleep(2000);
      }
    }

    if (!user) {
      throw new Error(`Cannot onboard user ${party} to this app!`)
    }

    const onboarded = user.templateId.endsWith(V4.User.templateId);

    updateUser(Object.assign({}, { ...user.payload, contractId: user.contractId }), onboarded);
  } catch (e) {
    console.error(e)
  }

  const fetchUpdate = async () => {
    try {
      const allContractsResponse = await post('/v1/query', {
        body: JSON.stringify({
          'templateIds': [
            V4.Chat.templateId,
            V4.Message.templateId,
            V4.User.templateId,
            V4.AddressBook.templateId,
            V4.SelfAlias.templateId,
          ]
        })
      });

      const allPublicContractsResponse = await postPublic('/v1/query', {
        body: JSON.stringify({
          'templateIds': [
            V4.SelfAlias.templateId,
            V4.Message.templateId,
          ]
        })
      });

      const allContracts = await allContractsResponse.json();
      const allPublicContracts = await allPublicContractsResponse.json();

      const userMessages = allContracts.result.filter((m: any) => m.templateId.endsWith(V4.Message.templateId));
      const userMessageContractIds = userMessages.map((u: any) => u.contractId)

      const publicMessages = allPublicContracts.result
        .filter((m: any) => m.templateId.endsWith(V4.Message.templateId) && !userMessageContractIds.includes(m.contractId))

      const chats = allContracts.result.filter((c: any) => c.templateId.endsWith(V4.Chat.templateId));
      const user = allContracts.result.find((u: any) => u.templateId.endsWith(V4.User.templateId));
      const selfAlias = allContracts.result.find((ma: any) => ma.templateId.endsWith(V4.SelfAlias.templateId));
      const addressBook = allContracts.result.find((ma: any) => ma.templateId.endsWith(V4.AddressBook.templateId));

      const model: Chat[] = chats
        .sort((c1: any, c2: any) => c1.payload.name > c2.payload.name ? 1 : c1.payload.name < c2.payload.name ? -1 : 0)
        .map((c: any) => {
          const messages = c.payload.isPublic ? userMessages.concat(publicMessages) : userMessages
          const chatMessages = messages.filter((m: any) => m.payload.chatId === c.payload.chatId)
            .sort((m1: any, m2: any) => m1.payload.postedAt > m2.payload.postedAt ? 1 : m1.payload.postedAt < m2.payload.postedAt ? -1 : 0)
            .map((m: any) => Object.assign({}, { ...m.payload, contractId: m.contractId }));
          return {
            contractId: c.contractId,
            chatId: c.payload.chatId,
            chatMessages,
            chatCreator: c.payload.creator,
            chatMembers: c.payload.members,
            chatName: c.payload.name,
            chatTopic: c.payload.topic || '',
            isPublic: c.payload.isPublic
          };
        });

      const selfAliases = allPublicContracts.result.filter((ma: any) => ma.templateId.endsWith(V4.SelfAlias.templateId));

      const publicAliases = selfAliases.reduce((acc: any, curr: any) => {
        acc[curr.payload.user] = curr.payload.alias;
        return acc;
      }, {});

      let aliases = Object.assign({}, publicAliases, addressBook.payload.contacts.textMap);
      if (selfAlias) {
        aliases[selfAlias.payload.user] = selfAlias.payload.alias;
      }

      updateState(Object.assign({}, { ...user.payload, contractId: user.contractId }), model, aliases);

    } catch (e) {
      console.error("Could not fetch contracts!", e)
    }
  }

  const getPublicAutomation = async () => {
    return getPublic('/.hub/v1/published')
  }

  const deployArchiveBot = async (owner: string, artifactHash: string) => {
    await post('/.hub/v1/published/deploy', {
      body: JSON.stringify({
        artifactHash: artifactHash,
        owner: owner
      })
    })
  }

  const undeployArchiveBot = async (artifactHash: string) => {
    await post('/.hub/v1/published/undeploy/' + artifactHash)
  }

  const archiveBotRequest = async (user: { contractId: ContractId<V4.User> }, botName: string, enabled: boolean, message: string) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.User.templateId,
        contractId: user.contractId,
        choice: 'User_RequestArchiveBot',
        argument: {
          botName: botName,
          enabled: enabled,
          message: message
        }
      })
    })
  }

  const updateUserSettings = async (user: { contractId: ContractId<V4.User> }, timedelta: V4.Duration) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.User.templateId,
        contractId: user.contractId,
        choice: 'User_UpdateUserSettings',
        argument: {
          newArchiveMessagesAfter: timedelta,
        }
      })
    })
  }


  const acceptInvitation = async (userInvitation: { contractId: ContractId<V4.UserInvitation> }) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.UserInvitation,
        contractId: userInvitation.contractId,
        choice: 'UserInvitation_Accept',
        argument: {}
      })
    })
  }

  const sendMessage = async (user: { user: string }, chat: { contractId: ContractId<V4.Chat> }, message: string) => {
    const d = new Date();
    const seconds = Math.round(d.getTime() / 1000);
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.Chat.templateId,
        contractId: chat.contractId,
        choice: 'Chat_PostMessage',
        argument: {
          poster: user.user,
          message: message,
          postedAt: seconds
        }
      })
    })
  }

  const requestPrivateChat = async (user: { contractId: ContractId<V4.User> }, name: string, members: Party[], topic: string) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.User.templateId,
        contractId: user.contractId,
        choice: 'User_RequestPrivateChat',
        argument: {
          name: name,
          members: members,
          topic: topic
        }
      })
    })
  }

  const requestPublicChat = async (user: { contractId: ContractId<V4.User> }, name: string, topic: string) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.User.templateId,
        contractId: user.contractId,
        choice: 'User_RequestPublicChat',
        argument: {
          name: name,
          topic: topic
        }
      })
    })
  }

  const addMembersToChat = async (user: { user: Party }, chat: { contractId: ContractId<V4.Chat> }, newMembers: Party[]) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.Chat.templateId,
        contractId: chat.contractId,
        choice: 'Chat_AddMembers',
        argument: {
          member: user.user,
          newMembers: newMembers
        }
      })
    })
  }

  const removeMembersFromChat = async (user: { user: Party }, chat: { contractId: ContractId<V4.Chat> }, membersToRemove: Party[]) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.Chat.templateId,
        contractId: chat.contractId,
        choice: 'Chat_RemoveMembers',
        argument: {
          member: user.user,
          membersToRemove: membersToRemove
        }
      })
    })
  }

  const updateSelfAlias = async (user: { contractId: ContractId<V4.User> }, alias: string) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.User.templateId,
        contractId: user.contractId,
        choice: 'User_UpdateSelfAlias',
        argument: {
          alias
        }
      })
    })
  }

  const upsertToAddressBook = async (user: { user: V4.AddressBook.Key }, party: Party, name: string) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.AddressBook.templateId,
        key: user.user,
        choice: 'AddressBook_Add',
        argument: {
          party,
          name
        }
      })
    })
  }

  const removeFromAddressBook = async (user: { user: V4.AddressBook.Key }, party: Party) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.AddressBook.templateId,
        key: user.user,
        choice: 'AddressBook_Remove',
        argument: {
          party
        }
      })
    })
  }

  const requestUserList = async (user: { contractId: ContractId<V4.User> }) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.User.templateId,
        contractId: user.contractId,
        choice: 'User_RequestAliases',
        argument: {}
      })
    })
  }

  const renameChat = async (chat: { contractId: ContractId<V4.Chat> }, newName: string, newTopic: string) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.Chat.templateId,
        contractId: chat.contractId,
        choice: 'Chat_Rename',
        argument: {
          newName: newName,
          newTopic: newTopic
        }
      })
    })
  }

  const archiveChat = async (chat: { contractId: ContractId<V4.Chat> }) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.Chat.templateId,
        contractId: chat.contractId,
        choice: 'Chat_Archive',
        argument: {}
      })
    })
  }

  const forwardToSlack = async (chat: { contractId: ContractId<V4.Chat> }, slackChannelId: string) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: V4.Chat.templateId,
        contractId: chat.contractId,
        choice: 'Chat_ForwardToSlack',
        argument: {
          slackChannelId
        }
      })
    })
  }

  return {
    fetchUpdate,
    acceptInvitation,
    sendMessage,
    requestPrivateChat,
    requestPublicChat,
    addMembersToChat,
    removeMembersFromChat,
    updateSelfAlias,
    upsertToAddressBook,
    removeFromAddressBook,
    requestUserList,
    renameChat,
    archiveChat,
    forwardToSlack,
    getPublicAutomation,
    deployArchiveBot,
    archiveBotRequest,
    undeployArchiveBot,
    updateUserSettings
  }
}

export default ChatManager;
