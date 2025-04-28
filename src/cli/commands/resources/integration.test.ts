/**
 * MCP CLI integration test for multiple servers (HTTP + stdio).
 * Launches one HTTP (SSE) and one stdio mock MCP server.
 * Passes both to the CLI via MCP_SERVER_URLS (comma-separated).
 * Asserts on aggregation of resources/tools from both servers.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ChildProcess, spawn } from 'child_process';
import net from 'net';
import path from 'path';
import getPort from 'get-port';

let serverProcesses: ChildProcess[] = [];
let serverReadyCount = 0;
let HTTP_PORT: number;

function waitForPort(port, timeout = 20000) {
  return new Promise<void>((resolve, reject) => {
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

describe('MCP CLI integration (multi-server)', () => {
  beforeAll(async () => {
    HTTP_PORT = await getPort();
    console.log(`[TEST] Using HTTP_PORT=${HTTP_PORT}`);
    // Launch HTTP MCP server
    console.log('[TEST] Spawning HTTP MCP server...');
    // Print environment variables for diagnostics
    console.log('[TEST] process.env snapshot:', JSON.stringify(process.env, null, 2));
    const httpProc = spawn('npx -y @modelcontextprotocol/server-everything --port ' + HTTP_PORT, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '../../../../'),
      shell: true,
      env: process.env,
    });
    console.log(`[TEST] HTTP MCP server PID: ${httpProc.pid}`);
    httpProc.on('spawn', () => {
      console.log('[HTTP MCP SERVER EVENT] spawn');
    });
    httpProc.on('error', (err) => {
      console.error('[HTTP MCP SERVER EVENT] error', err);
    });
    httpProc.on('close', (code, signal) => {
      console.error(`[HTTP MCP SERVER EVENT] close code=${code}, signal=${signal}`);
    });
    httpProc.on('disconnect', () => {
      console.error('[HTTP MCP SERVER EVENT] disconnect');
    });
    httpProc.on('exit', (code, signal) => {
      console.error(`[HTTP MCP SERVER EXITED] code=${code}, signal=${signal}`);
    });
    serverProcesses.push(httpProc);
    // Heartbeat during wait
    let waiting = true;
    const heartbeat = setInterval(() => {
      if (waiting) console.log('[TEST] Waiting for HTTP MCP server port...');
    }, 1000);
    // Wait for port, but also race with process exit
    await Promise.race([
      waitForPort(HTTP_PORT),
      new Promise((_, reject) => {
        httpProc.on('exit', (code, signal) => {
          reject(new Error(`[HTTP MCP SERVER EXITED EARLY] code=${code}, signal=${signal}`));
        });
      })
    ]);
    waiting = false;
    clearInterval(heartbeat);
    console.log('[TEST] HTTP MCP server ready');
    serverReadyCount++;

    // Launch stdio MCP mock server
    console.log('[TEST] Spawning stdio MCP mock server...');
    const stdioProc = spawn('npx', ['tsx', 'codex-cli/src/utils/agent/mcp-mock-server.ts'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    serverProcesses.push(stdioProc);
    await new Promise<void>((resolve, reject) => {
      let timeout = setTimeout(() => reject(new Error('Timeout waiting for stdio mock server')), 10000);
      stdioProc.stdout.on('data', (data) => {
        const str = data.toString();
        process.stdout.write(`[MOCK SERVER STDOUT] ${str}`);
        if (str.toLowerCase().includes('ready')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      stdioProc.stderr.on('data', (data) => {
        process.stderr.write(`[MOCK SERVER STDERR] ${data.toString()}`);
      });
    });
    console.log('[TEST] Stdio MCP mock server ready');
    serverReadyCount++;
  }, 35000);

  afterAll(() => {
    serverProcesses.forEach(proc => proc && proc.kill());
    console.log('[TEST] All MCP server processes killed');
  });

  it('aggregates resources from both servers', async () => {
    if (serverReadyCount !== 2) throw new Error('Not all servers are ready');
    console.log('[TEST] Spawning CLI for multi-server resource list...');
    const MCP_SERVER_URLS = `http://localhost:${HTTP_PORT},stdio://`;
    const cli = spawn('npx', ['tsx', 'src/cli/commands/resources/list.cli.tsx'], {
      env: { ...process.env, MCP_SERVER_URLS },
    });
    let output = '';
    cli.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      process.stdout.write(`[CLI STDOUT] ${str}`);
    });
    cli.stderr.on('data', (data) => {
      const str = data.toString();
      process.stderr.write(`[CLI STDERR] ${str}`);
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error('[TEST] CLI timed out');
        reject(new Error('CLI timed out'));
      }, 20000);
      cli.stdout.on('data', (data) => {
        // Look for evidence of results from both servers (e.g., two different resource/tool names)
        if (output.match(/Resource.*HTTP/) && output.match(/Resource.*stdio/)) {
          clearTimeout(timeout);
          resolve();
        }
      });
      cli.on('error', (err) => {
        console.error('[TEST] CLI process error:', err);
        clearTimeout(timeout);
        reject(err);
      });
      cli.on('close', (code) => {
        clearTimeout(timeout);
        console.log(`[TEST] CLI process exited with code ${code}`);
        resolve();
      });
    });
    // Simple assertion: output contains evidence of both servers' resources
    expect(output).toMatch(/Resource.*HTTP/);
    expect(output).toMatch(/Resource.*stdio/);
  });
});
