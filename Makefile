# dsh-file-explorer-preview-code — install & deploy helpers
#
# Quick start:
#   make            # list all targets (default)
#   make install    # install npm dependencies
#   make deploy     # build + register this plugin in the DSH profile
#   make run        # boot `dsh web`
#
# The plugin depends on the core dsh-file-explorer, which must be present in
# the profile first (see `make core`).

.DEFAULT_GOAL := help

PROFILE    ?= web
DSH        ?= dsh
NPM        ?= npm
# A repo-local npm cache keeps `npm install` working even when the user-level
# cache (~/.npm) sits on a read-only filesystem; it is gitignored. Override via
# `make install NPM_CACHE=/path/to/cache`.
NPM_CACHE  ?= $(CURDIR)/.npm-cache

# Required core plugin + this plugin's id in the profile.
CORE_PLUGIN := github:wolfsonliu/dsh-file-explorer
PLUGIN_ID   := @dsh-external/dsh-file-explorer-preview-code

.PHONY: help install build check test core deploy undeploy run clean

## help      — list available targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed -E 's/^## //'

## install   — install npm dependencies into node_modules/
install:
	$(NPM) install --no-audit --no-fund --cache "$(NPM_CACHE)"

## build     — type-check and bundle (tsc + tsdown → lib/)
build:
	$(NPM) run build

## check     — type-check src/ only (tsc --noEmit)
check:
	$(NPM) run check

## test      — run the vitest suite
test:
	$(NPM) test

## core      — register the required dsh-file-explorer core in the profile
core:
	$(DSH) plugin --profile $(PROFILE) add $(CORE_PLUGIN)

## deploy    — build and register this plugin in the DSH profile
deploy: build
	$(DSH) plugin --profile $(PROFILE) add .

## undeploy  — remove this plugin from the DSH profile
undeploy:
	$(DSH) plugin --profile $(PROFILE) remove $(PLUGIN_ID)

## run       — boot the DSH web profile (dsh web)
run:
	$(DSH) web

## clean     — remove node_modules (and the local npm cache)
clean:
	rm -rf node_modules "$(NPM_CACHE)"