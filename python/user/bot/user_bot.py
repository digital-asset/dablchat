import logging
import os
import asyncio
import dazl
from dazl import exercise, ContractId
import heapq
from dataclasses import dataclass
from datetime import timedelta, datetime
import traceback

dazl.setup_default_logger(logging.INFO)

EPOCH = datetime.utcfromtimestamp(0)
bot_polling_sec = 2


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


@dataclass
class ArchiveState:
    message_heap: '[Message]'
    archive_after: 'int'


def main():
    url = os.getenv('DAML_LEDGER_URL')
    party = os.getenv('DAML_LEDGER_PARTY')

    network = dazl.Network()
    network.set_config(url=url)

    logging.info(f'starting a the user_bot for party {party}')
    client = network.aio_party(party)

    # default to 14 days as defined in DAML
    archive_state = ArchiveState(message_heap=[],
                                 archive_after=int(timedelta(days=14).total_seconds()))

    def to_sec(time, unit) -> int:
        switch = {'s': 'seconds', 'm': 'minutes', 'h': 'hours', 'd': 'days'}
        period = switch[unit]
        return int(timedelta(**{period: time}).total_seconds())

    def expired(after: int, posted_at: int) -> bool:
        return (datetime.fromtimestamp(posted_at) + timedelta(
            seconds=after)) < datetime.now()

    async def batch_submit(commands, size):
        batched_commands = [commands[i * size:(i + 1) * size]
                            for i in range((len(commands) + size - 1) // size)]
        for cmds in batched_commands:
            await client.submit(cmds)

    @client.ledger_ready()
    async def bot_ready(_):
        existing_messages = client.find_active(Chat.Message, {'sender': client.party})
        archive_state.message_heap = [Message(cdata['postedAt'], cid)
                                      for cid, cdata in existing_messages.items()]

        message_heap = archive_state.message_heap
        heapq.heapify(message_heap)
        logging.info(f"Message cache loaded.")

        (_, settings_cdata) = await client.find_one(Chat.UserSettings, {'user': client.party})
        archive_state.archive_after = to_sec(**settings_cdata['archiveMessagesAfter'])
        logging.info(f'started auto-archiving bot for party {party}')

        while True:
            try:
                while len(message_heap) > 0 and expired(archive_state.archive_after,
                                                        message_heap[0].post_at):
                    top = message_heap[0]
                    logging.info(f'archiving {Chat.Message}:{top.cid}'
                                 f' expired after {archive_state.archive_after}s')

                    message_to_archive = client.find_by_id(top.cid)
                    if not message_to_archive or not message_to_archive.active:
                        logging.info(f'Message: {top.cid} archived somewhere else, skip.')
                        heapq.heappop(message_heap)
                        continue

                    await client.submit(exercise(top.cid, 'Archive'))
                    heapq.heappop(message_heap)
                    logging.info(f'{Chat.Message}:{top.cid} archived.')
            except:
                logging.error(f"Could not auto archive messages: {traceback.print_exc()}")
            if len(message_heap) > 0:
                logging.info(f'waiting for next message to archive: {message_heap[0].cid}')
            await asyncio.sleep(bot_polling_sec)

    @client.ledger_created(Chat.ArchiveMessagesRequest)
    async def archive_stale_messages(event):
        logging.info(f'On {Chat.ArchiveMessagesRequest} created!')
        try:
            (_, settings_cdata) = await client.find_one(Chat.UserSettings, {'user': client.party})
            user_messages = client.find_active(Chat.Message, {'sender': client.party})
            commands = [exercise(cid, 'Archive') for (cid, cdata) in user_messages.items() if
                        expired(settings_cdata['archiveMessagesAfter'], cdata['postedAt'])]
            logging.info(f"Will archive {len(commands)} message(s)")
            commands.append(exercise(event.cid, 'Archive'))
            await batch_submit(commands, 50)
        except:
            logging.error(f"Could not archive stale messages")
            await client.submit_exercise(event.cid, 'Archive')

    @client.ledger_created(Chat.Message)
    async def message_heapify(event):
        message_heap = archive_state.message_heap
        logging.info(f'On {Chat.Message} created')
        if event.cdata['sender'] == client.party:
            logging.info(f'New {Chat.Message} archive candidate added.')
            heapq.heappush(message_heap,
                           Message(event.cdata['postedAt'], event.cid))

    @client.ledger_created(Chat.UserSettings)
    async def archive_bot(event):
        archive_state.archive_after = to_sec(**event.cdata['archiveMessagesAfter'])
        logging.info(f"New auto archiving setting: {event.cdata['archiveMessagesAfter']}s")

    network.run_forever()


if __name__ == '__main__':
    main()
