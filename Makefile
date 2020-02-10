PYTHON := pipenv run python
dar_version := $(shell grep "^version" daml.yaml | sed 's/version: //g')
bot_version := $(shell pipenv run python python/setup.py --version)
ui_version := $(shell node -p "require(\"./package.json\").version")
dar := target/dablchat-model-$(dar_version).dar
bot := target/dablchat-bot-$(bot_version).tar.gz
ui := target/dablchat-ui-$(ui_version).zip

.PHONY: package
package: $(bot) $(dar) $(ui)
	cd target && zip dabl-chat.zip * && rm dablchat*


$(dar):
	daml build
	mkdir -p $(@D)
	mv .daml/dist/*.dar $@


$(bot):
	cd python && $(PYTHON) setup.py sdist
	rm -fr python/dablchat_bot.egg-info
	mkdir -p $(@D)
	mv python/dist/dablchat-bot-$(bot_version).tar.gz $@
	rm -r python/dist


$(ui):
	yarn install
	yarn build
	zip -r dablchat-ui-$(ui_version).zip build
	mkdir -p $(@D)
	mv dablchat-ui-$(ui_version).zip $@
	rm -r build

.PHONY: clean
clean:
	rm -fr python/dablchat_bot.egg-info python/dist target/*
