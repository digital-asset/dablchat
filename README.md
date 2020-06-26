<img src="./src/icons/chatface.svg" width="20%" height="auto">

# DABL Chat
[![Download](https://img.shields.io/github/release/digital-asset/dablchat.svg)](https://github.com/digital-asset/dablchat/releases/latest)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![CircleCI](https://circleci.com/gh/digital-asset/dablchat.svg?style=svg)](https://circleci.com/gh/digital-asset/dablchat)

Welcome to DABL Chat! A DAML app that can be deployed to [project:DABL](https://projectdabl.com/).

> Copyright (c) 2020, Digital Asset (Switzerland) GmbH and/or its affiliates. All rights reserved. SPDX-License-Identifier: Apache-2.0

## Getting Started

### 1. Create a ledger to run DABL Chat on

Log in to [project:DABL](https://projectdabl.com/) and create a new ledger under an existing or a new project.

> ℹ️ The rest of the steps are only necessary if you want to build the source code. If all you care about is deploying the app then you can do so by logging in to your project:DABL workspace, locating the dabl chat tile in the bottom section of the page and clicking _Add to a Project_.

### 2. Prerequisites

- Git (to clone the repository)
- The [DAML SDK](https://docs.daml.com/getting-started/installation.html) (to build the model)
- Pipenv (to select Python version)
- Python 3.6 or later (to build operator bot)
- yarn (to build UI)
- A [project:DABL](https://projectdabl.com/) account
> ℹ️ If you are only interested in deploying DABL Chat, then all you need is a [project:DABL](https://projectdabl.com/) account!


### 3. Clone this repo

```bash
git clone https://github.com/digital-asset/dablchat.git
```

### 4. Build your DAML model and automation

```bash
make clean && make package
```
This will create a versioned `dablchat-model-x.x.x.dar` file containing the compiled DAML model, a `dablchat-operator-bot-x.x.x.tar.gz` and `dablchat-user-bot-x.x.x.tar.gz` tarballs containing the python automation, and a `dablchat-ui-x.x.x.zip` archive containing the UI static assets. These files will live under the `target/` directory along with a zip archive in the form of a dabl integtation (`dabl-chat.dit`), containing all of them.

### 5. Upload and deploy to DABL

Upload the the model, bots and ui files to your [project:DABL](https://projectdabl.com/) collections.
Then drag and drop the each one of them to your newly created ledger.

### 6. Set up your automation and UI

Click on your ledger and configure the `dablchat-operator-bot` to run as the `UserAdmin` party and the `dablchat-user-bot` as your user. The `dablchat-ui-x.x.x.zip` will automatically be published to the subdomain containing your ledger id. `<your-ledger-id>.projectdabl.com`.

### 7. Check that the Operator has initialized

In the _Live Data_ tab of your ledger confirm that a `Chat:Operator` contract has been created under UserAdmin.

### 8. Log in and start chatting!

You can find the subdomain url of your DABL Chat app in the _Deployments_ tab. Share it with your users and you are ready to go!

## Credits
The UI portion of this app was inspired by [React Direct Messaging Example by Pusher](https://pusher.com/tutorials/react-direct-messaging).
