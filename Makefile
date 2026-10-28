.PHONY: help platform-dev contracts-dev deps test-deps types test conformance drift ci bundle typecheck gates clean

# The program tuple this app builds/tests against (AD-31/AD-34). v0.3.0 is the
# REQ-008 adoption tuple and is LOCAL-ONLY in this run: local gates symlink it
# from .dev/ (gitignored), CI checks out the tags explicitly once published.
AGS_PLATFORM_VERSION := v0.3.0
CONTRACTS_VERSION := v0.3.0
AGS_PLATFORM_REPO := https://github.com/RandomGenericUsername/ags-platform.git
AGS_PLATFORM_DEV ?=
PLATFORM_FETCH_DIR := $(CURDIR)/.dev/ags-platform/$(AGS_PLATFORM_VERSION)
PLATFORM_SRC := $(if $(AGS_PLATFORM_DEV),$(AGS_PLATFORM_DEV),$(PLATFORM_FETCH_DIR))
CONTRACTS_FETCH_DIR := $(CURDIR)/.dev/contracts/$(CONTRACTS_VERSION)
CONTRACTS_ROOT ?= $(CONTRACTS_FETCH_DIR)
BUNDLE_FILE := build/ags-bar.js
TEST_TSCONFIG := tests/tsconfig.tests.json
PLATFORM_TSCONFIG := tsconfig.app.json

help:
	@echo "make test         pure unit + validation suites (Node only; stock runner)"
	@echo "make conformance  manifest + restart/no-handler + template conformance"
	@echo "make drift        generated contract + shared client <-> contracts gate"
	@echo "make typecheck    desktop-stack tsc gate (LOCAL; needs ags + GIR)"
	@echo "make bundle       ags bundle smoke build (LOCAL; needs ags)"
	@echo "make ci           stock-runner gate: test + conformance + drift"
	@echo "make gates        all gates: test + conformance + drift + bundle + typecheck"
	@echo ""
	@echo "Local-only v0.3.0 tuple: put checkouts/symlinks at"
	@echo "  .dev/ags-platform/v0.3.0  (or AGS_PLATFORM_DEV=/path/to/ags-platform)"
	@echo "  .dev/contracts/v0.3.0     (or CONTRACTS_ROOT=/path/to/contracts)"

# The platform shortcut. It MUST point outside node_modules: Node refuses to
# type-strip `.ts` under a real node_modules directory, but realpaths a symlink
# whose target sits outside. AGS's esbuild resolves the same bare specifier.
platform-dev:
	@mkdir -p "$(dir $(PLATFORM_FETCH_DIR))" node_modules
	@src=""; \
	if [ -n "$(AGS_PLATFORM_DEV)" ]; then \
		src="$(AGS_PLATFORM_DEV)"; \
	elif [ -f "$(PLATFORM_FETCH_DIR)/index.ts" ]; then \
		src="$(PLATFORM_FETCH_DIR)"; \
	elif [ -f "$(CURDIR)/../ags-platform/index.ts" ]; then \
		echo "==> platform-dev: linking local ags-platform checkout at $(PLATFORM_FETCH_DIR)"; \
		ln -sfn ../../../ags-platform "$(PLATFORM_FETCH_DIR)"; \
		src="$(PLATFORM_FETCH_DIR)"; \
	else \
		echo "==> platform-dev: fetching ags-platform $(AGS_PLATFORM_VERSION) (shallow)"; \
		rm -rf "$(PLATFORM_FETCH_DIR)"; \
		git clone --depth 1 --branch $(AGS_PLATFORM_VERSION) $(AGS_PLATFORM_REPO) "$(PLATFORM_FETCH_DIR)" || exit 1; \
		rm -rf "$(PLATFORM_FETCH_DIR)/.git"; \
		src="$(PLATFORM_FETCH_DIR)"; \
	fi; \
	[ -f "$$src/index.ts" ] || { echo "FAIL: platform-dev: $$src/index.ts is missing" >&2; exit 1; }; \
	ln -sfn "$$src" node_modules/ags-platform; \
	echo "==> platform-dev: node_modules/ags-platform -> $$src"

