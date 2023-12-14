import { FunctionComponent } from "react";
import { SettingType } from "@webscopeio/react-textarea-autocomplete";

import publicIcon from "../../icons/public.svg";
import lockIcon from "../../icons/lock.svg";
import { Chat } from "../../ChatManager.ts";

interface Props {
  entity: Chat;
}

const ChatAutoCompleteItem: FunctionComponent<Props> = ({ entity }) => {
  return (
    <div className="chat-header">
      <img
        className="chat-icon"
        src={entity.isPublic ? publicIcon : lockIcon}
        alt={entity.isPublic ? "public chat" : "private chat"}
      />
      <div>{`️ ${entity.chatName} (#${entity.chatId})`}</div>
      <div className="autocomplete-description">{entity.chatTopic}</div>
    </div>
  );
};

const settings: (chat: Chat[]) => SettingType<Chat> = (chats) => ({
  dataProvider: (token) => {
    return (
      (chats &&
        chats.filter(
          (chat) =>
            chat.chatName && chat.chatName.includes(token.toLowerCase()),
        )) ||
      []
    );
  },
  component: ChatAutoCompleteItem,
  output: (item: any) => `#${item.chatId}`,
});

export default settings;
