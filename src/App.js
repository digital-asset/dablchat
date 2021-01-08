import React, { Component } from 'react';
import ChatManager from './ChatManager'
import Login from './components/Login';
import NewUser from './components/NewUser';
import ChatList from './components/ChatList';
import ChatMembers from './components/ChatMembers';
import { animateScroll } from 'react-scroll';
import ReactTextareaAutocomplete from "@webscopeio/react-textarea-autocomplete";
import { emojiIndex } from 'emoji-mart'
import logoutIcon from './icons/logout.svg'
import chatFaceIcon from './icons/chatface.svg'
import lockIcon from './icons/lock.svg'
import publicIcon from './icons/public.svg'
import userIcon from './icons/user.svg'

import 'skeleton-css/css/normalize.css';
import 'skeleton-css/css/skeleton.css';
import "@webscopeio/react-textarea-autocomplete/style.css";
import './App.css';
import ChatSession from './components/ChatSession';
import { v4 as uuidv4 } from 'uuid';

const Loading = ({ data }) => <div>Loading</div>
const CommandAutoCompleteItem = ({ entity }) => {
  return (
    <div className="chat-header">
      <img className="chat-icon"
        src={chatFaceIcon}
        alt="command"
      />
      <div>{` ${entity.command} `}</div>
      <div className="autocomplete-description">{` ${entity.description}`}</div>
    </div>
  )
};

const publicBot = {name: "AutoArchivingBot", hash: process.env.REACT_APP_ARCHIVE_BOT_HASH}

const commands = [
  {
    command: "/add @user... [#chat-id]",
    description: "add user(s) to a chat. (If private, you must be the creator of the chat)"
  },
  {
    command: "/remove @user... [#chat-id]",
    description: "remove user(s) from a chat. (If not yourself, you must be the creator of the chat)"
  },
  {
    command: "/pub [chat-name] [chat description]",
    description: "create a public chat with all existing members"
  },
  {
    command: "/dm @user... [chat-name] [chat description]",
    description: "create a private chat between members"
  },
  {
    command: "/giphy [tag]",
    description: "random GIF related to tag. Random GIF if no tag specified"
  },
  {
    command: "/rename [#chat-id] [new-name] [new description]",
    description: "rename a chat. (You must be the creator of the chat)"
  },
  {
    command: "/contact @user [new name]",
    description: "Map a name to a user, visible only to you. Empty name removes the mapping"
  },
  {
    command: "/self [name]",
    description: "Publish your suggested name to all users, empty name removes the info"
  },
  {
    command: "/users ",
    description: "The operator will publish a list of known user names that you can then add to your contacts"
  },
  {
    command: "/archive [#chat-id]",
    description: "archive a chat. (You must be the creator of the chat)"
  },
  {
    command: "/slack [#chat-id] [slackChannelId]",
    description: "Forward messages of a public chat to a slack channel. (Requires a running Slack Send Message integration and you must be the creator of the chat)"
  },
  {
    command: "/bot [on/off] | [5s|m|h|d]",
    description: "Turning auto-archiving bot on or off or set retention period."
  }
]

const GIPHY_TOKEN = 'kDqbzOZtPvy38TLdqonPnpTPrsLfW8uy'

const getAllKnownUsers = (chats, aliases) => {
  if (!chats) return []
  const chatMembers = [...new Set(chats.flatMap(c => c.chatMembers))]

  return chatMembers.map(m => ({party: m, alias: (aliases[m] || "")}))
}

const UserAutoCompleteItem = ({ entity }) => {
  return (
    <div className="chat-header">
      <img className="chat-icon"
        src={userIcon}
        alt={"user"}
      />
      <div>
        {`️ ${entity.alias} @${entity.party}`}
      </div>
    </div>
  )
};

const ChatAutoCompleteItem = ({ entity }) => {
  return (
    <div className="chat-header">
      <img className="chat-icon"
        src={entity.isPublic ? publicIcon : lockIcon}
        alt={entity.isPublic ? "public chat" : "private chat"}
      />
      <div>
        {`️ ${entity.chatName} (#${entity.chatId})`}
      </div>
      <div className="autocomplete-description">{entity.chatTopic}</div>
    </div>
  )
};

const EmojiAutoCompleteItem = ({ entity }) => {
  return (
    <div>{`️${entity.native} ${entity.colons}`}</div>
  )
}

