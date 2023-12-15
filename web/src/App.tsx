import { BaseSyntheticEvent, Component, FormEvent, KeyboardEvent } from "react";
import ChatManager, { Aliases, Chat, Message, User } from "./ChatManager";
import Login from "./components/Login";
import NewUser from "./components/NewUser";
import ChatList from "./components/ChatList";
import ChatMembers from "./components/ChatMembers";
import { animateScroll } from "react-scroll";
import ReactTextareaAutocomplete from "@webscopeio/react-textarea-autocomplete";
import logoutIcon from "./icons/logout.svg";
import lockIcon from "./icons/lock.svg";
import publicIcon from "./icons/public.svg";
import NoChat from "./components/NoChat";
import "skeleton-css/css/normalize.css";
import "skeleton-css/css/skeleton.css";
import "@webscopeio/react-textarea-autocomplete/style.css";
import "./App.css";
import ChatSession from "./components/ChatSession";
import { v4 as uuidv4 } from "uuid";
import chatSettings from "./components/autocomplete/chats";
import emojisSettings from "./components/autocomplete/emojis";
import commandsSettings from "./components/autocomplete/commands";
import userSettings from "./components/autocomplete/users";
import { Party } from "@daml/types";

const Loading = () => <div>Loading</div>;

const getAllKnownUsers = (chats: Chat[], aliases: Aliases) => {
  if (!chats) return [];
  const chatMembers = [...new Set(chats.flatMap((c) => c.chatMembers))];

  return chatMembers.map((m) => ({ party: m, alias: aliases[m] || "" }));
};

async function makeChatName() {
  const adjective = "adjective";
  const noun = "noun";

  const headers = (wordType: string) => ({
    Referer: `https://randomwordgenerator.com/${wordType}.php`,
    Accept: "application/json, text/javascript, */*; q=0.01",
    "x-requested-with": "XMLHttpRequest",
  });
  const url = (wordType: string) =>
    `https://cors-anywhere.herokuapp.com/https://randomwordgenerator.com/json/${wordType}s_ws.json`;

  const chatName = await Promise.all([
    fetch(url(adjective), { method: "GET", headers: headers(adjective) }),
    fetch(url(noun), { method: "GET", headers: headers(noun) }),
  ])
    .then(async ([adjectivesRes, nounsRes]) => {
      const adjectives = JSON.parse(await adjectivesRes.text());
      const nouns = JSON.parse(await nounsRes.text());

      return (
        adjectives.data[Math.floor(Math.random() * adjectives.data.length)]
          .adjective.value +
        "-" +
        nouns.data[Math.floor(Math.random() * nouns.data.length)].noun.value
      );
    })
    .catch(() => {
      return uuidv4();
    });

  return chatName;
}

interface Props {}

interface CurrentChatState {
  chatName: string | null;
  currentChat: Chat | null;
  chatMembers: Party[];
  messages: Message[];
}

interface State extends CurrentChatState {
  partyId: string;
  token: string;
  partyName: string;
  showLogin: boolean;
  showWelcome: boolean;
  chatUser: User | null;
  chats: Chat[];
  newMessage: string;
  aliases?: Aliases;
}

const INITIAL_STATE: State = {
  partyId: "",
  token: "",
  partyName: "",
  showLogin: true,
  showWelcome: false,
  chatUser: null,
  currentChat: null,
  chats: [],
  chatMembers: [],
  chatName: null,
  messages: [],
  newMessage: "",
};

class App extends Component<Props, State> {
  chatManager!: ChatManager;
  timerId?: number;
  messageInput!: ReactTextareaAutocomplete<string>;

  constructor(props: Props) {
    super(props);
    this.state = INITIAL_STATE;
    const tokenCookiePair =
      document.cookie
        .split("; ")
        .find((row) => row.startsWith("DAMLHUB_LEDGER_ACCESS_TOKEN")) || "";
    const tokenCookieSecret = tokenCookiePair.slice(
      tokenCookiePair.indexOf("=") + 1,
    );
    const token = tokenCookieSecret || localStorage.getItem("party.token");

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

    if (token) {
      // @ts-ignore
      this.state.token = token;
      // @ts-ignore
      this.state.showLogin = false;
      this.createChatManager(token);
    }
  }

