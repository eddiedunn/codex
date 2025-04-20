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
serverProc.stderr.on('data', (data) => {
  process.stderr.write(`[SERVER STDERR] ${data}`);
});
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

// Main E2E logic
(async () => {
  // Import the compiled MCP client (ESM)
  const mcpClientPath = path.resolve(__dirname, 'codex-cli/dist/src/utils/agent/mcp-client.js');
  const { createMcpClient } = await import(`file://${mcpClientPath}`);

  // Wait a bit for the server to be ready
  await new Promise((r) => setTimeout(r, 2000));

  const client = createMcpClient({ stdioServerName: undefined });
  console.log('[E2E] Created MCP client:', client._options);

  // If actual stdio integration is supported, try to list tools and call echo
  if (typeof client.listTools === 'function') {
    try {
      const tools = await client.listTools();
      console.log('[E2E] Tools:', tools);
      const echoTool = tools.find((t) => t.name === 'echo');
      if (echoTool) {
        const result = await client.callTool('echo', { text: 'hello stdio e2e' });
        console.log('[E2E] Echo tool result:', result);
      } else {
        console.log('[E2E] Echo tool not found');
      }
    } catch (err) {
      console.error('[E2E] MCP client error:', err);
    }
  } else {
    console.log('[E2E] MCP client does not support listTools');
  }

  // Kill the server after test
  serverProc.kill();
})();
