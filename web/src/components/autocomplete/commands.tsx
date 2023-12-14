import { FunctionComponent } from "react";
import { SettingType } from "@webscopeio/react-textarea-autocomplete";

import chatFaceIcon from "../../icons/chatface.svg";

export interface Command {
  command: string;
  description: string;
}

const commands: Command[] = [
  {
    command: "/add @user... [#chat-id]",
    description:
      "add user(s) to a chat. (If private, you must be the creator of the chat)",
  },
  {
    command: "/remove @user... [#chat-id]",
    description:
      "remove user(s) from a chat. (If not yourself, you must be the creator of the chat)",
  },
  {
    command: "/pub [chat-name] [chat description]",
    description: "create a public chat with all existing members",
  },
  {
    command: "/dm @user... [chat-name] [chat description]",
    description: "create a private chat between members",
  },
  {
    command: "/rename [#chat-id] [new-name] [new description]",
    description: "rename a chat. (You must be the creator of the chat)",
  },
  {
    command: "/contact @user [new name]",
    description:
      "Map a name to a user, visible only to you. Empty name removes the mapping",
  },
  {
    command: "/self [name]",
    description:
      "Publish your suggested name to all users, empty name removes the info",
  },
  {
    command: "/users ",
    description:
      "The operator will publish a list of known user names that you can then add to your contacts",
  },
  {
    command: "/archive [#chat-id]",
    description: "archive a chat. (You must be the creator of the chat)",
  },
  {
    command: "/slack [#chat-id] [slackChannelId]",
    description:
      "Forward messages of a public chat to a slack channel. (Requires a running Slack Send Message integration and you must be the creator of the chat)",
  },
];

interface Props {
  entity: Command;
}

const CommandAutoCompleteItem: FunctionComponent<Props> = ({
  entity,
}: {
  entity: any;
}) => {
  return (
    <div className="chat-header">
      <img className="chat-icon" src={chatFaceIcon} alt="command" />
      <div>{` ${entity.command} `}</div>
      <div className="autocomplete-description">{` ${entity.description}`}</div>
    </div>
  );
};

const settings: SettingType<Command> = {
  dataProvider: (token): Command[] => {
    return commands.filter(({ command }) =>
      command.slice(1).startsWith(token.toLowerCase()),
    );
  },
  component: CommandAutoCompleteItem,
  output: (item) => item.command.substr(0, item.command.indexOf(" ")),
};

export default settings;
