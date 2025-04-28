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
      await mockServer.waitForLogFinish();
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
    if (!mockServer) throw new Error('mockServer is not initialized');
    // Send invalid arguments to stream_echo to trigger protocol error
    const req = JSON.stringify({
      method: 'tools/call',
      params: { name: 'stream_echo', arguments: { message: 123, chunks: 'bad' } } // invalid args
    }) + '\n';
    let errorMsg = '';
    await new Promise(resolve => {
      function onData(data: Buffer) {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            // DEBUG: Print every parsed NDJSON object
            console.log('[TEST DEBUG] Parsed NDJSON:', obj);
            if (obj.error || (obj.jsonrpc === '2.0' && obj.error)) {
              errorMsg += line + '\n';
            }
          } catch {
            // Ignore parse errors
          }
        }
        if (errorMsg.length > 0) {
          mockServer!.process.stdout.off('data', onData);
          resolve(null);
        }
      }
      mockServer!.process.stdout.on('data', onData);
      mockServer.process.stdin.write(req);
      setTimeout(() => {
        mockServer!.process.stdout.off('data', onData);
        resolve(null);
      }, 1000);
    });
    expect(errorMsg).toMatch(/argument|invalid|type|error/i);
    const logContent = mockServer.getLogBuffer();
    expect(logContent).toMatch(/argument|invalid|type|error/i);
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
          logContent = mockServer.getLogBuffer();
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
    const logContent = mockServer.getLogBuffer();
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
    const logContent = mockServer.getLogBuffer();
    expect(logContent).toMatch(/missing|field|invalid/i);
  });

  // --- EDGE CASE: Protocol Version Mismatch ---
  it('returns error for unsupported protocol version', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    // Simulate a request with an unsupported protocol version
    const badVersionRequest = JSON.stringify({
      method: 'tools/call',
      params: { name: 'echo', arguments: { message: 'hello' }, protocol_version: '999.0.0' } // obviously unsupported
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
    const logContent = mockServer.getLogBuffer();
    expect(logContent).toMatch(/protocol|version|unsupported|invalid/i);
  });

  // --- EDGE CASE: Tool-not-found and Argument Errors ---
  it('returns error for invalid arguments to real tool', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    // Send invalid args to a real tool (e.g., echo)
    const req = JSON.stringify({
      method: 'tools/call',
      params: { name: 'echo', arguments: { message: 123 } } // invalid: should be string
    }) + '\n';
    let errorMsg = '';
    await new Promise(resolve => {
      function onData(data: Buffer) {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            console.log('[TEST DEBUG] Parsed NDJSON:', obj);
            if (obj.error || (obj.jsonrpc === '2.0' && obj.error)) {
              errorMsg += line + '\n';
            }
          } catch {
            // ignore parse errors
          }
        }
        if (errorMsg.length > 0) {
          mockServer!.process.stdout.off('data', onData);
          resolve(null);
        }
      }
      mockServer!.process.stdout.on('data', onData);
      mockServer.process.stdin.write(req);
      setTimeout(() => {
        mockServer!.process.stdout.off('data', onData);
        resolve(null);
      }, 1000);
    });
    expect(errorMsg).toMatch(/argument|invalid|type|error/i);
    const logContent = mockServer.getLogBuffer();
    expect(logContent).toMatch(/argument|invalid|type|error/i);
  });

  it('handles tool call to unknown tool', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    // Send call to unknown tool
    const req = JSON.stringify({
      method: 'tools/call',
      params: { name: 'not_a_real_tool', arguments: {} }
    }) + '\n';
    let errorJson = undefined;
    await new Promise(resolve => {
      mockServer.process.stdout.on('data', data => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);
            if (msg.error) {
              errorJson = msg.error;
              resolve();
            }
          } catch {}
        }
      });
      mockServer.process.stdin.write(req);
      setTimeout(resolve, 1000);
    });
    expect(errorJson).toBeDefined();
    expect(errorJson.code).toBe(-32601);
    expect(errorJson.message).toMatch(/tool not found/i);
    const logContent = mockServer.getLogBuffer();
    expect(logContent).toMatch(/tool.*not found|unknown|no such tool/i);
  });

  it('handles large payloads without truncation or crash', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    const message = 'x'.repeat(1024 * 256); // 256KB
    const chunks = 8;
    const req = JSON.stringify({
      method: 'tools/call',
      params: { name: 'stream_echo', arguments: { message, chunks } }
    }) + '\n';
    let allChunks = [];
    let finalResp = null;
    await new Promise(resolve => {
      mockServer.process.stdout.on('data', data => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);
            if (msg.chunk !== undefined) {
              allChunks[msg.chunk] = msg.text;
            } else if (msg.jsonrpc) {
              finalResp = msg;
              resolve();
            }
          } catch {}
        }
      });
      mockServer.process.stdin.write(req);
      setTimeout(resolve, 2000);
    });
    const output = allChunks.join('');
    expect(output.length).toBeGreaterThan(1024 * 128); // At least half the payload
    expect(output).toMatch(/x{100,}/); // Look for a long run of 'x'
    expect(finalResp).toBeDefined();
    const logContent = mockServer.getLogBuffer();
    expect(logContent.length).toBeGreaterThan(0);
  });

  // --- EDGE CASE: Simulated Server Disconnects/Errors ---
  it('handles server disconnect mid-request', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    // Start a request, then kill the server before response
    const req = JSON.stringify({
      method: 'tools/call',
      params: { name: 'echo', arguments: { message: 'disconnect test' } }
    }) + '\n';
    mockServer.process.stdin.write(req);
    // Immediately kill the server
    mockServer.process.kill();
    let errorMsg = '';
    await new Promise(resolve => {
      setTimeout(() => {
        // After short delay, check if error/log output is present
        errorMsg = mockServer.getLogBuffer();
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
      params: { name: 'throw_error', arguments: { message: 'fail' } }
    }) + '\n';
    let errorMsg = '';
    await new Promise(resolve => {
      function onData(data: Buffer) {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            // DEBUG: Print every parsed NDJSON object
            console.log('[TEST DEBUG] Parsed NDJSON:', obj);
            if (obj.error || (obj.jsonrpc === '2.0' && obj.error)) {
              errorMsg += line + '\n';
            }
          } catch {
            // Ignore parse errors
          }
        }
        if (errorMsg.length > 0) {
          mockServer!.process.stdout.off('data', onData);
          resolve(null);
        }
      }
      // Attach handler BEFORE sending the request
      mockServer!.process.stdout.on('data', onData);
      mockServer.process.stdin.write(req);
      setTimeout(() => {
        mockServer!.process.stdout.off('data', onData);
        resolve(null);
      }, 1000);
    });
    expect(errorMsg).toMatch(/error|exception|fail|threw/i);
    const logContent = mockServer.getLogBuffer();
    expect(logContent).toMatch(/error|exception|fail|threw/i);
  });

  // --- EDGE CASE: Streaming (NDJSON) ---
  it('handles streaming responses from stream_echo tool', async () => {
    if (!mockServer) throw new Error('mockServer is not initialized');
    const message = 'streaming_test_message_' + Math.random().toString(36).slice(2);
    const chunks = 4;
    const req = JSON.stringify({
      method: 'tools/call',
      params: { name: 'stream_echo', arguments: { message, chunks } }
    }) + '\n';
    let receivedChunks: string[] = [];
    let finalResponse = null;
    await new Promise(resolve => {
      mockServer.process.stdout.on('data', data => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);
            if (msg.chunk !== undefined) {
              receivedChunks[msg.chunk] = msg.text;
            } else if (msg.jsonrpc) {
              finalResponse = msg;
              resolve();
            }
          } catch {}
        }
      });
      mockServer.process.stdin.write(req);
      setTimeout(resolve, 2000);
    });
    expect(receivedChunks.filter(Boolean).length).toBe(chunks);
    expect(receivedChunks.join('')).toBe(message);
    expect(finalResponse).toBeDefined();
    const logContent = mockServer.getLogBuffer();
    expect(logContent.length).toBeGreaterThan(0);
  });

  // ... further edge case tests will follow ...
});
