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
  console.error('[MOCK SERVER DEBUG] Handling request:', req);
  if (!req || typeof req !== 'object' || req.jsonrpc !== '2.0' || !req.method) {
    console.error('[MOCK SERVER DEBUG] Invalid request:', req);
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
      console.error('[MOCK SERVER DEBUG] Invalid page size:', pageSize);
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
    console.error('[MOCK SERVER DEBUG] Returning resources:', paged);
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
      console.error('[MOCK SERVER DEBUG] Invalid page size:', pageSize);
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
    console.error('[MOCK SERVER DEBUG] Returning templates:', paged);
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
    console.error('[MOCK SERVER DEBUG] Returning resource:', found);
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: {
        contents: found ? [{ text: `mock resource: ${found.name}` }] : [],
      },
    };
  }
  if (req.method === 'tools/list') {
    console.error('[MOCK SERVER DEBUG] Returning tools:', tools);
    return {
      jsonrpc: '2.0',
      id: req.id,
      result: tools,
    };
  }
  if (req.method === 'tools/call') {
    // STRICT MCP PROTOCOL: require 'name' and 'arguments' in params
    let toolName, args;
    if (!req.params || typeof req.params !== 'object') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: req.id ?? null,
        error: { code: -32600, message: "Invalid Request: missing 'params' object" }
      }) + '\n');
      return;
    }
    toolName = req.params.name;
    args = req.params.arguments;
    if (!toolName) {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: req.id ?? null,
        error: { code: -32600, message: "Invalid Request: missing 'name' in params" }
      }) + '\n');
      return;
    }
    if (typeof args === 'undefined') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: req.id ?? null,
        error: { code: -32602, message: "Invalid arguments: missing 'arguments' in params" }
      }) + '\n');
      return;
    }
    console.error('[MOCK SERVER DEBUG] Handling tool call:', toolName, args);
    const knownTools = ['echo', 'error_tool', 'stream_echo'];
    if (!knownTools.includes(toolName)) {
      console.error('[MOCK SERVER DEBUG] Tool not found:', toolName);
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0',
        id: req.id ?? null,
        error: { code: -32601, message: `Tool not found: ${toolName}` }
      }) + '\n');
      return;
    }
    // --- Argument validation and tool logic ---
    if (toolName === 'echo') {
      if (
        typeof args !== 'object' ||
        args === null ||
        Array.isArray(args) ||
        typeof args.message !== 'string'
      ) {
        console.error('[MOCK SERVER DEBUG] Invalid arguments for echo:', args);
        process.stdout.write(JSON.stringify({ error: true, code: -32602, message: 'Invalid arguments: expected { message: string }' }) + '\n');
        return {
          jsonrpc: '2.0',
          id: req.id,
          error: { code: -32602, message: 'Invalid arguments: expected { message: string }' },
        };
      }
      console.error('[MOCK SERVER DEBUG] Returning echo result:', args.message);
      return {
        jsonrpc: '2.0',
        id: req.id,
        result: { message: args.message, content: [{ text: args.message }] },
      };
    } else if (toolName === 'error_tool') {
      console.error('[MOCK SERVER DEBUG] Returning error tool error');
      return {
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32001, message: 'Simulated tool error', mcpToolError: true },
      };
    } else if (toolName === 'stream_echo') {
      if (
        typeof args !== 'object' ||
        args === null ||
        Array.isArray(args) ||
        typeof args.message !== 'string' ||
        typeof args.chunks !== 'number' ||
        args.chunks < 1 || args.chunks > 10
      ) {
        console.error('[MOCK SERVER DEBUG] Invalid arguments for stream_echo:', args);
        process.stdout.write(JSON.stringify({ error: true, code: -32602, message: 'Invalid arguments: expected { message: string, chunks: number (1-10) }' }) + '\n');
        return {
          jsonrpc: '2.0',
          id: req.id,
          error: { code: -32602, message: 'Invalid arguments: expected { message: string, chunks: number (1-10) }' },
        };
      }
      const totalLen = args.message.length;
      const chunkSize = Math.ceil(totalLen / args.chunks) || 1;
      function emitChunk(i) {
        if (i >= args.chunks) {
          process.stdout.write('', () => {
            setImmediate(() => {
              console.error('[MOCK SERVER DEBUG] Emitting final JSON-RPC response for stream_echo');
              resolve({
                jsonrpc: '2.0',
                id: req.id,
                result: {
                  message: args.message,
                  chunks: args.chunks,
                },
              });
            });
          });
          return;
        }
        const chunkMsg = args.message.slice(i * chunkSize, (i + 1) * chunkSize);
        console.error('[MOCK SERVER DEBUG] Emitting NDJSON chunk:', { chunk: i, text: chunkMsg });
        process.stdout.write(JSON.stringify({ chunk: i, text: chunkMsg }) + '\n');
        setTimeout(() => emitChunk(i + 1), 30);
      }
      console.error('[MOCK SERVER DEBUG] Handling stream_echo with', args);
      return new Promise(resolve => {
        emitChunk(0);
      });
    }
  }
  // PATCH: Always return JSON-RPC 2.0 method not found for any unrecognized method
  // JSON-RPC 2.0 spec compliance: https://www.jsonrpc.org/specification#error_object
  console.error('[MOCK SERVER DEBUG] Method not found:', req.method);
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
    console.error('[MOCK SERVER DEBUG] Parse error:', e);
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
    return;
  }
  const res = handleRequest(req);
  if (res instanceof Promise) {
    res.then((result) => {
      console.error('[MOCK SERVER DEBUG] Emitting response:', result);
      process.stdout.write(JSON.stringify(result) + '\n');
    });
  } else {
    console.error('[MOCK SERVER DEBUG] Emitting response:', res);
    process.stdout.write(JSON.stringify(res) + '\n');
  }
});
