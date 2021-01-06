DIT_NAME=$(shell ddit targetname)
BASENAME=$(shell ddit targetname --basename)
VERSION=$(shell ddit ditversion)

NAME=${BASENAME}-${VERSION}

PKG_FILES=$(shell find pkg -type f)

PYTHON := pipenv run python

operator_bot := target/dablchat-operator-bot-$(VERSION).tar.gz
user_bot := target/dablchat-user-bot-$(VERSION).tar.gz
ui := target/dablchat-ui-$(VERSION).zip

.PHONY: all package publish

all: package

publish: package
	ddit release

package: ${DIT_NAME}

${DIT_NAME}: target dabl-meta.yaml ${PKG_FILES} $(operator_bot) $(user_bot) $(ui)
	ddit build \
	   --subdeployment $(operator_bot) $(user_bot) $(ui)

target:
	mkdir $@

$(operator_bot):
	cd python/operator && DDIT_VERSION=$(VERSION) $(PYTHON) setup.py sdist
	rm -fr python/operator/dablchat_operator_bot.egg-info
	mkdir -p $(@D)
	mv python/operator/dist/dablchat-operator-bot-$(VERSION).tar.gz $@
	rm -r python/operator/dist

$(user_bot):
	cd python/user && DDIT_VERSION=$(VERSION) $(PYTHON) setup.py sdist
	rm -fr python/user/dablchat_user_bot.egg-info
	mkdir -p $(@D)
	mv python/user/dist/dablchat-user-bot-$(VERSION).tar.gz $@
	rm -r python/user/dist

$(ui): $(user_bot) 
	yarn install
	REACT_APP_ARCHIVE_BOT_HASH=$(shell sha256sum $(user_bot) | awk '{print $$1}') yarn build
	zip -r dablchat-ui-$(VERSION).zip build
	mkdir -p $(@D)
	mv dablchat-ui-$(VERSION).zip $@
	rm -r build

.PHONY: clean
clean:
	rm -fr \
       python/operator/dablchat_operator_bot.egg-info python/operator/dist \
       python/user/dablchat_user_bot.egg-info python/user/dist \
       target *.tmp *.dit
