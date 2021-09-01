DIT_NAME=$(shell ddit targetname)
BASENAME=$(shell ddit targetname --basename)
VERSION=$(shell ddit ditversion)
BOT_VERSION=$(shell ddit ditversion | sed "s/-rc./rc/")

NAME=${BASENAME}-${VERSION}

PKG_FILES=$(shell find pkg -type f)

PYTHON := pipenv run python

operator_bot := target/daml-chat-operator-bot-$(BOT_VERSION).tar.gz
user_bot := target/daml-chat-user-bot-$(BOT_VERSION).tar.gz
ui := target/daml-chat-ui-$(VERSION).zip

.PHONY: all package publish

all: package

publish: package
	ddit release

package: ${DIT_NAME}

${DIT_NAME}: target dit-meta.yaml ${PKG_FILES} $(operator_bot) $(user_bot) $(ui)
	ddit build \
	   --subdeployment $(operator_bot) $(user_bot) $(ui)

target:
	mkdir $@

$(operator_bot):
	cd python/operator && BOT_VERSION=$(BOT_VERSION) $(PYTHON) setup.py sdist
	rm -fr python/operator/daml_chat_operator_bot.egg-info
	mkdir -p $(@D)
	mv python/operator/dist/daml-chat-operator-bot-$(BOT_VERSION).tar.gz $@
	rm -r python/operator/dist

$(user_bot):
	cd python/user && BOT_VERSION=$(BOT_VERSION) $(PYTHON) setup.py sdist
	rm -fr python/user/daml_chat_user_bot.egg-info
	mkdir -p $(@D)
	mv python/user/dist/daml-chat-user-bot-$(BOT_VERSION).tar.gz $@
	rm -r python/user/dist

$(ui): $(user_bot)
	yarn install
	REACT_APP_ARCHIVE_BOT_HASH=$(shell sha256sum $(user_bot) | awk '{print $$1}') yarn build
	zip -r daml-chat-ui-$(VERSION).zip build
	mkdir -p $(@D)
	mv daml-chat-ui-$(VERSION).zip $@
	rm -r build

.PHONY: clean
clean:
	rm -fr \
       python/operator/daml_chat_operator_bot.egg-info python/operator/dist \
       python/user/daml_chat_user_bot.egg-info python/user/dist \
       target *.tmp *.dit *.dar
