import os
import logging
import uuid
import time

import dazl
from dazl import create, exercise, exercise_by_key

dazl.setup_default_logger(logging.INFO)

def main():
    url = os.getenv('DAML_LEDGER_URL')
    party = os.getenv('DAML_LEDGER_PARTY')

    network = dazl.Network()
    network.set_config(url=url)

    logging.info(f'starting a the operator_bot for party {party}')
    client = network.aio_party(party)

    @client.ledger_ready()
    def create_operator(event):  # pylint: disable=unused-variable
        logging.info(f'On Ledger Ready')
        res = client.find_active('Chat.Operator')
        logging.info(f'found {len(res)} Chat.Operator contracts')

        if not res:
            logging.info(f'Creating Operator contract for {party}...')
            return client.submit_create('Chat.Operator', { 'operator': client.party })
        else:
            logging.info(f'Operator {party} is ready')


    @client.ledger_created('Chat.Operator')
    def invite_users(event):  # pylint: disable=unused-variable
        logging.info(f'On Chat.Operator created!')
        users = client.find_active('Chat.User', {'operator': client.party})
        logging.info(f'found {len(users)} Chat.User contracts')
        invitations = client.find_active('Chat.UserInvitation', {'operator': client.party})
        logging.info(f'found {len(invitations)} Chat.UserInvitation contracts')

        users_parties = map(lambda _, cdata: cdata['user'], users.items())
        logging.info(f'users_parties: {users_parties}')
        invitations_parties = map(lambda _, cdata: cdata['user'], invitations.items())
        logging.info(f'invitations_parties: {invitations_parties}')


        ledger_parties = client.find_active('DABL.Ledger.V2.LedgerParty')
        logging.info(f'found {len(ledger_parties)} DABL.Ledger.V2.LedgerParty contracts')

        commands = []

        for (_, cdata) in ledger_parties.items():
            user = cdata['party']
            if user != client.party \
                and user not in users_parties \
                and user not in invitations_parties:
                    commands.append(exercise(event.cid, 'OperatorInviteUser', {'user': user}))
                    logging.info(f'will invite {user}...')

        return client.submit(commands)


    @client.ledger_created('Chat.AliasesRequest')
    def divulge_aliases(event):  # pylint: disable=unused-variable
        logging.info('On Chat.AliasesRequest!')
        aliases = client.find_active('Chat.SelfAlias')
        logging.info(f'found {len(aliases)} Chat.SelfAlias contracts')
        mappings = [f"{cdata['user']} -> {cdata['alias']}" for _ , cdata in aliases.items()]
        mappings_str = '\n'.join(mappings)
        commands = []
        commands.append(exercise(event.cid, 'Archive', {}))
        commands.append(exercise_by_key('Chat.Chat',
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


    @client.ledger_created('Chat.User')
    def add_to_public_chats(event):  # pylint: disable=unused-variable
        logging.info('On Chat.User created!')
        if event.cdata['operator'] != client.party:
            return

        chats = client.find_active('Chat.Chat', {'isPublic': True})
        logging.info(f'found {len(chats)} public Chat.Chat contracts')
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


    @client.ledger_created('Chat.CreateChatRequest')
    def respond_to_chat_request(event):  # pylint: disable=unused-variable
        logging.info(f'On Chat.CreateChatRequest created!')
        cdata = event.cdata
        if cdata['operator'] != client.party:
            return

        user_contracts = client.find_active('Chat.User')
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


    @client.ledger_created('DABL.Ledger.V2.LedgerParty')
    def invite_user_to_chat(event):  # pylint: disable=unused-variable
        logging.info(f'On DABL.Ledger.V2.LedgerParty created!')
        cdata = event.cdata
        if cdata['party'] == client.party:
            return

        logging.info(f"Inviting {cdata['partyName']} ({cdata['party']}) to DABL Chat")

        return dazl.exercise_by_key('Chat.Operator', client.party, 'OperatorInviteUser', {
            'user': cdata['party']
        })

    network.run_forever()


if __name__ == '__main__':
    main()
