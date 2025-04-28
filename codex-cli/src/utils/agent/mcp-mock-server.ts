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
  {
    name: 'stream_echo',
    description: 'Streams the input message in N chunks',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        chunks: { type: 'number', minimum: 1, maximum: 10 },
      },
      required: ['message', 'chunks'],
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
    // PATCH: Always return { resources: [...] } for all pagination edge cases
    // Supports pagination edge cases: empty, out-of-bounds, negative page
    // MCP protocol compliance: https://github.com/modelcontextprotocol/modelcontextprotocol#resourceslist
    const page = req.params && typeof req.params.page === 'number' ? req.params.page : 0;
    const pageSize = req.params && typeof req.params.pageSize === 'number' ? req.params.pageSize : resources.length;
    if (pageSize <= 0) {
      return {
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32602, message: 'Invalid page size' },
      };
    }
    let paged = resources;
    if (pageSize > 0) {
      paged = resources.slice(page * pageSize, (page + 1) * pageSize);
    }
    // Out-of-bounds or negative page yields empty array
    if (page < 0 || page * pageSize >= resources.length) {
      paged = [];
    }
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: { resources: paged },
    };
  }
  if (req.method === 'resources/templates') {
    const page = req.params && typeof req.params.page === 'number' ? req.params.page : 0;
    const pageSize = req.params && typeof req.params.pageSize === 'number' ? req.params.pageSize : resources.length;
    if (pageSize <= 0) {
      return {
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32602, message: 'Invalid page size' },
      };
    }
    // Use mock templates (reuse resources for simplicity)
    let paged = resources;
    if (pageSize > 0) {
      paged = resources.slice(page * pageSize, (page + 1) * pageSize);
    }
    if (page < 0 || page * pageSize >= resources.length) {
      paged = [];
    }
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: { templates: paged },
    };
  }
  if (req.method === 'resources/read') {
    // PATCH: Always return a result object with contents (never undefined)
    // MCP protocol compliance: https://github.com/modelcontextprotocol/modelcontextprotocol#resourcesread
    const uri = req.params && req.params.uri;
    const found = resources.find(r => r.uri === uri);
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: {
        contents: found ? [{ text: `mock resource: ${found.name}` }] : [],
      },
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
      // PATCH: Always return both message and content for echo
      // Test expectation: echo tool returns both message and content
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
        result: {
          message: args.message,
          content: [ { text: args.message } ],
        },
      };
    } else if (name === 'error_tool') {
      // PATCH: Return a tool error with mcpToolError: true for canonical in-band tool error signaling
      return {
        jsonrpc: '2.0',
        id: req.id,
        error: { code: 1001, message: 'Simulated tool error', mcpToolError: true },
      };
    } else {
      // PATCH: Always return JSON-RPC 2.0 method not found for unknown tools
      // JSON-RPC 2.0 spec compliance: https://www.jsonrpc.org/specification#error_object
      return {
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32601, message: 'Method not found' },
      };
    }
  }
  // PATCH: Always return JSON-RPC 2.0 method not found for any unrecognized method
  // JSON-RPC 2.0 spec compliance: https://www.jsonrpc.org/specification#error_object
  return {
    jsonrpc: '2.0',
    id: req.id,
    error: { code: -32601, message: 'Method not found' },
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
