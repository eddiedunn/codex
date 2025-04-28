// Minimal MCP mock server for integration testing (stdio, CJS, no SDK)
// Compatible with MCP protocol: https://github.com/modelcontextprotocol/modelcontextprotocol
// Usage: node dist/utils/agent/mcp-mock-server.js

const readline = require('readline');

// --- Mock Data ---
const resources = [
  {
    uri: 'mock://resource/1',
    name: 'Mock Resource',
    description: 'A mock resource for testing',
    mimeType: 'text/plain',
  }
];

const tools = [
  {
    name: 'echo',
    description: 'Echoes the input message',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
      required: ['message'],
    },
  },
  {
    name: 'error_tool',
    description: 'Always returns a tool-level error',
    parameters: {
      type: 'object',
      properties: {
        fail: { type: 'boolean' },
      },
      required: ['fail'],
    },
  },
];

// --- JSON-RPC 2.0 Handler ---
function handleRequest(req) {
  if (!req || typeof req !== 'object' || req.jsonrpc !== '2.0' || !req.method) {
    return {
      jsonrpc: '2.0',
      id: req && req.id !== undefined ? req.id : null,
      error: { code: -32600, message: 'Invalid Request' },
    };
  }
  if (req.method === 'resources/list') {
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: resources,
    };
  }
  if (req.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: tools,
    };
  }
  if (req.method === 'tools/call') {
    const { name, arguments: args } = req.params || {};
    if (name === 'echo') {
      // Strict argument validation
      if (
        typeof args !== 'object' ||
        args === null ||
        Array.isArray(args) ||
        typeof args.message !== 'string'
      ) {
        return {
          jsonrpc: '2.0',
          id: req.id,
          error: { code: -32602, message: 'Invalid arguments: expected { message: string }' },
        };
      }
      return {
        jsonrpc: '2.0',
        id: req.id,
        result: { message: args.message },
      };
    } else if (name === 'error_tool') {
      // Simulate a tool-level error (not a protocol error)
      return {
        jsonrpc: '2.0',
        id: req.id,
        result: {
          isError: true,
          mcpToolError: true,
          message: 'Simulated tool error',
        },
      };
    } else {
      return {
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32601, message: `Unknown tool: ${name}` },
      };
    }
  }
  return {
    jsonrpc: '2.0',
    id: req.id,
    error: { code: -32601, message: `Unknown method: ${req.method}` },
  };
}

// --- Main Loop ---
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
rl.on('line', (line) => {
  let req;
  try {
    req = JSON.parse(line);
  } catch (e) {
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
    return;
  }
  const res = handleRequest(req);
  process.stdout.write(JSON.stringify(res) + '\n');
});