  handleInput(event: BaseSyntheticEvent) {
    const { value, name } = event.target;

    // @ts-ignore
    this.setState({ [name]: value });
  }

  handleSubmit(event: FormEvent) {
    // @ts-ignore
    const { token } = event.target;
    event.preventDefault();
    this.createChatManager(token.value);
  }

  handleAcceptInvitation(event: BaseSyntheticEvent) {
    const { chatUser } = this.state;
    if (!chatUser) {
      return;
    }

    event.preventDefault();
    this.chatManager.acceptInvitation(chatUser).then((_: any) => {
      this.setState({ showWelcome: false });
      this.startPolling();
    });
  }

  handleLogout(event: BaseSyntheticEvent) {
    event.preventDefault();
    localStorage.removeItem("party.token");
    this.stopPolling();
    this.setState({
      partyId: "",
      token: "",
      partyName: "",
      showLogin: true,
      showWelcome: false,
      chatUser: null,
      currentChat: null,
      chats: [],
      chatMembers: [],
      chatName: null,
      messages: [],
      newMessage: "",
    });
  }

  async createChatManager(token: string) {
    try {
      this.chatManager = new ChatManager(token, this.updateState);
      await this.chatManager.init(this.updateUser);
      localStorage.setItem("party.token", token);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Unable to connect to chat");
    }
  }

  updateUser(user: User, onboarded: boolean) {
    this.setState({
      partyId: user.user,
      partyName: user.userName,
      chatUser: user,
      showLogin: false,
      showWelcome: !onboarded,
    });

    if (onboarded) {
      this.startPolling();
    }
  }

  updateState(user: User, model: Chat[], aliases: Aliases) {
    const { currentChat, chats } = this.state;

    const updatedChat =
      currentChat && model.find((c) => c.chatId === currentChat.chatId);

    const updatedChats = model.map((c) => {
      const prevChat = chats.find((chat) => chat.chatId === c.chatId);
      var hasNewMessage = (prevChat && prevChat.hasNewMessage) || false;
      if (prevChat) {
        const lastPrevMessage =
          prevChat.chatMessages[prevChat.chatMessages.length - 1];
        const lastPrevMessageTime =
          (lastPrevMessage && lastPrevMessage.postedAt) || "0";
        const lastMessage = c.chatMessages[c.chatMessages.length - 1];
        const lastMessageTime = (lastMessage && lastMessage.postedAt) || "0";
        if (lastMessageTime > lastPrevMessageTime) {
          hasNewMessage = true;
        }
      }

      if (updatedChat && updatedChat.chatId === c.chatId) {
        hasNewMessage = false;
      }

      return { ...c, hasNewMessage };
    });

    this.setState({
      chatUser: user,
      chats: updatedChats,
      aliases: aliases,
      ...this.updateCurrentChat(updatedChat || null),
    });
  }

  startPolling = () => {
    // @ts-ignore
    this.timerId = setInterval(() => this.chatManager.fetchUpdate(), 2000);
  };

  stopPolling = () => {
    clearInterval(this.timerId);
  };

  updateCurrentChat(chat: Chat | null): CurrentChatState {
    return {
      chatName: chat && chat.chatName,
      currentChat: chat,
      chatMembers: (chat && chat.chatMembers) || [],
      messages: (chat && chat.chatMessages) || [],
    };
  }

  handleSwitchToChat(chatId: string) {
    const { chats, currentChat } = this.state;
    var newChat = chats.find((chat) => chat.chatId === chatId);

    if (newChat) {
      newChat.hasNewMessage = false;
    } else {
      return;
    }

    if (!currentChat || newChat.chatId !== currentChat.chatId) {
      setTimeout(() => this.scrollToLatestMessages(), 100);
    }

    this.setState({ ...this.updateCurrentChat(newChat), chats });
    this.messageInput.setCaretPosition(this.messageInput.getCaretPosition());
  }

