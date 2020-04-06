import os
import logging
import uuid
import datetime
import time

import dazl
from dazl import create, exercise, exercise_by_key

dazl.setup_default_logger(logging.INFO)

EPOCH = datetime.datetime.utcfromtimestamp(0)

class CHAT:
    ArchiveMessagesRequest = 'Chat.V1.ArchiveMessagesRequest'
    Message = 'Chat.V1.Message'
    UserSettings = 'Chat.V1.UserSettings'


def main():
    url = os.getenv('DAML_LEDGER_URL')
    party = os.getenv('DAML_LEDGER_PARTY')

    network = dazl.Network()
    network.set_config(url=url)

    logging.info(f'starting a the user_bot for party {party}')
    client = network.aio_party(party)

    @client.ledger_ready()
    def bot_ready(event):  # pylint: disable=unused-variable
        logging.info(f'user_bot for party {party} is ready')


    @client.ledger_created(CHAT.ArchiveMessagesRequest)
    async def archive_stale_messages(event):  # pylint: disable=unused-variable
        logging.info(f'On {CHAT.ArchiveMessagesRequest} created!')
        try:
            (_, settings_cdata) = await client.find_one(CHAT.UserSettings, { 'user': client.party })
            time_thresh = datetime.datetime.now() - datetime.timedelta(days=settings_cdata['archiveMessagesAfter'])
            thresh_seconds = (time_thresh - EPOCH).total_seconds()
            logging.info(f"time_thresh: {time_thresh}, thresh_seconds: {thresh_seconds}")
            user_messages = client.find_active(CHAT.Message, { 'sender': client.party })
            commands = [exercise(cid, 'Archive') for (cid, cdata) in user_messages.items() if int(cdata['postedAt']) < thresh_seconds]
            logging.info(f"Will archive {len(commands)} message(s)")
            commands.append(exercise(event.cid, 'Archive'))
            await client.submit(commands)
        except:
            logging.error(f"Could not archive stale messages")
            await client.submit_exercise(event.cid, 'Archive')

    network.run_forever()


if __name__ == '__main__':
    main()
