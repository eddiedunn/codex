#!/usr/bin/env node
/**
 * Minimal, spec-correct MCP mock server for integration testing.
 * Transport: stdio (JSON-RPC 2.0)
 */
import readline from 'readline';

// Types for MCP protocol
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: any;
}
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

const resources = [
  {
    uri: 'mock://resource/1',
    name: 'mock://resource/1',
    description: 'Mock Resource',
    mimeType: 'text/plain',
  },
];

function sendResponse(resp: JsonRpcResponse) {
  process.stdout.write(JSON.stringify(resp) + '\n');
}

function handleRequest(req: JsonRpcRequest) {
  // Spec: must always reply with either result or error
  if (!req.method) {
    sendResponse({
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32601, message: 'method not found' },
    });
    return;
  }
  if (req.method === 'tools/call') {
    const { name, arguments: args } = req.params || {};
    if (name === 'echo') {
      if (!args || typeof args.message !== 'string') {
        sendResponse({
          jsonrpc: '2.0',
          id: req.id,
          error: { code: -32602, message: 'Invalid arguments: expected { message: string }' },
        });
        return;
      }
      sendResponse({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          content: [{ text: args.message, type: 'text' }],
        },
      });
      return;
    } else {
      sendResponse({
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32000, message: `tool not found: ${name}` },
      });
      return;
    }
  } else if (req.method === 'resources/list') {
    sendResponse({
      jsonrpc: '2.0',
      id: req.id,
      result: { resources },
    });
    return;
  } else if (req.method === 'resources/read') {
    const { uri } = req.params || {};
    const res = resources.find(r => r.uri === uri);
    if (!res) {
      sendResponse({
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32001, message: `resource not found: ${uri}` },
      });
      return;
    }
    sendResponse({
      jsonrpc: '2.0',
      id: req.id,
      result: {
        contents: [{ uri: res.uri, mimeType: res.mimeType, text: 'This is a mock resource' }],
      },
    });
    return;
  } else if (req.method === 'events/subscribe') {
    // Stub: just return error (not implemented)
    sendResponse({
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32601, message: 'method not found' },
    });
    return;
  } else {
    sendResponse({
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32601, message: 'method not found' },
    });
    return;
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', (line) => {
  let req: JsonRpcRequest;
  try {
    req = JSON.parse(line);
  } catch (e) {
    // Ignore invalid JSON
    return;
  }
  handleRequest(req);
});

process.on('SIGINT', () => process.exit(0));
