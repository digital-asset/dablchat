import { FunctionComponent } from "react";
import { SettingType } from "@webscopeio/react-textarea-autocomplete";
import { Party } from "@daml/types";

import userIcon from "../../icons/user.svg";

interface ChatMember {
  party: Party;
  alias: string;
}

interface Props {
  entity: ChatMember;
}

const UserAutoCompleteItem: FunctionComponent<Props> = ({ entity }) => {
  return (
    <div className="chat-header">
      <img className="chat-icon" src={userIcon} alt={"user"} />
      <div>{`️ ${entity.alias} @${entity.party}`}</div>
    </div>
  );
};

type GetAllKnownUsers = () => ChatMember[];

const settings: (
  getAllKnownUsers: GetAllKnownUsers,
) => SettingType<ChatMember> = (getAllKnownUsers) => ({
  dataProvider: (token) => {
    return getAllKnownUsers().filter(
      (user) =>
        user.party.startsWith(token.toLowerCase()) ||
        user.alias.toLowerCase().includes(token.toLowerCase()),
    );
  },
  component: UserAutoCompleteItem,
  output: (item) => `@${item.party}`,
});

export default settings;
