import os
import logging
import uuid
import time

import dazl
from dazl import create, exercise, exercise_by_key

dazl.setup_default_logger(logging.INFO)


class Chat:
    AliasesRequest = 'Chat.V1:AliasesRequest'
    Chat = 'Chat.V1:Chat'
    CreateChatRequest = 'Chat.V1:CreateChatRequest'
    ForwardToSlack = 'Chat.V1:ForwardToSlack'
    Message = 'Chat.V1:Message'
    Operator = 'Chat.V1:Operator'
    SelfAlias = 'Chat.V1:SelfAlias'
    User = 'Chat.V1:User'
    UserSession = 'Chat.V1:UserSession'


class SlackIntegration:
    OutboundMessage = 'SlackIntegration.OutboundMessage:OutboundMessage'


def main():
    url = os.getenv('DAML_LEDGER_URL')
    party = os.getenv('DAML_LEDGER_PARTY')
    public_party = os.getenv('DABL_PUBLIC_PARTY')

    network = dazl.Network()
    network.set_config(url=url)

    logging.info(f'starting a the operator_bot for party {party}')
    logging.info(f'public party is {public_party}')
    client = network.aio_party(party)

    @client.ledger_ready()
    def create_operator(_):
        logging.info(f'On Ledger Ready')
        res = client.find_active(Chat.Operator)
        logging.info(f'found {len(res)} {Chat.Operator} contracts')

        if not res:
            logging.info(f'Creating Operator contract for {party}...')
            return client.submit_create(Chat.Operator,
                                        {'operator': client.party, 'publicParty': public_party})
        else:
            logging.info(f'Operator {party} is ready')
            user_sessions = client.find_active(Chat.UserSession)
            logging.info(f'found {len(user_sessions)} {Chat.UserSession} contracts')
            return [exercise(cid, 'UserSessionAck') for cid in user_sessions.keys()]

    @client.ledger_created(Chat.Operator)
    def invite_users(_):
        logging.info(f'On {Chat.Operator} created!')
        user_sessions = client.find_active(Chat.UserSession)
        logging.info(f'found {len(user_sessions)} {Chat.UserSession} contracts')

        return [exercise(cid, 'UserSessionAck') for cid in user_sessions.keys()]

    @client.ledger_created(Chat.UserSession)
    def invite_user_to_chat(event):
        logging.info(f'On {Chat.UserSession} created!')
        return client.submit_exercise(event.cid, 'UserSessionAck')

    @client.ledger_created(Chat.Message)
    def send_to_slack_channel(event):
        cdata = event.cdata
        logging.info(f"on message! {cdata}")
        forwards = client.find_active(Chat.ForwardToSlack, {'chatId': cdata['chatId']})
        logging.info(f'Found {len(forwards)} {Chat.ForwardToSlack} contracts')
        posted_at = time.strftime("%a, %d %b %Y %H:%M:%S %Z",
                                  time.localtime(float(cdata['postedAt'])))
        message_text = f"`From:` {cdata['sender']}\n`Posted At:` {posted_at}\n" \
                       f"`DABL Chat Id:` {cdata['chatId']}\n`Message:` {cdata['message']}"
        return [create(SlackIntegration.OutboundMessage, {
            'integrationParty': client.party,
            'slackChannel': f['slackChannelId'],
            'messageText': message_text,
            'attemptCount': 3
        }) for (_, f) in forwards.items()]

    @client.ledger_created(Chat.AliasesRequest)
    def divulge_aliases(event):
        logging.info(f'On {Chat.AliasesRequest}')
        aliases = client.find_active(Chat.SelfAlias)
        logging.info(f'found {len(aliases)} {Chat.SelfAlias} contracts')
        mappings = [f"{cdata['user']} -> {cdata['alias']}" for _, cdata in aliases.items()]
        mappings_str = '\n'.join(mappings)
        if len(mappings) > 0:
            known_users_message = f"Here is the list of known users:\n```\n{mappings_str}\n```"
        else:
            known_users_message = "I couldn't find any known users!"

        commands = [exercise(event.cid, 'Archive', {}),
                    exercise_by_key(
                        Chat.Chat,
                        {'_1': client.party,
                         '_2': event.cdata['user']},
                        'ChatPostMessage',
                        {
                            'poster': client.party,
                            'message': known_users_message,
                            'postedAt': f"{int(time.time())}"
                        }
                    )]
        return client.submit(commands)

    @client.ledger_created(Chat.User)
    def add_to_public_chats(event):
        logging.info(f'On {Chat.User} created!')
        if event.cdata['operator'] != client.party:
            return

        chats = client.find_active(Chat.Chat, {'isPublic': True})
        logging.info(f'found {len(chats)} public {Chat.Chat} contracts')
        new_user = event.cdata['user']

        commands = []
        for (cid, cdata) in chats.items():
            if new_user not in cdata['members']:
                commands.append(exercise(cid, 'ChatAddMembers', {
                    'member': client.party,
                    'newMembers': [new_user]
                }))
                logging.info(f"adding {new_user} to {cdata['name']}...")

        return client.submit(commands)

    @client.ledger_created(Chat.CreateChatRequest)
    def respond_to_chat_request(event):
        logging.info(f'On {Chat.CreateChatRequest} created!')
        cdata = event.cdata
        if cdata['operator'] != client.party:
            return

        user_contracts = client.find_active(Chat.User)
        party_members = []
        is_public = cdata['isPublic']

        for (_, data) in user_contracts.items():
            if is_public or data['user'].lower() in map(lambda m: m.lower(), cdata['members']):
                party_members.append(data['user'])

        if party_members:
            return client.submit_exercise(event.cid, 'CreateChatRequestRespond', {
                'partyMembers': party_members,
                'chatId': str(uuid.uuid4())
            })
        else:
            return client.submit_exercise(event.cid, 'CreateChatRequestReject')

    network.run_forever()


if __name__ == '__main__':
    main()
