VERSION=4.0.0

python := poetry run python

pkg_bot := dist/daml-chat-$(VERSION).tar.gz
pkg_dit := daml-chat-$(VERSION).dit

pkg_bot := dist/daml_chat-$(VERSION).tar.gz
pkg_ui := dist/web.zip
all_pkgs := $(pkg_bot) $(pkg_ui)

daml_src := daml.yaml $(shell find daml -name '*.daml')

.PHONY: all
all: package

.PHONY: clean
clean:
	rm -fr .daml dist "$(pkg_dit)"

.PHONY: format
format: node_modules/package.json .venv/poetry.lock
	poetry run isort python
	poetry run black python
	npm run format

.PHONY: test
test: .venv/poetry.lock
	poetry run isort python --check-only
	poetry run black python --check-only
	npm run format-test
	daml test

.venv/poetry.lock:
	poetry install
	cp poetry.lock "$@"

node_modules/package.json:
	npm install
	cp package.json "$@"

.PHONY: build
build: $(all_pkgs)

.PHONY: build-bot
build-bot: $(pkg_bot)
$(pkg_bot): .venv/poetry.lock pyproject.toml $(shell find python -name '*.py' -type f)
	poetry build -f sdist

.PHONY: build-ui
build-ui: $(pkg_ui)
$(pkg_ui): node_modules/package.json $(daml_src)
	npm run build
	(cd "$(@D)" && zip -r "$(@F)" web)

.PHONY: run-ledger
run-ledger:
	daml start

.PHONY: run-bot
run-bot: .venv/poetry.lock
	DAML_LEDGER_URL="http://localhost:6865" poetry run python -m bot

.PHONY:
run-ui: node_modules/package.json .venv/poetry.lock
	npm run build
	poetry run python3 -m http.server -d dist/web

.PHONY: package
package: $(pkg_dit)
$(pkg_dit): .venv/poetry.lock dit-meta.yaml $(all_pkgs)
	@# $(pkg_dar) is intentionally left out because ddit includes it for free
	-rm "$(pkg_dit)"
	poetry run ddit build --subdeployment $(all_pkgs)

.PHONY: publish
publish: .venv/poetry.lock $(pkg_dit)
	poetry run ddit release