# The contracts checkout is a test-time dependency only. Link the local sibling
# checkout under .dev/ (gitignored) the same way as the platform; CI overrides
# CONTRACTS_ROOT with its explicit checkout.
contracts-dev:
	@mkdir -p "$(dir $(CONTRACTS_FETCH_DIR))"
	@if [ ! -e "$(CONTRACTS_FETCH_DIR)" ] && [ -f "$(CURDIR)/../contracts/schemas/ags-app-manifest.schema.json" ]; then \
		echo "==> contracts-dev: linking local contracts checkout at $(CONTRACTS_FETCH_DIR)"; \
		ln -sfn ../../../contracts "$(CONTRACTS_FETCH_DIR)"; \
	fi

# TypeScript for the local typecheck and the stock test typecheck. Installed
# --no-save so no lockfile or node_modules is committed.
deps:
	@if [ ! -x node_modules/.bin/tsc ]; then \
		echo "==> deps: installing typescript@5.9 (npm install --no-save, gitignored)"; \
		npm install --no-save --no-package-lock typescript@5.9 >/dev/null || exit 1; \
	fi

# @types/node belongs to the TEST program only. It is installed as a sibling of
# tests/tsconfig.tests.json (tsc's typeRoots walk starts there and walks up),
# never into the app program's ambient surface.
test-deps: deps
	@if [ ! -d tests/node_modules/@types/node ]; then \
		echo "==> test-deps: installing @types/node@24 under tests/ (gitignored)"; \
		npm install --no-save --no-package-lock --prefix tests @types/node@24 >/dev/null || exit 1; \
	fi

# Machine-specific GIR declarations, generated for THIS host. `ags types`
# writes @girs/, env.d.ts and its own tsconfig.json (all gitignored); the
# committed typecheck config is tsconfig.app.json precisely to survive that.
types:
	@command -v ags >/dev/null || { echo "FAIL: types: ags is not on PATH (desktop stack)" >&2; exit 1; }
	@if [ -d "@girs" ]; then \
		echo "==> types: @girs/ already generated, skipping (rm -rf @girs to force)"; \
	else \
		echo "==> types: generating this host's GIR declarations"; \
		ags types -d "$(CURDIR)" -u || exit 1; \
	fi

