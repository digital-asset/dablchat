PYTHON := pipenv run python
dar_version := $(shell grep "^version" daml.yaml | sed 's/version: //g')
operator_bot_version := $(shell pipenv run python python/operator/setup.py --version)
user_bot_version := $(shell pipenv run python python/user/setup.py --version)
ui_version := $(shell node -p "require(\"./package.json\").version")
dar := target/dablchat-model-$(dar_version).dar
operator_bot := target/dablchat-operator-bot-$(operator_bot_version).tar.gz
user_bot := target/dablchat-user-bot-$(user_bot_version).tar.gz
ui := target/dablchat-ui-$(ui_version).zip

.PHONY: package
package: $(operator_bot) $(user_bot) $(dar) $(ui)
	cd target && zip dabl-chat.zip * && rm dablchat*


$(dar):
	daml build
	mkdir -p $(@D)
	mv .daml/dist/*.dar $@


$(operator_bot):
	cd python/operator && $(PYTHON) setup.py sdist
	rm -fr python/operator/dablchat_operator_bot.egg-info
	mkdir -p $(@D)
	mv python/operator/dist/dablchat-operator-bot-$(operator_bot_version).tar.gz $@
	rm -r python/operator/dist


$(user_bot):
	cd python/user && $(PYTHON) setup.py sdist
	rm -fr python/user/dablchat_user_bot.egg-info
	mkdir -p $(@D)
	mv python/user/dist/dablchat-user-bot-$(user_bot_version).tar.gz $@
	rm -r python/user/dist


$(ui):
	yarn install
	yarn build
	zip -r dablchat-ui-$(ui_version).zip build
	mkdir -p $(@D)
	mv dablchat-ui-$(ui_version).zip $@
	rm -r build

.PHONY: clean
clean:
	rm -fr python/operator/dablchat_operator_bot.egg-info python/operator/dist target/*
