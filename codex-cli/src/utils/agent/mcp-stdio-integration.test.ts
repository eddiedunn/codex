import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { MinimalMcpClient } from './mcp-client';

// Update this to the actual MCP reference server command and args
const MCP_SERVER_COMMAND = 'node';
const MCP_SERVER_ARGS = [
  '/Users/tmwsiy/code/codex/servers/src/everything/dist/index.js'
];

let mcpProcess: ReturnType<typeof spawn> | null = null;

// Helper: start MCP server and return child process
function startMcpServer() {
  return spawn(MCP_SERVER_COMMAND, MCP_SERVER_ARGS, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });
}

describe('MCP stdio integration (reference server)', () => {
  beforeAll(async () => {
    mcpProcess = startMcpServer();
    // Give the server a moment to start up
    await new Promise(res => setTimeout(res, 1000));
  });

  afterAll(() => {
    if (mcpProcess) {
      mcpProcess.kill();
    }
  });

  it('should connect and invoke the echo tool', async () => {
    const client = new MinimalMcpClient({
      transport: 'stdio',
      stdioPath: MCP_SERVER_COMMAND,
      stdioArgs: MCP_SERVER_ARGS,
    });
    await client.connect();

    // Call the 'echo' tool using tools/call per the server's CallToolRequestSchema handler
    const echoResult = await client.request('tools/call', {
      name: 'echo',
      arguments: { message: 'hello MCP' }
    });
    expect(echoResult).toHaveProperty('content');
    // content is an array of objects per MCP spec
    expect(Array.isArray(echoResult.content)).toBe(true);
    expect(echoResult.content[0]?.text ?? '').toMatch(/hello MCP/i);
  });

  it('should return error for unknown tool name', async () => {
    const client = new MinimalMcpClient({
      transport: 'stdio',
      stdioPath: MCP_SERVER_COMMAND,
      stdioArgs: MCP_SERVER_ARGS,
    });
    await client.connect();
    await expect(
      client.request('tools/call', {
        name: 'nonexistent_tool',
        arguments: { foo: 'bar' }
      })
    ).rejects.toThrow(/not found|unknown/i);
  });

  it('should return error for malformed arguments', async () => {
    const client = new MinimalMcpClient({
      transport: 'stdio',
      stdioPath: MCP_SERVER_COMMAND,
      stdioArgs: MCP_SERVER_ARGS,
    });
    await client.connect();
    await expect(
      client.request('tools/call', {
        name: 'echo',
        arguments: { notMessage: 123 }
      })
    ).rejects.toThrow(/invalid|argument/i);
  });

  it('should return error for invalid method', async () => {
    const client = new MinimalMcpClient({
      transport: 'stdio',
      stdioPath: MCP_SERVER_COMMAND,
      stdioArgs: MCP_SERVER_ARGS,
    });
    await client.connect();
    await expect(
      client.request('invalid/method', {
        name: 'echo',
        arguments: { message: 'test' }
      })
    ).rejects.toThrow(/method|not supported|unknown/i);
  });

  // NOTE: This test is unreliable in real stdio integration due to OS/process buffering.
  // See memory bank and best practices doc for rationale. Use unit tests with DI/mocks for this scenario.
  it.skip('should handle abrupt server disconnect (unreliable in integration)', async () => {
    // This test is skipped: see above.
  });
});
