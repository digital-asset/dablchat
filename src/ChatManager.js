
function parseJwt(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
};

function parseUserName(token) {
  const sub = parseJwt(token)['sub']
  const startChar = sub.indexOf('|');
  const endChar = sub.indexOf('@');
  const userNameLength = endChar - startChar - 1;

  return userNameLength > 0 ? sub.substr(startChar + 1, userNameLength) : sub;
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ChatManager(party, token, updateUser, updateState) {

  const ADDRESS_BOOK_TEMPLATE = 'Chat.V3:AddressBook'
  const CHAT_TEMPLATE = 'Chat.V3:Chat'
  const MESSAGE_TEMPLATE = 'Chat.V3:Message'
  const SELF_ALIAS_TEMPLATE = 'Chat.V3:SelfAlias'
  const USER_TEMPLATE = 'Chat.V3:User'
  const USER_INVITATION_TEMPLATE = 'Chat.V3:UserInvitation'
  const USER_ACCOUNT_REQUEST_TEMPLATE = 'Chat.V3:UserAccountRequest'

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

  const post = (url, options = {}) => {
    Object.assign(options, { method: 'POST', headers });

    return fetch('//' + siteSubDomain() + url, options);
  }

  const fetchPublicToken = async () => {
    const response = await fetch('//' + siteSubDomain() + '/.hub/v1/public/token', { method: 'POST' });
    const jsonResp = await response.json();
    const accessToken = jsonResp['access_token'];
    return accessToken;
  }

  const getWellKnownParties = async () => {
    const url = window.location.host
    const response = await fetch('//' + url + '/.well-known/dabl.json');
    const dablJson = await response.json();
    return dablJson
  }

  const createUserAccountRequest = async (operator, userName) => {
    return post('/v1/create', {
      body: JSON.stringify({
        templateId: USER_ACCOUNT_REQUEST_TEMPLATE,
        payload: {
          operator,
          user: party,
          userName
        }
      })
    })
  }

  const parties = await getWellKnownParties();
  const operatorId = localStorage.getItem("operator.id") || parties['userAdminParty'];
  localStorage.setItem("operator.id", operatorId)
  localStorage.setItem("public.party", parties['publicParty']);

  const publicToken = await fetchPublicToken();
  localStorage.setItem("public.token", publicToken);

  const publicHeaders = {
    "Authorization": `Bearer ${publicToken.toString()}`,
    'Content-Type': 'application/json'
  }

  const postPublic = (url, options = {}) => {
    Object.assign(options, { method: 'POST', headers: publicHeaders });
    return fetch('//' + siteSubDomain() + url, options);
  }

  const getPublic = (url, options = {}) => {
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
        body: JSON.stringify({ 'templateIds': [ USER_TEMPLATE, USER_INVITATION_TEMPLATE ]})
      })
      const userContracts = await userContractsResponse.json();

      user = userContracts.result.find(u => u.templateId.endsWith(USER_TEMPLATE))
        || userContracts.result.find(ui => ui.templateId.endsWith(USER_INVITATION_TEMPLATE));

      if (!user) {
        attempts += 1
        await sleep(2000);
      }
    }

    if (!user) {
      throw new Error(`Cannot onboard user ${party} to this app!`)
    }

    const onboarded = user.templateId.endsWith(USER_TEMPLATE);

    updateUser(Object.assign({}, {...user.payload, contractId: user.contractId}), onboarded);
  } catch(e) {
    console.error(e)
  }

  const fetchUpdate = async () => {
    try {
      const allContractsResponse = await post('/v1/query', {
        body: JSON.stringify({ 'templateIds': [
          CHAT_TEMPLATE,
          MESSAGE_TEMPLATE,
          USER_TEMPLATE,
          ADDRESS_BOOK_TEMPLATE,
          SELF_ALIAS_TEMPLATE
        ] })
      });

      const allPublicContractsResponse = await postPublic('/v1/query', {
        body: JSON.stringify({ 'templateIds': [
          SELF_ALIAS_TEMPLATE,
          MESSAGE_TEMPLATE
        ] })
      });

      const allContracts = await allContractsResponse.json();
      const allPublicContracts = await allPublicContractsResponse.json();

      const userMessages = allContracts.result.filter(m => m.templateId.endsWith(MESSAGE_TEMPLATE));
      const userMessageContractIds = userMessages.map(u => u.contractId)

      const publicMessages = allPublicContracts.result
        .filter(m => m.templateId.endsWith(MESSAGE_TEMPLATE) && !userMessageContractIds.includes(m.contractId))

      const chats = allContracts.result.filter(c => c.templateId.endsWith(CHAT_TEMPLATE));
      const user = allContracts.result.find(u => u.templateId.endsWith(USER_TEMPLATE));
      const selfAlias = allContracts.result.find(ma => ma.templateId.endsWith(SELF_ALIAS_TEMPLATE));
      const addressBook = allContracts.result.find(ma => ma.templateId.endsWith(ADDRESS_BOOK_TEMPLATE));

      const model = chats
        .sort((c1, c2) => c1.payload.name > c2.payload.name ? 1 : c1.payload.name < c2.payload.name ? -1 : 0)
        .map(c => {
          const messages = c.payload.isPublic ? userMessages.concat(publicMessages) : userMessages
          const chatMessages = messages.filter(m => m.payload.chatId === c.payload.chatId)
            .sort((m1, m2) => m1.payload.postedAt > m2.payload.postedAt ? 1 : m1.payload.postedAt < m2.payload.postedAt ? -1 : 0)
            .map(m => Object.assign({}, {...m.payload, contractId: m.contractId}));
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

      const selfAliases = allPublicContracts.result.filter(ma => ma.templateId.endsWith(SELF_ALIAS_TEMPLATE));

      const publicAliases = selfAliases.reduce((acc, curr) => {
        acc[curr.payload.user] = curr.payload.alias;
        return acc;
      }, {});

      let aliases = Object.assign({}, publicAliases, addressBook.payload.contacts.textMap);
      if (selfAlias) {
        aliases[selfAlias.payload.user] = selfAlias.payload.alias;
      }

      updateState(Object.assign({}, {...user.payload, contractId: user.contractId}), model, aliases);

    } catch (e) {
      console.error("Could not fetch contracts!", e)
    }
  }

  const getPublicAutomation = async () => {
    return getPublic('/.hub/v1/published')
  }

  const deployArchiveBot = async (owner, artifactHash) => {
    await post('/.hub/v1/published/deploy', {
      body: JSON.stringify({
        artifactHash: artifactHash,
        owner: owner
      })
    })
  }

  const undeployArchiveBot = async (artifactHash) => {
    await post('/.hub/v1/published/undeploy/' + artifactHash)
  }

  const archiveBotRequest = async (user, botName, enabled, message) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: USER_TEMPLATE,
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

  const updateUserSettings = async (user, timedelta) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: USER_TEMPLATE,
        contractId: user.contractId,
        choice: 'User_UpdateUserSettings',
        argument: {
          newArchiveMessagesAfter: timedelta,
        }
      })
    })
  }


  const acceptInvitation = async (userInvitation) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: USER_INVITATION_TEMPLATE,
        contractId: userInvitation.contractId,
        choice: 'UserInvitation_Accept',
        argument: {}
      })
    })
  }

  const sendMessage = async (user, chat, message) => {
    const d = new Date();
    const seconds = Math.round(d.getTime() / 1000);
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: CHAT_TEMPLATE,
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

  const requestPrivateChat = async (user, name, members, topic) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: USER_TEMPLATE,
        contractId: user.contractId,
        choice: 'User_RequestPrivateChat',
        argument: {
          name : name,
          members : members,
          topic : topic
        }
      })
    })
  }

  const requestPublicChat = async (user, name, topic) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: USER_TEMPLATE,
        contractId: user.contractId,
        choice: 'User_RequestPublicChat',
        argument: {
          name : name,
          topic : topic
        }
      })
    })
  }

  const addMembersToChat = async (user, chat, newMembers) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: CHAT_TEMPLATE,
        contractId: chat.contractId,
        choice: 'Chat_AddMembers',
        argument: {
          member: user.user,
          newMembers: newMembers
        }
      })
    })
  }

  const removeMembersFromChat = async (user, chat, membersToRemove) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: CHAT_TEMPLATE,
        contractId: chat.contractId,
        choice: 'Chat_RemoveMembers',
        argument: {
          member: user.user,
          membersToRemove: membersToRemove
        }
      })
    })
  }

  const updateSelfAlias = async (user, alias) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: USER_TEMPLATE,
        contractId: user.contractId,
        choice: 'User_UpdateSelfAlias',
        argument: {
          alias
        }
      })
    })
  }

  const upsertToAddressBook = async (user, party, name) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: ADDRESS_BOOK_TEMPLATE,
        key: user.user,
        choice: 'AddressBook_Add',
        argument: {
          party,
          name
        }
      })
    })
  }

  const removeFromAddressBook = async (user, party) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: ADDRESS_BOOK_TEMPLATE,
        key: user.user,
        choice: 'AddressBook_Remove',
        argument: {
          party
        }
      })
    })
  }

  const requestUserList = async (user) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: USER_TEMPLATE,
        contractId: user.contractId,
        choice: 'User_RequestAliases',
        argument: {}
      })
    })
  }

  const renameChat = async (chat, newName, newTopic) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: CHAT_TEMPLATE,
        contractId: chat.contractId,
        choice: 'Chat_Rename',
        argument: {
          newName: newName,
          newTopic: newTopic
        }
      })
    })
  }

  const archiveChat = async (chat) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: CHAT_TEMPLATE,
        contractId: chat.contractId,
        choice: 'Chat_Archive',
        argument: {}
      })
    })
  }

  const forwardToSlack = async (chat, slackChannelId) => {
    await post('/v1/exercise', {
      body: JSON.stringify({
        templateId: CHAT_TEMPLATE,
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