  async handleSubmitMessage(event: BaseSyntheticEvent) {
    event.preventDefault();
    const { newMessage, currentChat, chatUser, chats } = this.state;

    if (newMessage.trim() === "") return;
    if (!chatUser) return;

    const match = /\/(\w+)((?:\s*)(.*))?/.exec(newMessage);
    const command = match ? match[1] : "send";
    const content = (match ? match[3] : newMessage) || "";

    const words = (content && content.trim().split(" ")) || [];

    switch (command) {
      case "dm":
        if (!currentChat) return;

        const members = words
          .filter((w) => w.startsWith("@"))
          .map((w) => w.slice(1));
        if (members.length === 0)
          return alert("at least one @user is required");
        const nameTopic = words.filter((w) => !w.startsWith("@"));
        members.push(chatUser.user);

        const requestPrivatePromise = new Promise<{
          privateName: string;
          privateTopic: string;
        }>(async (resolve, _) => {
          const privateName = nameTopic[0] || (await makeChatName());
          const privateTopic =
            nameTopic.length >= 2 ? nameTopic.slice(1).join(" ") : "";
          resolve({ privateName, privateTopic });
        });

        requestPrivatePromise.then((p) =>
          this.chatManager.requestPrivateChat(
            chatUser,
            p.privateName,
            members,
            p.privateTopic,
          ),
        );
        break;
      case "pub":
        const requestPublicPromise = new Promise<{
          publicName: string;
          publicTopic: string;
        }>(async (resolve, _) => {
          const publicName = words[0] || (await makeChatName());
          const publicTopic = words.length >= 2 ? words.slice(1).join(" ") : "";
          resolve({ publicName, publicTopic });
        });

        requestPublicPromise.then((p) =>
          this.chatManager.requestPublicChat(
            chatUser,
            p.publicName,
            p.publicTopic,
          ),
        );
        break;
      case "add":
      case "remove":
        const users = words
          .filter((w) => w.startsWith("@"))
          .map((w) => w.slice(1));
        if (users.length === 0) return alert("at least one @user is required");
        const chatId =
          words.find((w) => w.startsWith("#")) ||
          (currentChat && `#${currentChat.chatId}`) ||
          "";
        const chat = chats.find((c) => c.chatId === chatId.slice(1));
        if (!chat) return alert(`unknown chat id ${chatId}`);
        if (command === "add") {
          this.chatManager
            .addMembersToChat(chatUser, chat, users)
            .then(() => this.chatManager.fetchUpdate());
        } else {
          // remove
          this.chatManager
            .removeMembersFromChat(chatUser, chat, users)
            .then(() => this.chatManager.fetchUpdate());
        }
        break;
      case "contact":
        const contactParty = words
          .filter((w) => w.startsWith("@"))
          .map((w) => w.slice(1));
        if (contactParty.length === 0) return alert("a @user is required");
        if (contactParty.length > 1)
          return alert("exactly one @user is required");
        const contactName = words.filter((w) => !w.startsWith("@"));
        if (contactName.length === 0) {
          this.chatManager.removeFromAddressBook(chatUser, contactParty[0]);
        } else {
          this.chatManager.upsertToAddressBook(
            chatUser,
            contactParty[0],
            contactName.join(" "),
          );
        }
        break;
      case "self":
        this.chatManager.updateSelfAlias(chatUser, words.join(" "));
        break;
      case "users":
        this.chatManager.requestUserList(chatUser);
        break;
      case "rename":
        const chatIdToRename =
          words.find((w) => w.startsWith("#")) ||
          (currentChat && `#${currentChat.chatId}`) ||
          "";
        const chatToRename = chats.find(
          (c) => c.chatId === chatIdToRename.slice(1),
        );
        if (!chatToRename) return alert(`unknown chat id ${chatIdToRename}`);
        const newNameTopic = words.filter((w) => !w.startsWith("#"));
        const newName = newNameTopic[0] || (await makeChatName());
        const newTopic =
          newNameTopic.length >= 2 ? newNameTopic.slice(1).join(" ") : "";
        this.chatManager.renameChat(chatToRename, newName, newTopic);
        break;
      case "archive":
        const chatIdToArchive =
          words.find((w) => w.startsWith("#")) ||
          (currentChat && `#${currentChat.chatId}`) ||
          "";
        const chatToArchive = chats.find(
          (c) => c.chatId === chatIdToArchive.slice(1),
        );
        if (!chatToArchive) return alert(`unknown chat id ${chatIdToArchive}`);
        if (chatToArchive.chatCreator !== chatUser.user) {
          return alert(
            `You must be the creator of chat ${chatIdToArchive} in order to archive it.`,
          );
        }
        let proceed = window.confirm(
          `You are about to archive chat ${chatIdToArchive}. This action cannot be undone!`,
        );
        if (proceed) {
          this.chatManager
            .archiveChat(chatToArchive)
            .then(() => this.chatManager.fetchUpdate());
        }
        break;
      case "slack":
        const chatIdToForward =
          words.find((w) => w.startsWith("#")) ||
          (currentChat && `#${currentChat.chatId}`) ||
          "";
        const chatToForward = chats.find(
          (c) => c.chatId === chatIdToForward.slice(1),
        );
        if (!chatToForward) return alert(`unknown chat id ${chatToForward}`);
        const slackChannelId = words.filter((w) => !w.startsWith("#")).join("");
        this.chatManager.forwardToSlack(chatToForward, slackChannelId);
        break;
      default:
        if (!currentChat)
          return alert(
            "Only commands work on this page, you must be in a chat to send a message",
          );
        this.chatManager
          .sendMessage(chatUser, currentChat, newMessage)
          .then(() => this.chatManager.fetchUpdate())
          .then(() => this.scrollToLatestMessages());
    }

    this.setState({ newMessage: "" });
  }

