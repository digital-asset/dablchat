
function parseJwt (token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

  const getChatOperator = async () => {
    const url = window.location.host
    const response = await fetch('//' + url + '/.well-known/dabl.json');
    const dablJson = await response.json();
    return dablJson['userAdminParty']
  }

  const createSession = async (operator, userName) => {
    return post('/command/create', {
      body: JSON.stringify({
        templateId: userSessionTemplate,
        payload: {
          operator,
          user: party,
          userName
        }
      })
    })
  }

  const userSessionTemplate = 'Chat:UserSession'
  const userTemplate = 'Chat:User'
  const userInvitationTemplate = 'Chat:UserInvitation'
  const chatTemplate = 'Chat:Chat'
  const messageTemplate = 'Chat:Message'
  const selfAliasTemplate = 'Chat:SelfAlias'
  const addressBookTemplate = 'Chat:AddressBook'

  const operatorId = localStorage.getItem("operator.id") || await getChatOperator();
  localStorage.setItem("operator.id", operatorId)
  const sub = parseJwt(token)['sub']
  const userName = sub.substr(sub.indexOf('|') + 1, sub.indexOf('@') - sub.indexOf('|') - 1);

  const createSessionResponse = await createSession(operatorId, userName);

  switch (createSessionResponse.status) {
    case 401:
      throw new Error("Authentication failed")
    case 404:
      throw new Error("HTTP JSON failed")
    case 500:
      throw new Error("Internal Server Error")
    default:
  }

  try {

    let user = null
    let attempts = 0

    while (!user && attempts < 3) {
      const userContractsResponse = await post('/contracts/search', {
        body: JSON.stringify({ 'templateIds': [ userTemplate, userInvitationTemplate ]})
      })
      const userContracts = await userContractsResponse.json();
      console.log(userContracts)
      console.log(`attempts ${attempts}`)

      user = userContracts.result.find(u => u.templateId.endsWith(userTemplate))
        || userContracts.result.find(ui => ui.templateId.endsWith(userInvitationTemplate));
      if (!user) {
        attempts += 1
        await sleep(2000);
      }
    }

    if (!user) {
      throw new Error(`Cannot onboard user ${party} to this app!`)
    }

    const onboarded = user.templateId.endsWith(userTemplate);

    updateUser(Object.assign({}, {...user.payload, contractId: user.contractId}), onboarded);
  } catch(e) {
    console.error(e)
  }

  const fetchUpdate = async () => {
    try {
      const allContractsResponse = await post('/contracts/search', {
        body: JSON.stringify({ 'templateIds': [chatTemplate, messageTemplate, userTemplate, addressBookTemplate, selfAliasTemplate] })
      })

      const allContracts = await allContractsResponse.json();

      const chats = allContracts.result.filter(c => c.templateId.endsWith(chatTemplate));
      const messages = allContracts.result.filter(m => m.templateId.endsWith(messageTemplate));
      const user = allContracts.result.find(u => u.templateId.endsWith(userTemplate));
      const selfAlias = allContracts.result.find(ma => ma.templateId.endsWith(selfAliasTemplate));
      const addressBook = allContracts.result.find(ma => ma.templateId.endsWith(addressBookTemplate));

      const model = chats
        .sort((c1, c2) => c1.payload.name > c2.payload.name ? 1 : c1.payload.name < c2.payload.name ? -1 : 0)
        .map(c => {
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

      let aliases = Object.assign({}, addressBook.payload.contacts.textMap);
      if (selfAlias) {
        aliases[selfAlias.payload.user] = selfAlias.payload.alias;
      }

      updateState(Object.assign({}, {...user.payload, contractId: user.contractId}), model, aliases);

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

  const updateSelfAlias = async (user, alias) => {
    await post('/command/exercise', {
      body: JSON.stringify({
        templateId: userTemplate,
        contractId: user.contractId,
        choice: 'UserUpdateSelfAlias',
        argument: {
          alias
        }
      })
    })
  }

  const upsertToAddressBook = async (user, party, name) => {
    await post('/command/exercise', {
      body: JSON.stringify({
        templateId: addressBookTemplate,
        key: user.user,
        choice: 'AddressBookAdd',
        argument: {
          party,
          name
        }
      })
    })
  }

  const removeFromAddressBook = async (user, party) => {
    await post('/command/exercise', {
      body: JSON.stringify({
        templateId: addressBookTemplate,
        key: user.user,
        choice: 'AddressBookRemove',
        argument: {
          party
        }
      })
    })
  }

  const requestUserList = async (user) => {
    await post('/command/exercise', {
      body: JSON.stringify({
        templateId: userTemplate,
        contractId: user.contractId,
        choice: 'UserRequestAliases',
        argument: {}
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
    updateSelfAlias,
    upsertToAddressBook,
    removeFromAddressBook,
    requestUserList,
    renameChat,
    archiveChat
  }

}

export default ChatManager;
