import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MinimalMcpClient } from './mcp-client';

// Integration test with real MCP server (server-everything)
describe('MCP Resource Protocol (integration)', () => {
  let client: MinimalMcpClient;

  beforeAll(async () => {
    client = new MinimalMcpClient({
      transport: 'stdio',
      stdioPath: 'npx',
      stdioArgs: ['-y', '@modelcontextprotocol/server-everything']
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
  });

  it('should list resources', async () => {
    const resources = await client.listResources();
    expect(Array.isArray(resources)).toBe(true);
    expect(resources[0]).toHaveProperty('uri');
  });

  it('should read a resource', async () => {
    const resources = await client.listResources();
    const uri = resources[0].uri;
    const content = await client.readResource(uri);
    expect(content).toBeDefined();
  });
});

// Unit test with mock request method
describe('MCP Resource Protocol (unit, mock)', () => {
  it('should parse resource list from mock server', async () => {
    const client = new MinimalMcpClient({ transport: 'stdio', stdioPath: 'mock' });
    // @ts-ignore
    client.request = async (method: string) => {
      if (method === 'resources/list') return [{ id: 'foo', name: 'bar' }];
      return [];
    };
    const resources = await client.listResources();
    expect(resources).toEqual([{ id: 'foo', name: 'bar' }]);
  });
});
