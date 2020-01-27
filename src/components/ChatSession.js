import React, { Component } from 'react';
import ReactMarkdown from 'react-markdown'
import CodeBlock from './CodeBlock'


class ChatSession extends Component {

  render() {
    const messages = this.props.messages
    const aliases = this.props.aliases
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
              <ReactMarkdown
                source={message.message}
                renderers={{ code: CodeBlock }}
                />
            </span>
          </div>
          <span className="message-time">{timeLabel}</span>
        </li>
      );
    });
  }
};

export default ChatSession;
