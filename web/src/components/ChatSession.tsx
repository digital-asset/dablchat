import ReactMarkdown from 'react-markdown'
import { Aliases, Message } from '../ChatManager';

interface Props {
  messages: Message[]
  aliases: Aliases
}

const ChatSession = ({ messages, aliases }: Props) => {
  return messages.map((message, idx, arr) => {
    const prevMessage = arr[idx - 1];
    const sameSender = (prevMessage && prevMessage.sender === message.sender) || false;
    var time = new Date(0);
    time.setUTCSeconds(parseInt(message.postedAt))
    const timeLabel = new Intl.DateTimeFormat('en-US',
      { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(time)

    return (
      <li className="message" key={message.contractId}>
        <div>
          {sameSender ? null : <span className="party-id">{aliases[message.sender] || message.sender}</span>}
          <span>
            <ReactMarkdown>{message.message}</ReactMarkdown>
          </span>
        </div>
        <span className="message-time">{timeLabel}</span>
      </li>
    );
  });
};

export default ChatSession;
