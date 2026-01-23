#!/usr/bin/env python3
"""
Helper script to call Zotero MCP semantic search from VS Code extension.
This bridges the gap between the extension and MCP server.
"""

import json
import sys
import subprocess
import os
from pathlib import Path


def call_zotero_semantic_search(query: str, limit: int = 5) -> list:
    """
    Call the Zotero MCP semantic search tool via the zotero-mcp command.
    
    Args:
        query: Search query text
        limit: Maximum number of results
        
    Returns:
        List of search results
    """
    print(f"Searching Zotero for: {query}", file=sys.stderr)
    print(f"Limit: {limit}", file=sys.stderr)
    
    # Set up environment variables for Zotero MCP
    env = os.environ.copy()
    env['ZOTERO_LOCAL'] = 'true'
    env['ZOTERO_API_KEY'] = 'GUOgaVLYkmdtLo568hwvSBPc'
    env['ZOTERO_USER_ID'] = '13215183'
    
    # Create MCP request for semantic search
    mcp_request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "zotero_semantic_search",
            "arguments": {
                "query": query,
                "limit": limit
            }
        }
    }
    
    try:
        # Call zotero-mcp via subprocess
        process = subprocess.Popen(
            ['zotero-mcp'],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
            text=True
        )
        
        # Send request
        stdout, stderr = process.communicate(input=json.dumps(mcp_request) + '\n', timeout=30)
        
        if stderr:
            print(f"MCP stderr: {stderr}", file=sys.stderr)
        
        # Parse response
        if stdout:
            # MCP servers may send multiple JSON-RPC messages
            # Parse the last complete JSON object
            lines = stdout.strip().split('\n')
            for line in reversed(lines):
                try:
                    response = json.loads(line)
                    if 'result' in response:
                        # Extract content from MCP response
                        result = response['result']
                        if isinstance(result, dict) and 'content' in result:
                            content = result['content']
                            if isinstance(content, list) and len(content) > 0:
                                # Parse the text content which should be JSON
                                text_content = content[0].get('text', '[]')
                                return json.loads(text_content)
                        elif isinstance(result, list):
                            return result
                        elif isinstance(result, str):
                            return json.loads(result)
                except json.JSONDecodeError:
                    continue
        
        print("No valid response from MCP server", file=sys.stderr)
        return []
        
    except subprocess.TimeoutExpired:
        print("MCP request timed out", file=sys.stderr)
        process.kill()
        return []
    except FileNotFoundError:
        print("zotero-mcp command not found. Is it installed?", file=sys.stderr)
        return []
    except Exception as e:
        print(f"Error calling MCP: {e}", file=sys.stderr)
        return []


def main():
    if len(sys.argv) != 3:
        print("Usage: call_zotero_mcp.py <query_file> <result_file>", file=sys.stderr)
        sys.exit(1)
    
    query_file = Path(sys.argv[1])
    result_file = Path(sys.argv[2])
    
    # Read query
    try:
        with open(query_file, 'r') as f:
            query_data = json.load(f)
        
        query = query_data.get('query', '')
        limit = query_data.get('limit', 5)
        
        if not query:
            raise ValueError("No query provided")
        
    except Exception as e:
        print(f"Error reading query file: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Execute search
    try:
        results = call_zotero_semantic_search(query, limit)
        
        # Write results
        with open(result_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"Found {len(results)} results", file=sys.stderr)
        
    except Exception as e:
        print(f"Error executing search: {e}", file=sys.stderr)
        # Write empty results on error
        with open(result_file, 'w') as f:
            json.dump([], f)
        sys.exit(1)


if __name__ == '__main__':
    main()
