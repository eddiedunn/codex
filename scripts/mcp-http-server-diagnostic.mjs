// Minimal diagnostic script for MCP HTTP server binding (ESM)
import { spawn } from 'child_process';
import path from 'path';
import net from 'net';
import getPort from 'get-port';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

(async () => {
  const HTTP_PORT = await getPort();
  console.log(`[DIAG] Using HTTP_PORT=${HTTP_PORT}`);

  const customEnv = { ...process.env, NODE_ENV: 'production' };
  delete customEnv.VITEST;
  delete customEnv.VITEST_MODE;

  const cmd = 'npx -y @modelcontextprotocol/server-everything --port ' + HTTP_PORT;
  console.log(`[DIAG] Spawning: ${cmd}`);

  const proc = spawn(cmd, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: path.resolve(__dirname, '../..'),
    shell: true,
    env: customEnv,
  });

  proc.stdout.on('data', (data) => {
    process.stdout.write(`[SERVER STDOUT] ${data}`);
  });
  proc.stderr.on('data', (data) => {
    process.stderr.write(`[SERVER STDERR] ${data}`);
  });
  proc.on('error', (err) => {
    console.error('[DIAG] Server process error:', err);
  });
  proc.on('close', (code, signal) => {
    console.log(`[DIAG] Server exited. code=${code} signal=${signal}`);
    process.exit(1);
  });

  // Wait for port to open
  function waitForPort(port, timeout = 20000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      function check() {
        const socket = net.createConnection(port, '127.0.0.1');
        socket.on('connect', () => {
          socket.end();
          resolve();
        });
        socket.on('error', () => {
          if (Date.now() - start > timeout) reject(new Error('Timeout waiting for port'));
          else setTimeout(check, 200);
        });
      }
      check();
    });
  }

  try {
    await waitForPort(HTTP_PORT);
    console.log('[DIAG] HTTP MCP server bound successfully!');
    proc.kill();
    process.exit(0);
  } catch (e) {
    console.error('[DIAG] Failed to bind HTTP MCP server:', e);
    proc.kill();
    process.exit(2);
  }
})();
