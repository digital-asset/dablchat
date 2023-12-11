VERSION=4.0.0

python := poetry run python

pkg_dar := .daml/dist/daml-chat-$(VERSION).dar
pkg_bot := dist/daml-chat-$(VERSION).tar.gz
pkg_dit := daml-chat-$(VERSION).ddit

.PHONY: all
all: package

.PHONY: clean
clean:
	rm -fr .daml dist

.PHONY: format
format: .venv/poetry.lock
	poetry run isort python
	poetry run black python

.PHONY: test
test: .venv/poetry.lock
	poetry run isort python --check-only
	poetry run black python --check-only
	daml test

.venv/poetry.lock:
	poetry install
	cp poetry.lock "$@"

.PHONY: build
build: $(pkg_dar) $(pkg_bot)

$(pkg_bot): pyproject.toml $(shell find python -name '*.py' -type f)
	poetry build -f sdist

$(pkg_dar): daml.yaml $(shell find daml -name '*.daml' -type f)
	daml build

.PHONY: package
package: $(pkg_dit)
$(pkg_dit): dit-meta.yaml $(pkg_bot) $(pkg_bot)
	poetry run ddit build \
	   --subdeployment $(pkg_bot) $(pkg_bot)

# $(ui): $(user_bot)
# 	npm install
# 	REACT_APP_ARCHIVE_BOT_HASH=$(shell sha256sum $(user_bot) | awk '{print $$1}') npm build
# 	zip -r daml-chat-ui-$(VERSION).zip build
# 	mkdir -p $(@D)
# 	mv daml-chat-ui-$(VERSION).zip $@
# 	rm -r build

.PHONY: publish
publish: package
	poetry run ddit release
