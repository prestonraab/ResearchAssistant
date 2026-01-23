#!/bin/bash
# Wrapper for zotero-mcp - loads credentials from workspace .env file
set -a
source "$(dirname "$0")/.env"
set +a
exec zotero-mcp "$@"
