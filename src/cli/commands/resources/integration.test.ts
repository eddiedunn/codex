import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import net from 'net';

let mcpServerProcess: ReturnType<typeof spawn> | undefined;

function waitForPort(port: number, timeout = 10000): Promise<void> {
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

describe('MCP CLI integration', () => {
  beforeAll(async () => {
    // Use npx to launch server-everything from npm as per ~/.codex/mcp_servers.json
    mcpServerProcess = spawn('npx', ['-y', '@modelcontextprotocol/server-everything', '--port', '12345'], {
      stdio: 'ignore',
    });
    await waitForPort(12345);
  }, 20000);

  afterAll(() => {
    if (mcpServerProcess) mcpServerProcess.kill();
  });

  it('lists resources with pagination', async () => {
    const cli = spawn('npx', ['tsx', 'src/cli/commands/resources/list.cli.tsx'], {
      env: { ...process.env, MCP_SERVER_URL: 'http://localhost:12345' },
    });
    let output = '';
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('CLI timed out')), 10000);
      cli.stdout.on('data', (data) => {
        output += data.toString();
        if (output.includes('Resource')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      cli.on('error', reject);
      cli.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    expect(output).toContain('Resource');
  });
});
