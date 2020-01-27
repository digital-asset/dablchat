import React from 'react';
import lockIcon from '../icons/lock.svg'
import publicIcon from '../icons/public.svg'


const ChatList = props => {
  const {
    chats,
    currentChat,
    switchToChat,
  } = props;

  const chatList = chats.map(chat => {
    const activeStatus = currentChat && chat.chatId === currentChat.chatId ? 'active' : '';

    return (
      <li
        className={activeStatus}
        key={chat.chatId}
        onClick={() => switchToChat(chat.chatId)}
      >
        <img className="chat-icon"
          src={chat.isPublic ? publicIcon : lockIcon}
          alt={chat.isPublic ? "public chat" : "private chat"}
        />
        <span className="chat-name">{`${chat.chatName} `}</span>
        {chat.hasNewMessage && !activeStatus ? (
          <span className="presence online"></span>
        ) : null}
      </li>
    )
  });

  return (
      <div className="chats">
        <ul className="chat-list">{chatList}</ul>
      </div>
  );
};

export default ChatList;
