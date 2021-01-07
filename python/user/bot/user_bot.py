import datetime
import logging
import os
import asyncio
import dazl
import math
from dazl import exercise, ContractId
import heapq
from dataclasses import dataclass

dazl.setup_default_logger(logging.INFO)

EPOCH = datetime.datetime.utcfromtimestamp(0)


class Chat:
    ArchiveMessagesRequest = 'Chat.V3:ArchiveMessagesRequest'
    Message = 'Chat.V3:Message'
    UserSettings = 'Chat.V3:UserSettings'


@dataclass(frozen=True)
class Message:
    post_at: int
    cid: 'ContractId'

    def __lt__(self, other):
        return self.post_at < other.post_at


# default to 14 days as defined in DAML
archive_after = 1209600
message_heap: '[Message]' = []
bot_polling_sec = 2

def main():
    url = os.getenv('DAML_LEDGER_URL')
    party = os.getenv('DAML_LEDGER_PARTY')

    network = dazl.Network()
    network.set_config(url=url)

    logging.info(f'starting a the user_bot for party {party}')
    client = network.aio_party(party)

    def expired(after: int, posted_at: int) -> bool:
        return (datetime.datetime.fromtimestamp(posted_at) + datetime.timedelta(
            seconds=after)) < datetime.datetime.now()

    @client.ledger_ready()
    async def bot_ready(_):
        global message_heap
        global archive_after

        existing_messages = client.find_active(Chat.Message, {'sender': client.party})
        message_heap = [Message(int(cdata['postedAt']), cid)
                        for cid, cdata in existing_messages.items()]
        heapq.heapify(message_heap)
        logging.info(f"Message cache loaded.")

        (_, settings_cdata) = await client.find_one(Chat.UserSettings, {'user': client.party})
        archive_after = (settings_cdata['archiveMessagesAfter'])

        # initial scan
        while len(message_heap) > 0:
            top = message_heap[0]
            if not expired(archive_after, top.post_at):
                logging.info("Auto-archiving caught up.")
                break
            logging.info(f"Auto-archiving {top.cid} posted at {top.post_at}")
            await client.submit(exercise(top.cid, 'Archive'))
            heapq.heappop(message_heap)

        logging.info(f'started auto-archiving bot for party {party}')
        while True:
            try:
                while len(message_heap) > 0 and expired(archive_after, message_heap[0].post_at):
                    top = message_heap[0]
                    logging.info(f'archiving {Chat.Message}:{top.cid} staled for {archive_after}s')
                    await client.submit(exercise(top.cid, 'Archive'))
                    heapq.heappop(message_heap)
                    logging.info(f'{Chat.Message}:{top.cid} archived.')
                    logging.info(f'waiting for next message to archive: {top.cid}')
            except:
                logging.error(f"Could not auto archive messages")
            await asyncio.sleep(bot_polling_sec)

    @client.ledger_created(Chat.ArchiveMessagesRequest)
    async def archive_stale_messages(event):
        logging.info(f'On {Chat.ArchiveMessagesRequest} created!')
        try:
            (_, settings_cdata) = await client.find_one(Chat.UserSettings, {'user': client.party})
            user_messages = client.find_active(Chat.Message, {'sender': client.party})
            commands = [exercise(cid, 'Archive') for (cid, cdata) in user_messages.items() if
                        expired(settings_cdata['archiveMessagesAfter'], int(cdata['postedAt']))]
            logging.info(f"Will archive {len(commands)} message(s)")
            commands.append(exercise(event.cid, 'Archive'))
            await client.submit(commands)
        except:
            logging.error(f"Could not archive stale messages")
            await client.submit_exercise(event.cid, 'Archive')

    @client.ledger_created(Chat.Message)
    async def message_heapify(event):
        global message_heap
        logging.info(f'On {Chat.Message} created')
        if event.cdata['sender'] == client.party:
            logging.info(f'New {Chat.Message} archive candidate added.')
            heapq.heappush(message_heap,
                           Message(int(event.cdata['postedAt']), event.cid))

    @client.ledger_created(Chat.UserSettings)
    async def archive_bot(event):
        global archive_after
        archive_after = event.cdata['archiveMessagesAfter']
        logging.info(f"New auto archiving setting: {archive_after}s")

    network.run_forever()


if __name__ == '__main__':
    main()
