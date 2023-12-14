import { ContractId, Party } from "@daml/types";
import * as V4 from "@daml.js/daml-chat/lib/Chat/V4";
import Ledger, { PartyInfo } from "@daml/ledger";

export interface Chat {
  contractId: ContractId<V4.Chat>;
  chatId: string;
  chatMessages: Message[];
  chatCreator: Party;
  chatMembers: Party[];
  chatName: string | null;
  chatTopic: string;
  isPublic: boolean;
  hasNewMessage?: boolean;
}

export interface Message extends V4.Message {
  contractId: ContractId<V4.Message>;
}

export interface User extends V4.User {
  contractId: ContractId<V4.User>;
}

export interface Aliases {
  [user: Party]: string;
}

function parseJwt(token: string): any {
  var base64Url = token.split(".")[1];
  var base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  var jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join(""),
  );

  return JSON.parse(jsonPayload);
}

function parseUserName(token: string): string {
  const sub = parseJwt(token)["sub"];
  const startChar = sub.indexOf("|");
  const endChar = sub.indexOf("@");
  const userNameLength = endChar - startChar - 1;

  return userNameLength > 0 ? sub.substr(startChar + 1, userNameLength) : sub;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ChatManager {
  fetchUpdate(): Promise<void>;
  acceptInvitation(userInvitation: {
    contractId: ContractId<V4.UserInvitation>;
  }): Promise<void>;
  sendMessage(
    user: { user: string },
    chat: { contractId: ContractId<V4.Chat> },
    message: string,
  ): Promise<void>;
  requestPrivateChat(
    user: { contractId: ContractId<V4.User> },
    name: string,
    members: Party[],
    topic: string,
  ): Promise<void>;
  requestPublicChat(
    user: { contractId: ContractId<V4.User> },
    name: string,
    topic: string,
  ): Promise<void>;
  addMembersToChat(
    user: { user: Party },
    chat: { contractId: ContractId<V4.Chat> },
    newMembers: Party[],
  ): Promise<void>;
  removeMembersFromChat(
    user: { user: Party },
    chat: { contractId: ContractId<V4.Chat> },
    membersToRemove: Party[],
  ): Promise<void>;
  updateSelfAlias(
    user: { contractId: ContractId<V4.User> },
    alias: string,
  ): Promise<void>;
  upsertToAddressBook(
    user: { user: V4.AddressBook.Key },
    party: Party,
    name: string,
  ): Promise<void>;
  removeFromAddressBook(
    user: { user: V4.AddressBook.Key },
    party: Party,
  ): Promise<void>;
  requestUserList(user: { contractId: ContractId<V4.User> }): Promise<void>;
  renameChat(
    chat: { contractId: ContractId<V4.Chat> },
    newName: string,
    newTopic: string,
  ): Promise<void>;
  archiveChat(chat: { contractId: ContractId<V4.Chat> }): Promise<void>;
  forwardToSlack(
    chat: { contractId: ContractId<V4.Chat> },
    slackChannelId: string,
  ): Promise<void>;
  archiveBotRequest(
    user: { contractId: ContractId<V4.User> },
    botName: string,
    enabled: boolean,
    message?: string | null,
  ): Promise<void>;
  updateUserSettings(
    user: { contractId: ContractId<V4.User> },
    timedelta: V4.Duration,
  ): Promise<void>;
}

async function ChatManager(
  party: string,
  token: string,
  updateUser: (user: User, onboarded: boolean) => void,
  updateState: (user: User, model: Chat[], aliases: Aliases) => void,
): Promise<ChatManager> {
  const ledger = new Ledger({ token });

  const fetchPublicToken = async () => {
    const response = await fetch("/.hub/v1/public/token", { method: "POST" });
    const jsonResp = await response.json();
    return jsonResp["access_token"];
  };

  const getDefaultParties = async () => {
    const response = await fetch("/.hub/v1/default-parties");
    const jsonResp: { result: PartyInfo[] } = await response.json();

    const publicPartyResponse = jsonResp.result.find(
      (p) => p.displayName === "Public",
    );
    const userAdminPartyResponse = jsonResp.result.find(
      (p) => p.displayName === "UserAdmin",
    );
    if (!publicPartyResponse) {
      throw new Error("response missing Public party");
    }
    if (!userAdminPartyResponse) {
      throw new Error("response missing UserAdmin party");
    }

    return {
      publicParty: publicPartyResponse.identifier,
      userAdminParty: userAdminPartyResponse.identifier,
    };
  };

  const createUserAccountRequest = async (
    operator: string,
    userName: string,
  ) => {
    await ledger.create(V4.UserAccountRequest, {
      operator,
      user: party,
      userName,
    });
  };

  const parties = await getDefaultParties();
  const operatorId = parties["userAdminParty"];
  localStorage.setItem("public.party", parties["publicParty"]);

  const publicToken = await fetchPublicToken();
  localStorage.setItem("public.token", publicToken);
  const ledgerPublic = new Ledger({ token: publicToken });

  const userName = parseUserName(token);
  await createUserAccountRequest(operatorId, userName);

  try {
    // Make MAX_ATTEMPTS to fetch the user or their invitation
    let user = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    while (!user && attempts < MAX_ATTEMPTS) {
      const userContracts = await ledger.query(V4.User);
      const userInvitationContracts = await ledger.query(V4.UserInvitation);

      if (userContracts.length) {
        user = userContracts[0];
      } else if (userInvitationContracts.length) {
        user = userInvitationContracts[0];
      } else {
        attempts += 1;
        await sleep(2000);
      }
    }

    if (!user) {
      throw new Error(`Cannot onboard user ${party} to this app!`);
    }

    const onboarded = user.templateId.endsWith(V4.User.templateId);

    updateUser(
      Object.assign({}, { ...user.payload, contractId: user.contractId }),
      onboarded,
    );
  } catch (e) {
    console.error(e);
  }

  const fetchUpdate = async () => {
    try {
      const userMessages = await ledger.query(V4.Message);
      const userMessageContractIds = userMessages.map((u) => u.contractId);

      const publicMessages = (await ledgerPublic.query(V4.Message)).filter(
        (m) => !userMessageContractIds.includes(m.contractId),
      );

      const chats = await ledger.query(V4.Chat);
      const user = (await ledger.query(V4.User))[0];
      const selfAlias = (await ledger.query(V4.SelfAlias))[0];
      const addressBook = (await ledger.query(V4.AddressBook))[0];

      const model: Chat[] = chats
        .sort((c1, c2) => c1.payload.name.localeCompare(c2.payload.name))
        .map((c) => {
          const messages = c.payload.isPublic
            ? userMessages.concat(publicMessages)
            : userMessages;
          const chatMessages = messages
            .filter((m) => m.payload.chatId === c.payload.chatId)
            .sort((m1, m2) => m1.payload.postedAt.localeCompare(m2.payload.postedAt))
            .map((m) =>
              Object.assign({}, { ...m.payload, contractId: m.contractId }),
            );
          return {
            contractId: c.contractId,
            chatId: c.payload.chatId,
            chatMessages,
            chatCreator: c.payload.creator,
            chatMembers: c.payload.members,
            chatName: c.payload.name,
            chatTopic: c.payload.topic || "",
            isPublic: c.payload.isPublic,
          };
        });

      const selfAliases = await ledgerPublic.query(V4.SelfAlias);

      const publicAliases: Aliases = selfAliases.reduce((acc, curr) => {
        acc[curr.payload.user] = curr.payload.alias;
        return acc;
      }, {} as Aliases);

      let aliases = Object.assign(
        {},
        publicAliases,
        addressBook.payload.contacts,
      );
      if (selfAlias) {
        aliases[selfAlias.payload.user] = selfAlias.payload.alias;
      }

      updateState(
        Object.assign({}, { ...user.payload, contractId: user.contractId }),
        model,
        aliases,
      );
    } catch (e) {
      console.error("Could not fetch contracts!", e);
    }
  };

  const archiveBotRequest = async (
    user: { contractId: ContractId<V4.User> },
    botName: string,
    enabled: boolean,
    message: string,
  ) => {
    await ledger.exercise(V4.User.User_RequestArchiveBot, user.contractId, {
      botName,
      enabled,
      message,
    });
  };

  const updateUserSettings = async (
    user: { contractId: ContractId<V4.User> },
    newArchiveMessagesAfter: V4.Duration,
  ) => {
    await ledger.exercise(V4.User.User_UpdateUserSettings, user.contractId, {
      newArchiveMessagesAfter,
    });
  };

  const acceptInvitation = async (userInvitation: {
    contractId: ContractId<V4.UserInvitation>;
  }) => {
    await ledger.exercise(
      V4.UserInvitation.UserInvitation_Accept,
      userInvitation.contractId,
      {},
    );
  };

  const sendMessage = async (
    user: { user: string },
    chat: { contractId: ContractId<V4.Chat> },
    message: string,
  ) => {
    const d = new Date();
    const seconds = Math.round(d.getTime() / 1000);
    await ledger.exercise(V4.Chat.Chat_PostMessage, chat.contractId, {
      poster: user.user,
      message,
      postedAt: seconds.toString(),
    });
  };

  const requestPrivateChat = async (
    user: { contractId: ContractId<V4.User> },
    name: string,
    members: Party[],
    topic: string,
  ) => {
    await ledger.exercise(V4.User.User_RequestPrivateChat, user.contractId, {
      name,
      members,
      topic,
    });
  };

  const requestPublicChat = async (
    user: { contractId: ContractId<V4.User> },
    name: string,
    topic: string,
  ) => {
    await ledger.exercise(V4.User.User_RequestPublicChat, user.contractId, {
      name,
      topic,
    });
  };

  const addMembersToChat = async (
    user: { user: Party },
    chat: { contractId: ContractId<V4.Chat> },
    newMembers: Party[],
  ) => {
    await ledger.exercise(V4.Chat.Chat_AddMembers, chat.contractId, {
      member: user.user,
      newMembers: newMembers,
    });
  };

  const removeMembersFromChat = async (
    user: { user: Party },
    chat: { contractId: ContractId<V4.Chat> },
    membersToRemove: Party[],
  ) => {
    await ledger.exercise(V4.Chat.Chat_RemoveMembers, chat.contractId, {
      member: user.user,
      membersToRemove: membersToRemove,
    });
  };

  const updateSelfAlias = async (
    user: { contractId: ContractId<V4.User> },
    alias: string,
  ) => {
    await ledger.exercise(V4.User.User_UpdateSelfAlias, user.contractId, {
      alias,
    });
  };

  const upsertToAddressBook = async (
    user: { user: V4.AddressBook.Key },
    party: Party,
    name: string,
  ) => {
    await ledger.exerciseByKey(V4.AddressBook.AddressBook_Add, user.user, {
      party,
      name,
    });
  };

  const removeFromAddressBook = async (
    user: { user: V4.AddressBook.Key },
    party: Party,
  ) => {
    await ledger.exerciseByKey(V4.AddressBook.AddressBook_Remove, user.user, {
      party,
    });
  };

  const requestUserList = async (user: { contractId: ContractId<V4.User> }) => {
    await ledger.exercise(V4.User.User_RequestAliases, user.contractId, {});
  };

  const renameChat = async (
    chat: { contractId: ContractId<V4.Chat> },
    newName: string,
    newTopic: string,
  ) => {
    await ledger.exercise(V4.Chat.Chat_Rename, chat.contractId, {
      newName,
      newTopic,
    });
  };

  const archiveChat = async (chat: { contractId: ContractId<V4.Chat> }) => {
    await ledger.exercise(V4.Chat.Chat_Archive, chat.contractId, {});
  };

  const forwardToSlack = async (
    chat: { contractId: ContractId<V4.Chat> },
    slackChannelId: string,
  ) => {
    await ledger.exercise(V4.Chat.Chat_ForwardToSlack, chat.contractId, {
      slackChannelId,
    });
  };

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
    archiveBotRequest,
    updateUserSettings,
  };
}

export default ChatManager;