function isValidBotCmd(words) {
  if (words.length !== 1)
    return false;
  const action = words[0]
  if (['on', 'off'].includes(action.toLowerCase()))
    return true;
  const duration = action.slice(0, -1)
  const unit = action.substr(action.length - 1).toLowerCase()
  return !isNaN(duration) && ['s', 'm', 'h', 'd'].includes(unit);
}

async function makeChatName() {
  const adjective = "adjective"
  const noun = "noun"

  const headers = (wordType) => ({
    "Referer": `https://randomwordgenerator.com/${wordType}.php`,
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'x-requested-with':  'XMLHttpRequest'
  })
  const url = (wordType) => `https://cors-anywhere.herokuapp.com/https://randomwordgenerator.com/json/${wordType}s_ws.json`

  const chatName = await Promise.all([
    fetch(url(adjective), {method: 'GET', headers: headers(adjective) }),
    fetch(url(noun), {method: 'GET', headers: headers(noun) })
  ]).then(async ([adjectivesRes, nounsRes]) => {
    const adjectives = JSON.parse(await adjectivesRes.text());
    const nouns = JSON.parse(await nounsRes.text());

    return adjectives.data[Math.floor(Math.random() * adjectives.data.length)].adjective.value
      + '-' + nouns.data[Math.floor(Math.random() * nouns.data.length)].noun.value
  }).catch((e) => {
      return uuidv4()
    })

    return chatName
}


const INITIAL_STATE = {
  partyId: '',
  token: '',
  partyName: '',
  showLogin: true,
  showWelcome: false,
  chatUser: null,
  currentChat: null,
  chats: [],
  chatMembers: [],
  chatName: null,
  messages:[],
  newMessage: ''
}

class App extends Component {
  constructor() {
    super();
    this.state = INITIAL_STATE;
    const url = new URL(window.location);
    const urlParams = new URLSearchParams(url.search);
    const partyId = urlParams.get('party') || localStorage.getItem('party.id');
    const tokenCookiePair = document.cookie.split('; ').find(row => row.startsWith('DABL_LEDGER_ACCESS_TOKEN')) || '';
    const tokenCookieSecret = tokenCookiePair.slice(tokenCookiePair.indexOf('=') + 1);
    const token = tokenCookieSecret || urlParams.get('token') || localStorage.getItem('party.token');

    this.handleInput = this.handleInput.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleAcceptInvitation = this.handleAcceptInvitation.bind(this);
    this.handleSwitchToChat = this.handleSwitchToChat.bind(this);
    this.handleSubmitMessage = this.handleSubmitMessage.bind(this);
    this.handleMessageKeyDown = this.handleMessageKeyDown.bind(this);
    this.updateState = this.updateState.bind(this);
    this.updateUser = this.updateUser.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
    this.startPolling = this.startPolling.bind(this);
    this.stopPolling = this.stopPolling.bind(this);

    if (!!partyId && !!token) {
      this.state.token = token;
      this.state.partyId = partyId;
      this.state.showLogin = false;
      this.createChatManager(partyId, token);
    }
  }

  handleInput(event) {
    const { value, name } = event.target;

    this.setState({
      [name]: value
    })
  }

  handleSubmit(event) {
    const { partyId, token } = event.target;
    event.preventDefault()
    this.createChatManager(partyId.value, token.value)
  }

  handleAcceptInvitation(event) {
    const { chatUser } = this.state;
    event.preventDefault();
    this.chatManager.acceptInvitation(chatUser)
      .then(_ => {
        this.setState({showWelcome: false});
        this.startPolling();
      })
  }

  handleLogout(event) {
    event.preventDefault();
    localStorage.removeItem("party.id");
    localStorage.removeItem("party.token");
    localStorage.removeItem("operator.id")
    this.stopPolling();
    this.setState({
      partyId: '',
      token: '',
      partyName: '',
      showLogin: true,
      showWelcome: false,
      chatUser: null,
      currentChat: null,
      chats: [],
      chatMembers: [],
      chatName: null,
      messages:[],
      newMessage: ''
    });
  }

  async createChatManager(partyId, token) {
    try {
      this.chatManager = await ChatManager(partyId, token, this.updateUser, this.updateState)
      localStorage.setItem("party.id", partyId);
      localStorage.setItem("party.token", token);
    } catch (e) {
      alert(e.message || 'Unable to connect to chat')
    }
  }

