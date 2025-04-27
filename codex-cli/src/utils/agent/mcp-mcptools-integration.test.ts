import { spawn } from 'child_process';
import { beforeAll, afterAll, it, expect, describe } from 'vitest';

let mcp;
let responses = '';

describe('MCP Protocol Integration (mcptools mock)', () => {
  beforeAll((done) => {
    // Start the mcptools mock server with an echo tool
    mcp = spawn('mcp', [
      'mock',
      'tool',
      'echo',
      'Echoes a message'
    ], { stdio: ['pipe', 'pipe', 'inherit'] });

    // Collect all output
    mcp.stdout.on('data', (chunk) => {
      responses += chunk.toString();
    });

    // Wait a bit for server to be ready
    setTimeout(done, 400);
  });

  afterAll(() => {
    if (mcp) {mcp.kill();}
  });

  it('responds to echo tool call', async () => {
    const request = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: { message: 'hello from test' }
      }
    };
    mcp.stdin.write(JSON.stringify(request) + '\n');

    // Wait for response
    await new Promise((resolve) => setTimeout(resolve, 400));

    // Parse the response
    const lines = responses.split('\n').filter(Boolean);
    const found = lines.some(line => {
      try {
        const obj = JSON.parse(line);
        return obj.id === 1 && obj.result;
      } catch { return false; }
    });
    expect(found).toBe(true);
  });
});
