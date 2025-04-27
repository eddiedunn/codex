// @ts-nocheck

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
  params?: Record<string, unknown>;
}
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const resources = [
  {
    uri: 'mock://resource/1',
    name: 'mock://resource/1',
    description: 'Mock Resource',
    mimeType: 'text/plain',
  },
];

function sendResponse(resp: JsonRpcResponse): void {
  process.stdout.write(JSON.stringify(resp) + '\n');
  process.stdout.emit && process.stdout.emit('flush');
}

function handleRequest(req: JsonRpcRequest): void {
  if (!req.method) {
    sendResponse({
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32601, message: 'method not found' },
    });
    return;
  }
  if (req.method === 'tools/call') {
    const { name, arguments: toolArgs } = req.params || {};
    if (name === 'echo') {
      const msgArgs = toolArgs;
      if (!msgArgs.message || typeof msgArgs.message !== 'string') {
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
          content: [{ text: msgArgs.message, type: 'text' }],
        },
      });
      return;
    } else if (name === 'error_tool') {
      sendResponse({
        jsonrpc: '2.0',
        id: req.id,
        error: {
          code: 1234,
          message: 'Simulated tool error',
          data: { mcpToolError: true }
        }
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
});

rl.on('line', (line) => {
  try {
    const req = JSON.parse(line);
    handleRequest(req);
  } catch (err) {
    console.error('[MOCK SERVER] Failed to parse JSON:', err, 'Line:', line);
  }
});

rl.on('close', () => {
  console.log('[MOCK SERVER] Readline closed');
});

process.on('SIGTERM', () => {
  console.log('[MOCK SERVER] Received SIGTERM, exiting');
  process.exit(0);
});