  updateUser(user, onboarded) {
    this.setState({
      partyId: user.user,
      partyName: user.userName,
      chatUser: user,
      showLogin: false,
      showWelcome: !onboarded
    })

    if (onboarded) {
      this.startPolling();
    }
  }

  updateState(user, model, aliases) {
    const { currentChat, chats } = this.state;

    const updatedChat = currentChat && model.find(c => c.chatId === currentChat.chatId)

    const updatedChats = model.map(c => {
      const prevChat = chats.find(chat => chat.chatId === c.chatId)
      var hasNewMessage = (prevChat && prevChat.hasNewMessage) || false;
      if (prevChat) {
        const lastPrevMessage = prevChat.chatMessages[prevChat.chatMessages.length - 1]
        const lastPrevMessageTime = (lastPrevMessage && lastPrevMessage.postedAt) || "0"
        const lastMessage = c.chatMessages[c.chatMessages.length - 1]
        const lastMessageTime = (lastMessage && lastMessage.postedAt) || "0"
        if (lastMessageTime > lastPrevMessageTime) {
          hasNewMessage = true
        }
      }

      if (updatedChat && updatedChat.chatId === c.chatId) {
        hasNewMessage = false
      }

      return {...c, hasNewMessage}
    })

    this.setState({
      chatUser: user,
      chats: updatedChats,
      aliases: aliases,
      ...this.updateCurrentChat(updatedChat)
    })
  }

  startPolling = () => {
    this.timerId = setInterval(() => this.chatManager.fetchUpdate(), 2000);
  }

  stopPolling = () => {
    clearInterval(this.timerId);
  }

  updateCurrentChat(chat) {
    return {
      chatName: chat && chat.chatName,
      currentChat: chat,
      chatMembers: (chat && chat.chatMembers) || [],
      messages: (chat && chat.chatMessages) || []
    }
  }

  handleSwitchToChat(chatId) {
    const { chats, currentChat } = this.state;
    var newChat = chats.find(chat => chat.chatId === chatId)

    if (newChat) {
      newChat.hasNewMessage = false;
    }

    if (!currentChat || newChat.chatId !== currentChat.chatId) {
      setTimeout(() => this.scrollToLatestMessages(), 100)
    }

    this.setState({...this.updateCurrentChat(newChat), chats});
    this.messageInput.setCaretPosition(this.messageInput.getCaretPosition());
  }

