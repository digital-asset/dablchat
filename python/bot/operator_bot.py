import os
import logging
import uuid
import time

import dazl
from dazl import create, exercise, exercise_by_key

dazl.setup_default_logger(logging.INFO)


class CHAT:
    AliasesRequest = 'Chat.V1.AliasesRequest'
    Chat = 'Chat.V1.Chat'
    CreateChatRequest = 'Chat.V1.CreateChatRequest'
    ForwardToSlack = 'Chat.V1.ForwardToSlack'
    Message = 'Chat.V1.Message'
    Operator = 'Chat.V1.Operator'
    SelfAlias = 'Chat.V1.SelfAlias'
    User = 'Chat.V1.User'
    UserSession = 'Chat.V1.UserSession'


class SLACK_INTEGRATION:
    class OUTBOUND_MESSAGE:
        OutboundMessage = 'SlackIntegration.OutboundMessage.OutboundMessage'


def main():
    url = os.getenv('DAML_LEDGER_URL')
    party = os.getenv('DAML_LEDGER_PARTY')
    public_party = os.getenv('DABL_PUBLIC_PARTY')

    network = dazl.Network()
    network.set_config(url=url)

    logging.info(f'starting a the operator_bot for party {party}')
    client = network.aio_party(party)

    @client.ledger_ready()
    def create_operator(event):  # pylint: disable=unused-variable
        logging.info(f'On Ledger Ready')
        res = client.find_active(CHAT.Operator)
        logging.info(f'found {len(res)} {CHAT.Operator} contracts')

        if not res:
            logging.info(f'Creating Operator contract for {party}...')
            return client.submit_create(CHAT.Operator, { 'operator': client.party, 'publicParty': public_party })
        else:
            logging.info(f'Operator {party} is ready')


    @client.ledger_created(CHAT.Operator)
    def invite_users(event):  # pylint: disable=unused-variable
        logging.info(f'On {CHAT.Operator} created!')
        user_sessions = client.find_active(CHAT.UserSession)
        logging.info(f'found {len(user_sessions)} {CHAT.UserSession} contracts')

        return [exercise(cid, 'UserSessionAck') for cid in user_sessions.keys()]


    @client.ledger_created(CHAT.UserSession)
    def invite_user_to_chat(event):  # pylint: disable=unused-variable
        logging.info(f'On {CHAT.UserSession} created!')
        return client.submit_exercise(event.cid, 'UserSessionAck')


    @client.ledger_created(CHAT.Message)
    def send_to_slack_channel(event):  # pylint: disable=unused-variable
        cdata = event.cdata
        logging.info(f"on message! {cdata}")
        forwards = client.find_active(CHAT.ForwardToSlack, {'chatId': cdata['chatId']})
        logging.info(f'Found {len(forwards)} {CHAT.ForwardToSlack} contracts')
        posted_at = time.strftime("%a, %d %b %Y %H:%M:%S %Z", time.localtime(float(cdata['postedAt'])))
        message_text = f"`From:` {cdata['sender']}\n`Posted At:` {posted_at}\n" \
                       f"`DABL Chat Id:` {cdata['chatId']}\n`Message:` {cdata['message']}"
        return [create(SLACK_INTEGRATION.OUTBOUND_MESSAGE.OutboundMessage, {
            'integrationParty': client.party,
            'slackChannel': f['slackChannelId'],
            'messageText': message_text,
            'attemptCount': 3
        }) for (_, f) in forwards.items()]


    @client.ledger_created(CHAT.AliasesRequest)
    def divulge_aliases(event):  # pylint: disable=unused-variable
        logging.info(f'On {CHAT.AliasesRequest}')
        aliases = client.find_active(CHAT.SelfAlias)
        logging.info(f'found {len(aliases)} {CHAT.SelfAlias} contracts')
        mappings = [f"{cdata['user']} -> {cdata['alias']}" for _ , cdata in aliases.items()]
        mappings_str = '\n'.join(mappings)
        commands = []
        commands.append(exercise(event.cid, 'Archive', {}))
        commands.append(exercise_by_key(CHAT.Chat,
            {'_1': client.party, '_2': event.cdata['user']},
            'ChatPostMessage',
            {
                'poster': client.party,
                'message': f"Here is the list of known users:\n```scala\n{mappings_str}\n```" \
                    if len(mappings) > 0 else "I couldn't find any known users!",
                'postedAt': f"{int(time.time())}"
            }
        ))

        return client.submit(commands)


    @client.ledger_created(CHAT.User)
    def add_to_public_chats(event):  # pylint: disable=unused-variable
        logging.info(f'On {CHAT.User} created!')
        if event.cdata['operator'] != client.party:
            return

        chats = client.find_active(CHAT.Chat, {'isPublic': True})
        logging.info(f'found {len(chats)} public {CHAT.Chat} contracts')
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


    @client.ledger_created(CHAT.CreateChatRequest)
    def respond_to_chat_request(event):  # pylint: disable=unused-variable
        logging.info(f'On {CHAT.CreateChatRequest} created!')
        cdata = event.cdata
        if cdata['operator'] != client.party:
            return

        user_contracts = client.find_active(CHAT.User)
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
