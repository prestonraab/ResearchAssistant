#!/bin/bash
# Wrapper for docling-mcp - runs from /tmp to avoid reading workspace .env file
cd /tmp
exec uvx --from=docling-mcp docling-mcp-server "$@"
