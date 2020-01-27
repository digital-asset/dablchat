

async function ChatManager(party, token, updateUser, updateState) {

  const headers = {
    "Authorization": `Bearer ${token.toString()}`,
    'Content-Type': 'application/json'
  }

  const siteSubDomain = () => {
    if (window.location.hostname === 'localhost') {
        return window.location.hostname + (window.location.port ? ':' + window.location.port : '');
    }

    let host = window.location.host.split('.')
    const ledgerId = host[0];
    let apiUrl = host.slice(1)
    apiUrl.unshift('api')

    return apiUrl.join('.') + (window.location.port ? ':' + window.location.port : '') + '/data/' + ledgerId;
  }

  const post = (url, options = {}) => {
    Object.assign(options, { method: 'POST', headers });

    return fetch('//' + siteSubDomain() + url, options);
  }

  const ledgerPartyTemplate = { moduleName: 'DABL.Ledger.V2', entityName: 'LedgerParty' }
  const userTemplate = { moduleName: 'Chat', entityName: 'User' }
  const userInvitationTemplate = { moduleName: 'Chat', entityName: 'UserInvitation' }
  const chatTemplate = { moduleName: 'Chat', entityName: 'Chat' }
  const messageTemplate = { moduleName: 'Chat', entityName: 'Message' }
  const memberAliasTemplate = { moduleName: 'Chat', entityName: 'MemberAlias' }

  const userContractsResponse = await post('/contracts/search', {
    body: JSON.stringify({ '%templates': [ ledgerPartyTemplate, userTemplate, userInvitationTemplate ]})
  })

  switch (userContractsResponse.status) {
    case 401:
      throw new Error("Authentication failed")
    case 404:
      throw new Error("HTTP JSON failed")
    case 500:
      throw new Error("Internal Server Error")
    default:
  }

  const userContracts = await userContractsResponse.json();

  try {
    const ledgerParties = userContracts.result.filter(up =>
      up.templateId.moduleName === ledgerPartyTemplate.moduleName &&
      up.templateId.entityName === ledgerPartyTemplate.entityName);
    const users = userContracts.result.filter(u =>
      u.templateId.moduleName === userTemplate.moduleName &&
      u.templateId.entityName === userTemplate.entityName);
    const userInvites = userContracts.result.filter(ui =>
      ui.templateId.moduleName === userInvitationTemplate.moduleName &&
      ui.templateId.entityName === userInvitationTemplate.entityName);

    const ledgerParty = ledgerParties.find(lp => lp.argument.party === party)
    if (!ledgerParty) {
      throw new Error(`Could not match party ${party} to provided token!`)
    }

    const user = users.find(u => u.argument.user === ledgerParty.argument.party)
      || userInvites.find(ui => ui.argument.user === ledgerParty.argument.party);

    if (!user) {
      throw new Error(`User ${ledgerParty.argument.partyName} has not been onboarded to this app!`)
    }

    const onboarded = user.templateId.entityName === userTemplate.entityName;

    updateUser(ledgerParty.argument, Object.assign({}, {...user.argument, contractId: user.contractId}), onboarded);
  } catch(e) {
    console.error(e)
  }

  const fetchUpdate = async () => {
    try {
      const allContractsResponse = await post('/contracts/search', {
        body: JSON.stringify({ '%templates': [chatTemplate, messageTemplate, userTemplate, memberAliasTemplate] })
      })

      const allContracts = await allContractsResponse.json();

      const chats = allContracts.result.filter(cm =>
        cm.templateId.moduleName === chatTemplate.moduleName &&
        cm.templateId.entityName === chatTemplate.entityName);
      const messages = allContracts.result.filter(cm =>
        cm.templateId.moduleName === messageTemplate.moduleName &&
        cm.templateId.entityName === messageTemplate.entityName);
      const user = allContracts.result.find(cm =>
        cm.templateId.moduleName === userTemplate.moduleName &&
        cm.templateId.entityName === userTemplate.entityName);
      const memberAliases = allContracts.result.filter(cm =>
        cm.templateId.moduleName === memberAliasTemplate.moduleName &&
        cm.templateId.entityName === memberAliasTemplate.entityName);

      const model = chats
        .sort((c1, c2) => c1.argument.name > c2.argument.name ? 1 : c1.argument.name < c2.argument.name ? -1 : 0)
        .map(c => {
          const chatMessages = messages.filter(m => m.argument.chatId === c.argument.chatId)
            .sort((m1, m2) => m1.argument.postedAt > m2.argument.postedAt ? 1 : m1.argument.postedAt < m2.argument.postedAt ? -1 : 0)
            .map(m => Object.assign({}, {...m.argument, contractId: m.contractId}));
          return {
            contractId: c.contractId,
            chatId: c.argument.chatId,
            chatMessages,
            chatCreator: c.argument.creator,
            chatMembers: c.argument.members,
            chatName: c.argument.name,
            chatTopic: c.argument.topic || '',
            isPublic: c.argument.isPublic
          };
        });

      const aliases = {}
      memberAliases.forEach((c) => aliases[c.argument.member] = c.argument.alias)

      updateState(Object.assign({}, {...user.argument, contractId: user.contractId}), model, aliases);

    } catch (e) {
      console.error("Could not fetch contracts!", e)
    }
  }

  const acceptInvitation = async (userInvitation) => {
    await post('/command/exercise', {
      body: JSON.stringify({
        templateId: userInvitationTemplate,
        contractId: userInvitation.contractId,
        choice: 'UserInvitationAccept',
        argument: {}
      })
    })
  }

  const sendMessage = async (user, chat, message) => {
    const d = new Date();
    const seconds = Math.round(d.getTime() / 1000);
    await post('/command/exercise', {
      body: JSON.stringify({
        templateId: chatTemplate,
        contractId: chat.contractId,
        choice: 'ChatPostMessage',
        argument: {
          poster: user.user,
          message: message,
          postedAt: seconds.toString()
        }
      })
    })
  }

  const requestPrivateChat = async (user, name, members, topic) => {
    await post('/command/exercise', {
      body: JSON.stringify({
        templateId: userTemplate,
        contractId: user.contractId,
        choice: 'UserRequestPrivateChat',
        argument: {
          name : name,
          members : members,
          topic : topic
        }
      })
    })
  }

  const requestPublicChat = async (user, name, topic) => {
    await post('/command/exercise', {
      body: JSON.stringify({
        templateId: userTemplate,
        contractId: user.contractId,
        choice: 'UserRequestPublicChat',
        argument: {
          name : name,
          topic : topic
        }
      })
    })
  }

  const addMembersToChat = async (user, chat, newMembers) => {
    await post('/command/exercise', {
      body: JSON.stringify({
        templateId: chatTemplate,
        contractId: chat.contractId,
        choice: 'ChatAddMembers',
        argument: {
          member: user.user,
          newMembers: newMembers
        }
      })
    })
  }

  const removeMembersFromChat = async (user, chat, membersToRemove) => {
    await post('/command/exercise', {
      body: JSON.stringify({
        templateId: chatTemplate,
        contractId: chat.contractId,
        choice: 'ChatRemoveMembers',
        argument: {
          member: user.user,
          membersToRemove: membersToRemove
        }
      })
    })
  }

  const updateAliasForMember = async (user, member, alias) => {
    await post('/command/exercise', {
      body: JSON.stringify({
        templateId: userTemplate,
        contractId: user.contractId,
        choice: 'UserUpdateMemberAlias',
        argument: {
          member,
          alias
        }
      })
    })
  }

  const renameChat = async (chat, newName, newTopic) => {
    await post('/command/exercise', {
      body: JSON.stringify({
        templateId: chatTemplate,
        contractId: chat.contractId,
        choice: 'ChatRename',
        argument: {
          newName: newName,
          newTopic: newTopic
        }
      })
    })
  }

  const archiveChat = async (chat) => {
    await post('/command/exercise', {
      body: JSON.stringify({
        templateId: chatTemplate,
        contractId: chat.contractId,
        choice: 'ChatArchive',
        argument: {}
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
    updateAliasForMember,
    renameChat,
    archiveChat
  }

}

export default ChatManager;
