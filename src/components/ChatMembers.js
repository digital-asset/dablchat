import React from 'react';


const ChatMembers = props => {
  const { chatMembers, aliases } = props;  // potentially send user a direct message
  const members = chatMembers.map(member => {
    return (
      <li className="chat-member" key={member}>
        <div>
          <span className={`presence online`}/>
          <span>{!!aliases[member] ? `${aliases[member]} (${member})` : member}</span>
        </div>
      </li>
    );
  });

  return (
    <div className="chat-members">
      <ul>{members}</ul>
    </div>
  );
};

export default ChatMembers;
