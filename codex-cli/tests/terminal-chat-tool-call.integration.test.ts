import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MinimalMcpClient } from '../src/utils/agent/mcp-client';
import { startMockServer, MockServerHandle } from '../src/utils/agent/mcpTestHarness';

let mockServer: MockServerHandle | null = null;
let mcpClient: MinimalMcpClient;

describe('E2E: Chat session tool call via MCP', () => {
  beforeEach(async () => {
    mockServer = startMockServer('codex-chat-toolcall-mockserver');
    // Wait briefly for server to be ready
    await new Promise(res => setTimeout(res, 300));
    mcpClient = new MinimalMcpClient({
      transport: 'stdio',
      process: mockServer.process,
    });
    await mcpClient.connect();
  });

  afterEach(async () => {
    if (mcpClient && mcpClient.disconnect) await mcpClient.disconnect();
    if (mockServer) {
      mockServer.process.kill();
      mockServer.closeLog();
      mockServer = null;
    }
  });

  it('calls a tool successfully from chat session', async () => {
    // Simulate a chat session tool call
    const toolName = 'echo';
    // The mock server expects { message: string }
    const args = { message: 'hello world' };
    const result = await mcpClient.callTool(toolName, args);
    expect(result).toBeDefined();
    expect(result.message).toContain('hello world');
    expect(result.isError).not.toBe(true);
  });

  it('handles tool call error from chat session', async () => {
    // Simulate a tool call with an invalid tool name
    const toolName = 'nonexistent_tool';
    const args = { foo: 'bar' };
    let error;
    try {
      await mcpClient.callTool(toolName, args);
    } catch (err: unknown) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error instanceof Error ? error.message : error).toMatch(/not found|error/i);
  });

  it('logs output to /tmp', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    console.log('Log path for this test:', mockServer.logPath);
    let logContent = '';
    let fileExists = false;
    let fileSize = 0;
    for (let i = 0; i < 10; ++i) {
      await new Promise(res => setTimeout(res, 300));
      try {
        fileExists = mockServer.logExists;
        if (fileExists) {
          fileSize = mockServer.logSize;
          logContent = mockServer.getLogContent();
          if (logContent && /MOCK SERVER/.test(logContent)) break;
        }
      } catch (e: unknown) {
        // Log and continue
        console.warn('Error reading log file:', e instanceof Error ? e.message : e);
      }
    }
    if (!fileExists) {
      console.warn('Log file does not exist at path:', mockServer.logPath);
    } else if (fileSize === 0) {
      console.warn('Log file exists but is empty:', mockServer.logPath);
    }
    if (!/MOCK SERVER/.test(logContent)) {
      console.warn('Log file contents after test:', logContent);
    }
    expect(fileExists).toBe(true);
    expect(fileSize).toBeGreaterThan(0);
    expect(logContent).toMatch(/MOCK SERVER/);
  });

  // --- EDGE CASE: Malformed Requests ---
  it('returns error for malformed (non-JSON) request', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    // Directly write to the mock server's stdin bad data (simulate protocol violation)
    const badData = 'not-a-json\n';
    mockServer.process.stdin.write(badData);
    let errorMsg = '';
    // Listen for error output from server
    await new Promise(resolve => {
      mockServer.process.stderr.once('data', (data: Buffer) => {
        errorMsg = data.toString();
        resolve(null);
      });
      // Give it a little time to process
      setTimeout(resolve, 500);
    });
    expect(errorMsg).toMatch(/invalid|json|parse/i);
    // Optionally, check log file for error
    const logContent = mockServer.getLogContent();
    expect(logContent).toMatch(/invalid|json|parse/i);
  });

  it('returns error for missing required fields', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    // Send a JSON object missing required fields
    const incomplete = JSON.stringify({ foo: 'bar' }) + '\n';
    mockServer.process.stdin.write(incomplete);
    let errorMsg = '';
    await new Promise(resolve => {
      mockServer.process.stderr.once('data', (data: Buffer) => {
        errorMsg = data.toString();
        resolve(null);
      });
      setTimeout(resolve, 500);
    });
    expect(errorMsg).toMatch(/missing|field|invalid/i);
    const logContent = mockServer.getLogContent();
    expect(logContent).toMatch(/missing|field|invalid/i);
  });

  // --- EDGE CASE: Protocol Version Mismatch ---
  it('returns error for unsupported protocol version', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    // Simulate a request with an unsupported protocol version
    const badVersionRequest = JSON.stringify({
      method: 'tools/call',
      tool: 'echo',
      arguments: { message: 'hello' },
      protocol_version: '999.0.0' // obviously unsupported
    }) + '\n';
    mockServer.process.stdin.write(badVersionRequest);
    let errorMsg = '';
    await new Promise(resolve => {
      mockServer.process.stderr.once('data', (data: Buffer) => {
        errorMsg = data.toString();
        resolve(null);
      });
      setTimeout(resolve, 500);
    });
    expect(errorMsg).toMatch(/protocol|version|unsupported|invalid/i);
    const logContent = mockServer.getLogContent();
    expect(logContent).toMatch(/protocol|version|unsupported|invalid/i);
  });

  // --- EDGE CASE: Tool-not-found and Argument Errors ---
  it('returns error for non-existent tool', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    const req = JSON.stringify({
      method: 'tools/call',
      tool: 'not_a_real_tool',
      arguments: { foo: 'bar' }
    }) + '\n';
    mockServer.process.stdin.write(req);
    let errorMsg = '';
    await new Promise(resolve => {
      mockServer.process.stderr.once('data', (data: Buffer) => {
        errorMsg = data.toString();
        resolve(null);
      });
      setTimeout(resolve, 500);
    });
    expect(errorMsg).toMatch(/tool.*not found|unknown|no such tool/i);
    const logContent = mockServer.getLogContent();
    expect(logContent).toMatch(/tool.*not found|unknown|no such tool/i);
  });

  it('returns error for invalid arguments to real tool', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    // For "echo" tool, pass a number instead of expected object
    const req = JSON.stringify({
      method: 'tools/call',
      tool: 'echo',
      arguments: 12345 // invalid type
    }) + '\n';
    mockServer.process.stdin.write(req);
    let errorMsg = '';
    await new Promise(resolve => {
      mockServer.process.stderr.once('data', (data: Buffer) => {
        errorMsg = data.toString();
        resolve(null);
      });
      setTimeout(resolve, 500);
    });
    expect(errorMsg).toMatch(/argument|invalid|type|error/i);
    const logContent = mockServer.getLogContent();
    expect(logContent).toMatch(/argument|invalid|type|error/i);
  });

  // --- EDGE CASE: Simulated Server Disconnects/Errors ---
  it('handles server disconnect mid-request', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    // Start a request, then kill the server before response
    const req = JSON.stringify({
      method: 'tools/call',
      tool: 'echo',
      arguments: { message: 'disconnect test' }
    }) + '\n';
    mockServer.process.stdin.write(req);
    // Immediately kill the server
    mockServer.process.kill();
    let errorMsg = '';
    await new Promise(resolve => {
      setTimeout(() => {
        // After short delay, check if error/log output is present
        errorMsg = mockServer.getLogContent();
        resolve(null);
      }, 500);
    });
    expect(errorMsg).toMatch(/disconnect|closed|exit|error|broken/i);
  });

  it('handles explicit server error response', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    // Send a request designed to make the server throw (assuming "throw_error" tool is implemented in mock)
    const req = JSON.stringify({
      method: 'tools/call',
      tool: 'throw_error',
      arguments: { message: 'fail' }
    }) + '\n';
    mockServer.process.stdin.write(req);
    let errorMsg = '';
    await new Promise(resolve => {
      mockServer.process.stderr.once('data', (data: Buffer) => {
        errorMsg = data.toString();
        resolve(null);
      });
      setTimeout(resolve, 500);
    });
    expect(errorMsg).toMatch(/error|exception|fail|threw/i);
    const logContent = mockServer.getLogContent();
    expect(logContent).toMatch(/error|exception|fail|threw/i);
  });

  // --- EDGE CASE: Large Payloads ---
  it('handles large payloads without truncation or crash', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    const largeString = 'x'.repeat(1024 * 256); // 256 KB string
    const req = JSON.stringify({
      method: 'tools/call',
      tool: 'echo',
      arguments: { message: largeString }
    }) + '\n';
    mockServer.process.stdin.write(req);
    let output = '';
    await new Promise(resolve => {
      mockServer.process.stdout.once('data', (data: Buffer) => {
        output = data.toString();
        resolve(null);
      });
      setTimeout(resolve, 1000);
    });
    expect(output.length).toBeGreaterThan(1024 * 128); // At least half the payload
    expect(output).toMatch(/x{100,}/); // Look for a long run of 'x'
    const logContent = mockServer.getLogContent();
    expect(logContent.length).toBeGreaterThan(0);
  });

  // --- EDGE CASE: Streaming (NDJSON) ---
  it('handles streaming responses from stream_echo tool', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    const message = 'streaming_test_message_' + Math.random().toString(36).slice(2);
    const chunks = 4;
    const req = JSON.stringify({
      method: 'tools/call',
      tool: 'stream_echo',
      arguments: { message, chunks }
    }) + '\n';
    mockServer.process.stdin.write(req);
    const receivedChunks: string[] = [];
    let finalResponse = '';
    let done = false;
    // Listen for NDJSON chunks and final response
    await new Promise(resolve => {
      function onData(data: Buffer) {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            if (typeof obj.chunk === 'string') {
              receivedChunks.push(obj.chunk);
            } else if (obj.jsonrpc === '2.0' && obj.result) {
              finalResponse = line;
              done = true;
            }
          } catch {
            // Ignore parse errors
          }
        }
        if (done || receivedChunks.length >= chunks) {
          mockServer!.process.stdout.off('data', onData);
          resolve(null);
        }
      }
      mockServer!.process.stdout.on('data', onData);
      setTimeout(() => {
        mockServer!.process.stdout.off('data', onData);
        resolve(null);
      }, 2000);
    });
    expect(receivedChunks.length).toBe(chunks);
    expect(receivedChunks.join('')).toBe(message);
    expect(finalResponse).toMatch(/jsonrpc/);
    const logContent = mockServer.getLogContent();
    expect(logContent.length).toBeGreaterThan(0);
  });

  // ... further edge case tests will follow ...
});