  async handleSubmitMessage(event) {
    event.preventDefault();
    const { newMessage, currentChat, chatUser, chats } = this.state

    if (newMessage.trim() === '') return;

    const match = /\/(\w+)((?:\s*)(.*))?/.exec(newMessage)
    const command = match ? match[1] : 'send'
    const content = (match ? match[3] : newMessage) || "";

    const words = (content && content.trim().split(" ")) || [];

    switch (command) {
      case 'dm':
        const members = words.filter(w => w.startsWith("@")).map(w => w.slice(1));
        if (members.length === 0) return alert("at least one @user is required")
        const nameTopic = words.filter(w => !w.startsWith("@"));
        members.push(chatUser.user);

        const requestPrivatePromise = new Promise(async (resolve, _) => {
          const privateName = nameTopic[0] || (await makeChatName());
          const privateTopic = nameTopic.length >= 2 ? nameTopic.slice(1).join(' ') : ''
          resolve({ privateName, privateTopic })
        })

        requestPrivatePromise.then((p) =>
          this.chatManager.requestPrivateChat(chatUser, p.privateName, members, p.privateTopic))
        break;
      case 'pub':
        const requestPublicPromise = new Promise(async (resolve, _) => {
          const publicName = words[0] || (await makeChatName());
          const publicTopic = words.length >= 2 ? words.slice(1).join(' ') : ''
          resolve({ publicName, publicTopic })
        })

        requestPublicPromise.then((p) =>
          this.chatManager.requestPublicChat(chatUser, p.publicName, p.publicTopic))
        break;
      case 'add':
      case 'remove':
        const users = words.filter(w => w.startsWith("@")).map(w => w.slice(1));
        if (users.length === 0) return alert("at least one @user is required")
        const chatId = words.find(w => w.startsWith("#")) || (currentChat && `#${currentChat.chatId}`) || '';
        const chat = chats.find(c => c.chatId === chatId.slice(1))
        if (!chat) return alert(`unknown chat id ${chatId}`)
        if (command === 'add') {
          this.chatManager.addMembersToChat(chatUser, chat, users)
          .then(() => this.chatManager.fetchUpdate())
        } else {  // remove
          this.chatManager.removeMembersFromChat(chatUser, chat, users)
          .then(() => this.chatManager.fetchUpdate())
        }
        break;
      case 'contact':
        const contactParty = words.filter(w => w.startsWith("@")).map(w => w.slice(1));
        if (contactParty.length === 0) return alert("a @user is required");
        if (contactParty.length > 1) return alert("exactly one @user is required");
        const contactName = words.filter(w => !w.startsWith("@"));
        if (contactName.length === 0){
          this.chatManager.removeFromAddressBook(chatUser, contactParty[0])
        } else {
          this.chatManager.upsertToAddressBook(chatUser, contactParty[0], contactName.join(' '))
        }
        break;
      case 'self':
        this.chatManager.updateSelfAlias(chatUser, words.join(' '))
        break;
      case 'users':
        this.chatManager.requestUserList(chatUser)
        break;
      case 'rename':
        const chatIdToRename = words.find(w => w.startsWith("#")) || (currentChat && `#${currentChat.chatId}`) || '';
        const chatToRename = chats.find(c => c.chatId === chatIdToRename.slice(1))
        if (!chatToRename) return alert(`unknown chat id ${chatIdToRename}`)
        const newNameTopic = words.filter(w => !w.startsWith("#"));
        const newName = newNameTopic[0] || (await makeChatName());
        const newTopic = newNameTopic.length >= 2 ? newNameTopic.slice(1).join(' ') : ''
        this.chatManager.renameChat(chatToRename, newName, newTopic)
        break;
      case 'archive':
        const chatIdToArchive = words.find(w => w.startsWith("#")) || (currentChat && `#${currentChat.chatId}`) || '';
        const chatToArchive = chats.find(c => c.chatId === chatIdToArchive.slice(1))
        if (!chatToArchive) return alert(`unknown chat id ${chatIdToArchive}`)
        if (chatToArchive.chatCreator !== chatUser.user) {
          return alert(`You must be the creator of chat ${chatIdToArchive} in order to archive it.`)
        }
        let proceed = window.confirm(`You are about to archive chat ${chatIdToArchive}. This action cannot be undone!`);
        if (proceed) {
          this.chatManager.archiveChat(chatToArchive)
          .then(() => this.chatManager.fetchUpdate())
        }
        break;
      case 'slack':
        const chatIdToForward = words.find(w => w.startsWith("#")) || (currentChat && `#${currentChat.chatId}`) || '';
        const chatToForward = chats.find(c => c.chatId === chatIdToForward.slice(1))
        if (!chatToForward) return alert(`unknown chat id ${chatToForward}`)
        const slackChannelId = words.filter(w => !w.startsWith("#")).join('');
        this.chatManager.forwardToSlack(chatToForward, slackChannelId)
        break;
      case 'giphy':
          fetch(`//api.giphy.com/v1/gifs/random?api_key=${GIPHY_TOKEN}&tag=${encodeURIComponent(content)}`)
          .then(async res => {
            const result = await res.json()
            const imageUrl = result.data.fixed_height_downsampled_url
            const message = `![${content}](${imageUrl})`
            this.chatManager.sendMessage(chatUser, currentChat, message)
          })
          .then(() => this.chatManager.fetchUpdate())
          .then(() => this.scrollToLatestMessages())
          break;
      case 'bot':
        if (!isValidBotCmd(words)) {
          alert("invalid bot command. required e.g. /bot [on/off] | [5s|m|h|d]")
          break;
        }
        const action = words[0].toLowerCase()
        const allBots = await this.chatManager.getPublicAutomation().then(async res => {
          const bots = await res.json()
          return bots.filter(en => en.artifactHash === publicBot.hash)
        }
        )

        if (allBots.length === 0) {
          this.chatManager.archiveBotRequest(chatUser,
            publicBot.name,
              false, `\`${publicBot.name}\` is not available.`)
          console.log(`public artifact: ${publicBot.hash} not found`)
          break;
        }
        const theBot = allBots[0]
        switch (action) {
          case 'on':
            this.chatManager.deployArchiveBot(theBot.owner, theBot.artifactHash)
              .then(() => {
                this.chatManager.archiveBotRequest(chatUser, publicBot.name, true, null)
              })
            break;
          case 'off':
            this.chatManager.undeployArchiveBot(theBot.artifactHash)
              .then(() => {
                this.chatManager.archiveBotRequest(chatUser, publicBot.name, false, null)
              })
            break;
          default:
            const duration = action.slice(0, -1)
            const unit = action.substr(action.length - 1).toLowerCase()
            this.chatManager.updateUserSettings(chatUser, {"time": duration, "unit": unit})
            break;
        }
        break;
      default:
        if (!currentChat) return alert("Only commands work on this page, you must be in a chat to send a message")
        this.chatManager.sendMessage(chatUser, currentChat, newMessage)
          .then(() => this.chatManager.fetchUpdate())
          .then(() => this.scrollToLatestMessages())
    }

    this.setState({ newMessage: '' })

  }

