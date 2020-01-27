<img src="./src/icons/chatface.svg" width="20%" height="auto">

# DABL Chat
[![Download](https://img.shields.io/github/release/digital-asset/dablchat.svg)](https://github.com/digital-asset/dablchat/releases/latest)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![CircleCI](https://circleci.com/gh/digital-asset/dablchat.svg?style=svg)](https://circleci.com/gh/digital-asset/dablchat)

Welcome to DABL Chat! A DAML app that can be deployed to [project:DABL](https://projectdabl.com/).

> Copyright (c) 2020, Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved. SPDX-License-Identifier: Apache-2.0

## Prerequisites
- The [DAML SDK](https://docs.daml.com/getting-started/installation.html)
- Python 3.6 or later
- Pipenv
- Git
- yarn
- A [project:DABL](https://projectdabl.com/) account
> ℹ️ If you are only interested in deploying DABL Chat, then all you need is a [project:DABL](https://projectdabl.com/) account!


## Getting Started

### 1. Create a ledger to run DABL Chat on

Log in to [project:DABL](https://projectdabl.com/) and create a new ledger under an existing or a new project.

> ℹ️ Steps 2 and 3 are only necessary if you want to build the source code. If all you care about is deploying the app then download [dabl-chat.zip](https://github.com/digital-asset/dablchat/releases/latest/download/dabl-chat.zip) and proceed to step 4.

### 2. Clone this repo

```bash
git clone https://github.com/digital-asset/dablchat.git
```

### 3. Build your DAML model and automation

```bash
make clean && make package
```
This will create a versioned `dablchat-x.x.x.dar` file containing the compiled DAML model a `dablchat-bot-x.x.x.tar.gz` tarball containing the python automation and a `dablchat-ui-x.x.x.zip` archive containing the UI static assets. These files will be zipped into a `dabl-chat.zip` under the `target/` directory

### 4. Upload and deploy to DABL

Unzip and upload the three files to your [project:DABL](https://projectdabl.com/) collections.
Then drag and drop the each one of them to your newly created ledger.

### 5. Set up your automation and UI

Click on your ledger and navigate to the _Automation_ tab. Click on `change` next to _Running as:_ and redeploy the bot as your user. Then go to _UI Assets_ and click on `Publish` next to `dablchat-ui-x.x.x.zip` to host your static assets.

### 6. Invite your users

In the _Live Data_ tab of your ledger confirm that a `Chat:Operator` contract has been created under your username. Click on _Add Party_ and start adding the users you want. Each user you added should now have a `DABL.Ledger.V2:LedgerParty` contract as well as a `Chat:UserInvitation` contract.

### 7. Log in and start chatting!

You can find the subdomain url of your DABL Chat app in the _UI Assets_ tab. Each user you added can now navigate to that URL and use their name and JWT token (found in the _Ledger Settings_ tab) to log in and start chatting!


## Credits
The UI portion of this app was inspired by [React Direct Messaging Example by Pusher](https://pusher.com/tutorials/react-direct-messaging).