# Pure unit tests + validation suites + the symbol check. Node's native type
# stripping runs the app's real .ts modules; nothing reachable imports `gi://*`
# or `ags/*` in the ts suite (the tests tsconfig's module list is the purity
# contract). No desktop stack.
test: test-deps platform-dev
	@command -v node >/dev/null || { echo "FAIL: test: node is not on PATH" >&2; exit 1; }
	@[ -x node_modules/.bin/tsc ] || { echo "FAIL: test: typescript missing after deps" >&2; exit 1; }
	@[ -d tests/node_modules/@types/node ] || { echo "FAIL: test: @types/node missing after test-deps" >&2; exit 1; }
	@echo "==> test: node --import ./tests/ts/resolve-hooks.mjs --test tests/ts/*.test.ts"
	node --import ./tests/ts/resolve-hooks.mjs --test tests/ts/*.test.ts
	@echo "==> test: node --test tests/validation/*.test.mjs"
	node --test tests/validation/*.test.mjs
	@echo "==> test: node tests/ags-symbol-check.mjs"
	node tests/ags-symbol-check.mjs
	@echo "==> test: tsc --noEmit -p $(TEST_TSCONFIG)"
	npx tsc --noEmit -p "$(TEST_TSCONFIG)"
	@echo "    OK: 0 type errors in the pure-module test program"

# Manifest/restart/template conformance. The platform's own checkAppRepo gate
# plus the app-specific identity, restart-mode and request-surface assertions.
conformance: platform-dev contracts-dev
	@command -v node >/dev/null || { echo "FAIL: conformance: node is not on PATH" >&2; exit 1; }
	@[ -f "$(CONTRACTS_ROOT)/schemas/ags-app-manifest.schema.json" ] || { \
		echo "FAIL: conformance: no contracts schema at $(CONTRACTS_ROOT) (set CONTRACTS_ROOT)" >&2; exit 1; }
	@echo "==> conformance: node --test tests/app-contract.test.mjs"
	CONTRACTS_ROOT="$(CONTRACTS_ROOT)" node --test tests/app-contract.test.mjs

# Contract drift: the vendored generated contract and the shared event client
# against the canonical contracts v0.3.0 checkout. Stock runner.
drift: platform-dev contracts-dev
	@command -v node >/dev/null || { echo "FAIL: drift: node is not on PATH" >&2; exit 1; }
	@[ -f "$(CONTRACTS_ROOT)/event-contract.json" ] || { \
		echo "FAIL: drift: no event-contract.json at $(CONTRACTS_ROOT) (set CONTRACTS_ROOT)" >&2; exit 1; }
	@echo "==> drift: node tests/contract-drift.mjs"
	CONTRACTS_REPO="$(CONTRACTS_ROOT)" node tests/contract-drift.mjs

# Stock-runner gate: exactly what CI runs. No AGS, no GTK, no generated GIR.
ci: test conformance drift

# AGS bundle smoke build. This catches an esbuild resolution/import error that
# the pure tests cannot see; it is a LOCAL gate because it needs the ags CLI.
bundle: platform-dev
	@command -v ags >/dev/null || { echo "FAIL: bundle: ags is not on PATH" >&2; exit 1; }
	@mkdir -p build
	@echo "==> bundle: ags bundle app.tsx $(BUNDLE_FILE)"
	ags bundle app.tsx "$(BUNDLE_FILE)"
	@[ -s "$(BUNDLE_FILE)" ] || { echo "FAIL: bundle: $(BUNDLE_FILE) is empty/missing" >&2; exit 1; }
	@echo "    OK: $(BUNDLE_FILE) ($$(wc -c < "$(BUNDLE_FILE)") bytes)"

# Desktop-stack typecheck: zero errors allowed in this repo's tree. Tolerate
# and count the AGS runtime's own /usr/share/ags/js errors (machine/GIR
# dependent) and the external platform unit's (AD-17: its own repo gates it).
typecheck: deps types platform-dev
	@[ -d "@girs" ] || { echo "FAIL: typecheck: @girs missing after types" >&2; exit 1; }
	@[ -x node_modules/.bin/tsc ] || { echo "FAIL: typecheck: typescript missing after deps" >&2; exit 1; }
	@[ -f node_modules/ags-platform/index.ts ] || { echo "FAIL: typecheck: platform link missing" >&2; exit 1; }
	@[ -e node_modules/ags ] || ln -sfn /usr/share/ags/js node_modules/ags
	@[ -e node_modules/gnim ] || ln -sfn /usr/share/ags/js/node_modules/gnim node_modules/gnim
	@echo "==> typecheck: tsc --noEmit -p $(PLATFORM_TSCONFIG)"
	@log=$$(mktemp); \
	npx tsc --noEmit -p "$(PLATFORM_TSCONFIG)" > "$$log" 2>&1; \
	ours=$$(grep 'error TS' "$$log" | grep -vF '/usr/share/ags/js/' | grep -vF 'ags-platform/' || true); \
	thirdparty=$$(grep 'error TS' "$$log" | grep -F '/usr/share/ags/js/' || true); \
	platform=$$(grep 'error TS' "$$log" | grep -F 'ags-platform/' || true); \
	echo "    tolerated third-party errors (/usr/share/ags/js): $$(printf '%s\n' "$$thirdparty" | grep -c . || true)"; \
	echo "    tolerated ags-platform errors (external unit): $$(printf '%s\n' "$$platform" | grep -c . || true)"; \
	if [ -n "$$ours" ]; then \
		echo "FAIL: type errors in the ags-bar tree:"; \
		printf '%s\n' "$$ours"; rm -f "$$log"; exit 1; \
	fi; \
	echo "    OK: 0 errors in the ags-bar tree"; \
	rm -f "$$log"

gates: test conformance drift bundle typecheck

clean:
	@rm -rf build