  handleMessageKeyDown(event: KeyboardEvent) {
    if (event.keyCode !== 13) return;
    if (event.ctrlKey || event.shiftKey) return;

    event.preventDefault();
    this.handleSubmitMessage(event);
  }

  scrollToLatestMessages() {
    animateScroll.scrollToBottom({
      containerId: "chat-messages",
      duration: 100,
    });
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
    } = this.state;
    const aliases = this.state.aliases || {};

    const isPublic = currentChat && currentChat.isPublic;

    return (
      <div className="App">
        <aside className="sidebar left-sidebar">
          {partyName ? (
            <div
              className="user-profile"
              onClick={() => this.setState(this.updateCurrentChat(null))}
            >
              <span className="username">{partyName}</span>
            </div>
          ) : null}
          {!!chats ? (
            <div className="channels-box">
              <h4>Chat Topics:</h4>
              <ChatList
                chats={chats}
                currentChat={currentChat}
                switchToChat={this.handleSwitchToChat}
              />
            </div>
          ) : null}
        </aside>
        <section className="chat-screen">
          {currentChat ? (
            <header className="chat-header">
              <img
                className="chat-header-icon"
                src={isPublic ? publicIcon : lockIcon}
                alt={isPublic ? "public chat" : "private chat"}
              />
              <h1>{` ${currentChat.chatName}`}</h1>
              <h4>{currentChat.chatTopic}</h4>
            </header>
          ) : null}
          {currentChat ? (
            <ul className="chat-messages" id="chat-messages">
              <ChatSession messages={messages} aliases={aliases} />
              <div id="anchor"></div>
            </ul>
          ) : (
            <NoChat />
          )}
          <footer className="chat-footer">
            <form
              className="message-form"
              autoComplete="off"
              onSubmit={this.handleSubmitMessage}
            >
              <ReactTextareaAutocomplete
                ref={(input) =>
                  // @ts-ignore
                  (this.messageInput = input)
                }
                className="message-input"
                value={newMessage}
                name="newMessage"
                placeholder="Your Message"
                onChange={this.handleInput}
                onKeyDown={this.handleMessageKeyDown}
                trigger={
                  {
                    "/": commandsSettings,
                    "@": userSettings(() => getAllKnownUsers(chats, aliases)),
                    "#": chatSettings(chats),
                    ":": emojisSettings,
                  } as any
                }
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
              <ChatMembers chatMembers={chatMembers} aliases={aliases} />
            </div>
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
