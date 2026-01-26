#!/usr/bin/env node

/**
 * Simple wrapper to call citation MCP tools from the extension
 * Usage: node call_citation_mcp.js <tool_name> <json_args>
 */

const { spawn } = require('child_process');
const path = require('path');

const CITATION_MCP_PATH = path.join(__dirname, 'citation-mcp-server', 'dist', 'index.js');

async function callMcpTool(toolName, args) {
  return new Promise((resolve, reject) => {
    const mcp = spawn('node', [CITATION_MCP_PATH], {
      env: {
        ...process.env,
        CITATION_WORKSPACE_ROOT: __dirname,
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    mcp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    mcp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    mcp.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`MCP process exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Parse JSONRPC messages from stdout
        const lines = stdout.split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);
            if (msg.result) {
              resolve(msg.result);
              return;
            }
          } catch (e) {
            // Skip non-JSON lines
          }
        }
        reject(new Error('No result found in MCP response'));
      } catch (error) {
        reject(error);
      }
    });

    // Send JSONRPC request
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };

    mcp.stdin.write(JSON.stringify(request) + '\n');
    mcp.stdin.end();
  });
}

// Main
if (require.main === module) {
  const toolName = process.argv[2];
  const argsJson = process.argv[3];

  if (!toolName || !argsJson) {
    console.error('Usage: node call_citation_mcp.js <tool_name> <json_args>');
    process.exit(1);
  }

  let args;
  try {
    args = JSON.parse(argsJson);
  } catch (error) {
    console.error('Invalid JSON arguments:', error.message);
    process.exit(1);
  }

  callMcpTool(toolName, args)
    .then(result => {
      console.log(JSON.stringify(result));
      process.exit(0);
    })
    .catch(error => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}

module.exports = { callMcpTool };
