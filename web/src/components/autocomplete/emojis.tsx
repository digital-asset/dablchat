import { SettingType } from "@webscopeio/react-textarea-autocomplete";
import { SearchIndex } from "emoji-mart";
import { FunctionComponent } from "react";

interface Props {
  entity: Emoji;
}

export interface Emoji {
  native: string;
  colons: any;
}

const EmojiAutoCompleteItem: FunctionComponent<Props> = ({ entity }) => {
  return <div>{`️${entity.native} ${entity.colons}`}</div>;
};

export const settings: SettingType<Emoji> = {
  dataProvider: (token) =>
    SearchIndex.search(token).then((results) => results.slice(0, 5)),
  component: EmojiAutoCompleteItem,
  output: (item) => item.native,
};

export default settings;
