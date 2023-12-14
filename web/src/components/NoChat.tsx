import { FunctionComponent } from "react";
import chatFaceIcon from "../icons/chatface.svg";

interface Props {}

const NoChat: FunctionComponent<Props> = (_: Props) => (
  <div className="no-chat-selected">
    <img className="chat-face-icon" src={chatFaceIcon} alt="app logo" />
    <h1>Welcome to Daml Chat</h1>
    <span>
      An app written in{" "}
      <a href="http://www.daml.com" target="_blank" rel="noopener noreferrer">
        Daml
      </a>{" "}
      and deployed using{" "}
      <a href="https://hub.daml.com" target="_blank" rel="noopener noreferrer">
        Daml Hub
      </a>
    </span>
    <p>
      View source code on{" "}
      <a
        href="https://github.com/digital-asset/dablchat"
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub
      </a>
    </p>
    <table>
      <tbody>
        <tr>
          <th>Commands:</th>
          <th></th>
        </tr>
        <tr>
          <td>Create a public chat with all existing members</td>
          <td>
            <code>/pub [chat-name] [chat description]</code>
          </td>
        </tr>
        <tr>
          <td>Private chat</td>
          <td>
            <code>/dm @user... [chat-name] [chat description]</code>
          </td>
        </tr>
        <tr>
          <td>Map a name to a user</td>
          <td>
            <code>/contact [@user] [user's name]</code>
          </td>
        </tr>
        <tr>
          <td>Publish your preferred name</td>
          <td>
            <code>/self [name]</code>
          </td>
        </tr>
        <tr>
          <td>Request a list of known users from the Operator</td>
          <td>
            <code>/users</code>
          </td>
        </tr>
        <tr>
          <th>If you create a chat, you can:</th>
          <th></th>
        </tr>
        <tr>
          <td>Add members</td>
          <td>
            <code>/add @user...</code>
          </td>
        </tr>
        <tr>
          <td>Remove members</td>
          <td>
            <code>/remove @user...</code>
          </td>
        </tr>
        <tr>
          <td>Rename the chat</td>
          <td>
            <code>/rename [#chat-id] [new-name] [new description]</code>
          </td>
        </tr>
        <tr>
          <td>Archive the chat</td>
          <td>
            <code>/archive [#chat-id]</code>
          </td>
        </tr>
        <tr>
          <td>Forward public chat messages to a Slack channel *</td>
          <td>
            <code>/slack [#chat-id] [slackChannelId]</code>
          </td>
        </tr>
        <tr>
          <td colSpan={2}>
            <i>
              Anyone can add members to a public chat and you can remove
              yourself from any chat
            </i>
          </td>
        </tr>
        <tr>
          <td colSpan={2}>
            <i>* Requires running Slack Send Message integration</i>
          </td>
        </tr>
        <tr>
          <th>Other:</th>
          <th></th>
        </tr>
        <tr>
          <td>Random GIF optionally related to tag</td>
          <td>
            <code>/giphy [tag]</code>
          </td>
        </tr>
        <tr>
          <td>Autocomplete User or Chat</td>
          <td>
            <code>@user</code> &nbsp; <code>#chat</code>
          </td>
        </tr>
        <tr>
          <td>Emojis</td>
          <td>
            <code>:smile:</code> &nbsp;{" "}
            <span role="img" aria-label="smile">
              😄
            </span>
          </td>
        </tr>
        <tr>
          <td>Text formatting</td>
          <td>
            **Bold** &nbsp; _Italic_ &nbsp; ~~strike~~ &nbsp;{" "}
            <code>`code`</code>
          </td>
        </tr>
        <tr>
          <td>Fenced code block with syntax highlighting</td>
          <td>
            <code>{`\`\`\`json { "DABL": "Chat" } \`\`\``}</code>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
);

export default NoChat;
