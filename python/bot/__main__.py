import asyncio
import logging
import os

import damlchat
import dazl

url = os.getenv("DAML_LEDGER_URL")
party = os.getenv("DAML_LEDGER_PARTY")
public_party = os.getenv("DABL_PUBLIC_PARTY")

dazl.setup_default_logger(logging.INFO)
asyncio.run(damlchat.main(url, party, public_party))
