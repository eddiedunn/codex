// Manual E2E for MCP Client (STDIO) - ESM-Only, Upstream Quality
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_COMMAND = 'npx';
const SERVER_ARGS = [
  '-y',
  '@modelcontextprotocol/server-everything',
  'dir',
  '--tool',
  'echo',
];

console.log('[E2E] Spawning MCP server...');
const serverProc = spawn(SERVER_COMMAND, SERVER_ARGS, {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    FORCE_COLOR: '0',
    NODE_DISABLE_COLORS: '1',
    PYTHONUNBUFFERED: '1',
  },
});

serverProc.stdout.on('data', (data) => {
  process.stdout.write(`[SERVER STDOUT] ${data}`);
});

// Attach and print server STDERR
if (serverProc.stderr) {
  serverProc.stderr.setEncoding('utf8');
  serverProc.stderr.on('data', (data) => {
    console.error('[SERVER STDERR]', data.trim());
  });
}

serverProc.on('spawn', () => {
  console.log('[E2E] Server process spawned');
});
serverProc.on('exit', (code, signal) => {
  console.log(`[E2E] Server exited: code=${code}, signal=${signal}`);
});
serverProc.on('close', (code, signal) => {
  console.log(`[E2E] Server closed: code=${code}, signal=${signal}`);
});
serverProc.on('error', (err) => {
  console.log(`[E2E] Server error: ${err}`);
});

// ---- MCP RAW TRANSPORT DEBUGGING ----
// Patch MCP client to log all raw JSON-RPC messages sent/received (stdio transport only)
import { createRequire } from 'module';
const requireCjs = createRequire(import.meta.url);

function patchStdioTransportDebug() {
  try {
    // Find the SDK base path and build the correct stdio.js path
    const sdkBase = requireCjs.resolve('@modelcontextprotocol/sdk/package.json').replace(/\\/g, '/');
    const stdioPath = sdkBase.replace(/package\.json$/, 'dist/cjs/client/stdio.js');
    const stdioModule = requireCjs(stdioPath);
    if (stdioModule && stdioModule.StdioClientTransport) {
      const origSend = stdioModule.StdioClientTransport.prototype.send;
      stdioModule.StdioClientTransport.prototype.send = function(msg) {
        console.log('[MCP][DEBUG][RAW][SEND]', typeof msg === 'string' ? msg : JSON.stringify(msg));
        return origSend.call(this, msg);
      };
      const origOnData = stdioModule.StdioClientTransport.prototype._onData;
      stdioModule.StdioClientTransport.prototype._onData = function(chunk) {
        console.log('[MCP][DEBUG][RAW][RECV]', chunk.toString());
        return origOnData.call(this, chunk);
      };
      console.log('[MCP][DEBUG] Patched StdioClientTransport for raw logging');
    }
  } catch (err) {
    console.error('[MCP][DEBUG] Failed to patch StdioClientTransport for raw logging:', err);
  }
}

patchStdioTransportDebug();

// Top-level manual timeout helper for all tool calls
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Manual timeout')), ms)),
  ]);
}

