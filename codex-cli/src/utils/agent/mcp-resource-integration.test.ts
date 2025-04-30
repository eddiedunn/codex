import { MinimalMcpClient } from './mcp-client.js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Integration test with mcptools mock server
describe('MCP Resource Protocol (integration, mcptools mock)', () => {
  let client: MinimalMcpClient;
  let mockProcess: import('child_process').ChildProcess;

  beforeAll(async () => {
    // Start mcptools mock server with tool and resource
    const { spawn } = await import('child_process');
    mockProcess = spawn('mcp', [
      'mock',
      'tool', 'hello_world', 'A simple greeting tool',
      'resource', 'docs://readme', 'Documentation', 'This is a mock resource'
    ], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });
    // Wait for mock server to initialize
    await new Promise(res => setTimeout(res, 1000));
    client = new MinimalMcpClient({
      transport: 'stdio',
      process: mockProcess,
    });
    await client.connect();
  });

  afterAll(async () => {
    if (mockProcess) {mockProcess.kill();}
    await client.disconnect();
  });

  it('should list resources', async () => {
    const resources = await client.listResources();
    expect(Array.isArray(resources.results)).toBe(true);
    expect(resources.results[0]).toHaveProperty('uri');
  });

  it('should read a resource', async () => {
    const resources = await client.listResources();
    const uri = resources.results[0].uri;
    const content = await client.readResource(uri);
    expect(content).toBeDefined();
  });
});

// Unit test with mock request method
describe('MCP Resource Protocol (unit, mock)', () => {
  it('should parse resource list from mock server', async () => {
    const client = new MinimalMcpClient({ transport: 'stdio', stdioPath: 'mock' });
    // @ts-expect-error
    client.request = async (method: string) => {
      if (method === 'resources/list') {return { resources: [{ id: 'foo', name: 'bar' }] };}
      return { resources: [] };
    };
    const resources = await client.listResources();
    expect(resources).toEqual({
      results: [{ id: 'foo', name: 'bar' }],
      nextPageToken: undefined,
      prevPageToken: undefined,
    });
  });
});