  handleMessageKeyDown(event) {
    if (event.keyCode !== 13) return;
    if (event.ctrlKey || event.shiftKey) return;

    event.preventDefault()
    this.handleSubmitMessage(event)
  }

  scrollToLatestMessages() {
    animateScroll.scrollToBottom({
      containerId: 'chat-messages',
      duration: 100
    })
  }

  render() {
    const {
      token,
      partyId,
      partyName,
      showLogin,
      showWelcome,
      currentChat,
      chats,
      chatMembers,
      messages,
      newMessage,
      aliases,
    } = this.state;

    const isPublic = currentChat && currentChat.isPublic;

    return (
      <div className="App">
        <aside className="sidebar left-sidebar">
          {partyName ? (
            <div className="user-profile" onClick={() => this.setState(this.updateCurrentChat(null))}>
              <span className="username">{partyName}</span>
            </div>
          ) : null}
          {!!chats ? (<div className="channels-box">
            <h4>Chat Topics:</h4>
            <ChatList
              chats={chats}
              currentChat={currentChat}
              switchToChat={this.handleSwitchToChat}
            /></div>
          ) : null}
        </aside>
        <section className="chat-screen">
          {currentChat ? (
            <header className="chat-header">
              <img className="chat-header-icon"
                src={isPublic ? publicIcon : lockIcon}
                alt={isPublic ? "public chat" : "private chat"}
              />
              <h1>{` ${currentChat.chatName}`}</h1>
              <h4>{currentChat.chatTopic}</h4>
            </header>
          ) : null}
          {currentChat ? (
            <ul className="chat-messages" id="chat-messages">
              <ChatSession messages={messages} aliases={aliases}/>
              <div id="anchor"></div>
            </ul>
          ) : (
            <div className="no-chat-selected">
              <img className="chat-face-icon" src={chatFaceIcon} alt="app logo" />
              <h1>Welcome to DABL Chat</h1>
                <span>An app written in  <a href="http://www.daml.com" target="_blank" rel="noopener noreferrer">DAML</a> and deployed using  <a href="http://www.projectdabl.com" target="_blank" rel="noopener noreferrer">project:dabl</a></span>
                <p>View source code on <a href="https://github.com/digital-asset/dablchat" target="_blank" rel="noopener noreferrer">GitHub</a></p>
                <table>
                  <tbody>
                    <tr>
                        <th>Commands:</th>
                        <th></th>
                    </tr>
                    <tr>
                        <td>Create a public chat with all existing members</td>
                        <td><code>/pub [chat-name] [chat description]</code></td>
                    </tr>
                    <tr>
                        <td>Private chat</td>
                        <td><code>/dm @user... [chat-name] [chat description]</code></td>
                    </tr>
                    <tr>
                        <td>Map a name to a user</td>
                        <td><code>/contact [@user] [user's name]</code></td>
                    </tr>
                    <tr>
                        <td>Publish your preferred name</td>
                        <td><code>/self [name]</code></td>
                    </tr>
                    <tr>
                        <td>Request a list of known users from the Operator</td>
                        <td><code>/users</code></td>
                    </tr>
                    <tr>
                        <td>Start/Stop an archiving bot to automatically archive your expired messages</td>
                        <td><code>/bot [on/off] | [5s/m/h/d]</code></td>
                    </tr>
                    <tr>
                        <th>If you create a chat, you can:</th>
                        <th></th>
                    </tr>
                    <tr>
                        <td>Add members</td>
                        <td><code>/add @user...</code></td>
                    </tr>
                    <tr>
                        <td>Remove members</td>
                        <td><code>/remove @user...</code></td>
                    </tr>
                    <tr>
                        <td>Rename the chat</td>
                        <td><code>/rename [#chat-id] [new-name] [new description]</code></td>
                    </tr>
                    <tr>
                        <td>Archive the chat</td>
                        <td><code>/archive [#chat-id]</code></td>
                    </tr>
                    <tr>
                        <td>Forward public chat messages to a Slack channel *</td>
                        <td><code>/slack [#chat-id] [slackChannelId]</code></td>
                    </tr>
                    <tr>
                        <td colSpan="2"><i>Anyone can add members to a public chat and you can remove yourself from any chat</i></td>
                    </tr>
                    <tr>
                        <td colSpan="2"><i>* Requires running Slack Send Message integration</i></td>
                    </tr>
                    <tr>
                        <th>Other:</th>
                        <th></th>
                    </tr>
                    <tr>
                        <td>Random GIF optionally related to tag</td>
                        <td><code>/giphy [tag]</code></td>
                    </tr>
                    <tr>
                        <td>Autocomplete User or Chat</td>
                        <td><code>@user</code> &nbsp; <code>#chat</code></td>
                    </tr>
                    <tr>
                        <td>Emojis</td>
                        <td><code>:smile:</code> &nbsp; <span role="img" aria-label="smile">😄</span></td>
                    </tr>
                    <tr>
                        <td>Text formatting</td>
                        <td>**Bold** &nbsp; _Italic_ &nbsp; ~~strike~~ &nbsp; <code>`code`</code></td>
                    </tr>
                    <tr>
                        <td>Fenced code block with syntax highlighting</td>
                        <td><code>{`\`\`\`json { "DABL": "Chat" } \`\`\``}</code>
                        </td>
                    </tr>
                  </tbody>
                </table>
            </div>)}
          <footer className="chat-footer">
            <form className="message-form" autoComplete="off" onSubmit={this.handleSubmitMessage}>
              <ReactTextareaAutocomplete
                ref={(input) => this.messageInput = input}
                className="message-input"
                value={newMessage}
                name="newMessage"
                placeholder="Your Message"
                onChange={this.handleInput}
                onKeyDown={this.handleMessageKeyDown}
                trigger={{
                  "/": {
                    dataProvider: token => { return commands.filter(({command, description}) => command.slice(1).startsWith(token.toLowerCase())) },
                    component: CommandAutoCompleteItem,
                    output: (item, trigger) => item.command.substr(0, item.command.indexOf(' '))
                  },
                  "@": {
                    dataProvider: token => { return getAllKnownUsers(chats, aliases).filter(user => user.party.startsWith(token.toLowerCase()) || user.alias.toLowerCase().includes(token.toLowerCase())) },
                    component: UserAutoCompleteItem,
                    output: (item, trigger) => `@${item.party}`
                  },
                  "#": {
                    dataProvider: token => { return (chats && chats.filter(chat => chat.chatName.includes(token.toLowerCase()))) || [] },
                    component: ChatAutoCompleteItem,
                    output: (item, trigger) => `#${item.chatId}`
                  },
                  ":": {
                    dataProvider: token => { return emojiIndex.search(token).slice(0, 5) || [] },
                    component: EmojiAutoCompleteItem,
                    output: (item, trigger) => item.native
                  }
                }}
                loadingComponent={Loading}
                resize="none"
              />
            </form>
          </footer>
        </section>
        <aside className="sidebar right-sidebar">
          <div className="logout" onClick={this.handleLogout}>
            <span className="logout-button">
              <span>Log out</span>
              <img className="logout-icon" src={logoutIcon} alt="log out" />
            </span>
          </div>
          {currentChat ? (
            <div className="chat-members-box">
            <h4>creator:</h4>
            <ChatMembers
              chatMembers={[currentChat.chatCreator]}
              aliases={aliases}
            />
            <h4>chat members:</h4>
            <ChatMembers
              chatMembers={chatMembers}
              aliases={aliases}
            /></div>
          ) : null}
        </aside>
        {showLogin ? (
          <Login
            partyId={partyId}
            token={token}
            handleUserInput={this.handleInput}
            handleTokenInput={this.handleInput}
            handleSubmit={this.handleSubmit}
          />
        ) : showWelcome ? (
          <NewUser
            partyName={partyName}
            handleAcceptInvitation={this.handleAcceptInvitation}
          />
        ) : null}
      </div>
    );
  }
}

export default App;