// Global diagnostics for unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('[E2E] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Main E2E logic
(async () => {
  console.log('[E2E] TOP-LEVEL: Starting E2E script');
  try {
    // Import the compiled MCP client (ESM)
    const mcpClientPath = path.resolve(__dirname, 'codex-cli/dist/utils/agent/mcp-client.cjs');
    console.log('[E2E] About to import MCP client from:', mcpClientPath);
    const mcpClientModule = await import(`file://${mcpClientPath}`);
    console.log('[E2E] mcp-client.cjs exports:', Object.keys(mcpClientModule));
    const { createMcpClient } = mcpClientModule;
    console.log('[E2E] About to wait for server to be ready...');
    // Wait a bit for the server to be ready
    await new Promise((r) => setTimeout(r, 2000));
    console.log('[E2E] About to create MCP client...');
    let client;
    try {
      client = await createMcpClient({ stdioServerName: 'server-everything' });
      console.log('[E2E] Created MCP client:', client && client._options);
      console.log('[E2E] MCP client full object:', client);
      if (client._serverVersion) {
        console.log('[E2E] MCP serverVersion:', client._serverVersion);
      }
      if (client._clientInfo) {
        console.log('[E2E] MCP clientInfo:', client._clientInfo);
      }
    } catch (err) {
      console.error('[E2E] MCP client creation failed:', err);
      throw err;
    }
    if (typeof client.listTools === 'function') {
      try {
        console.log('[E2E] About to list tools...');
        const tools = await client.listTools();
        console.log('[E2E] Raw tools result:', tools);
        const toolList = Array.isArray(tools) ? tools : (tools && Array.isArray(tools.tools) ? tools.tools : []);
        toolList.forEach((t) => {
          console.log(`[E2E] Tool: ${t.name}, inputSchema:`, t.inputSchema);
        });
        // Try echo with correct payload
        const echoTool = toolList.find((t) => t.name === 'echo');
        if (echoTool) {
          const payload = { message: 'hello stdio e2e' };
          console.log('[E2E] Invoking tool:', 'notARealTool');
          console.log('[E2E] notARealTool tool inputSchema:', echoTool.inputSchema);
          console.log('[E2E] Payload:', JSON.stringify({}));
          const start = Date.now();
          try {
            const result = await withTimeout(client.callTool('notARealTool', {}), 10000);
            const duration = Date.now() - start;
            console.log('[E2E] notARealTool result:', result);
            console.log(`[E2E] callTool duration: ${duration}ms`);
          } catch (err) {
            const duration = Date.now() - start;
            console.error('[E2E] MCP client error (notARealTool):', err);
            if (err && err.stack) {
              console.error('[E2E] Error stack:', err.stack);
            }
            console.error(`[E2E] callTool duration (error): ${duration}ms`);
            if (err && err.response) {
              console.error('[E2E] Error response:', JSON.stringify(err.response, null, 2));
            }
          }
        } else {
          console.log('[E2E] Echo tool not found');
        }
        // Try add
        const addTool = toolList.find((t) => t.name === 'add');
        if (addTool) {
          const addPayload = { a: 2, b: 3 };
          console.log('[E2E] Invoking tool:', 'add');
          console.log('[E2E] Add tool inputSchema:', addTool.inputSchema);
          console.log('[E2E] Payload:', JSON.stringify(addPayload));
          const start = Date.now();
          try {
            const result = await withTimeout(client.callTool('add', addPayload), 10000);
            const duration = Date.now() - start;
            console.log('[E2E] Add tool result:', result);
            console.log(`[E2E] callTool duration: ${duration}ms`);
          } catch (err) {
            const duration = Date.now() - start;
            console.error('[E2E] MCP client error (add):', err);
            if (err && err.stack) {
              console.error('[E2E] Error stack:', err.stack);
            }
            console.error(`[E2E] callTool duration (error): ${duration}ms`);
            if (err && err.response) {
              console.error('[E2E] Error response:', JSON.stringify(err.response, null, 2));
            }
          }
        } else {
          console.log('[E2E] Add tool not found');
        }
        // Try printEnv (no-input tool)
        const printEnvTool = toolList.find((t) => t.name === 'printEnv');
        if (printEnvTool) {
          const printEnvPayload = {};
          console.log('[E2E] Invoking tool:', 'printEnv');
          console.log('[E2E] printEnv tool inputSchema:', printEnvTool.inputSchema);
          console.log('[E2E] Payload:', JSON.stringify(printEnvPayload));
          const start = Date.now();
          try {
            const result = await withTimeout(client.callTool('printEnv', printEnvPayload), 10000);
            const duration = Date.now() - start;
            console.log('[E2E] printEnv tool result:', result);
            console.log(`[E2E] callTool duration: ${duration}ms`);
          } catch (err) {
            const duration = Date.now() - start;
            console.error('[E2E] MCP client error (printEnv):', err);
            if (err && err.stack) {
              console.error('[E2E] Error stack:', err.stack);
            }
            console.error(`[E2E] callTool duration (error): ${duration}ms`);
            if (err && err.response) {
              console.error('[E2E] Error response:', JSON.stringify(err.response, null, 2));
            }
          }
        } else {
          console.log('[E2E] printEnv tool not found');
        }
      } catch (err) {
        console.error('[E2E] MCP client error:', err);
      }
    } else {
      console.log('[E2E] MCP client does not support listTools');
    }
  } catch (err) {
    console.error('[E2E] TOP-LEVEL ERROR:', err);
  } finally {
    console.log('[E2E] TOP-LEVEL: Killing server process (finally block)');
    serverProc.kill();
    setTimeout(() => process.exit(0), 500);
  }
})();
