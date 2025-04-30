import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MinimalMcpClient } from '../src/utils/agent/mcp-client.js';
import { startMockServer, MockServerHandle } from '../src/utils/agent/mcpTestHarness.js';

let mockServer: MockServerHandle | null = null;
let mcpClient: MinimalMcpClient;

// SKIPPED: Resource/template listing tests are not part of the MVP. See memory bank for scope.
// To re-enable, remove the .skip below and update the mock server as needed.
describe.skip('E2E: Chat session tool call - paginated listing', () => {
  beforeEach(async () => {
    mockServer = startMockServer('codex-chat-toolcall-listing-mockserver');
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

  it('lists resource templates with pagination', async () => {
    // First page
    const { results: templates1, nextPageToken } = await mcpClient.listResourceTemplates({ pageSize: 2 });
    expect(Array.isArray(templates1)).toBe(true);
    expect(templates1.length).toBeLessThanOrEqual(2);
    // If there is a next page, fetch it
    if (nextPageToken) {
      const { results: templates2 } = await mcpClient.listResourceTemplates({ pageSize: 2, pageToken: nextPageToken });
      expect(Array.isArray(templates2)).toBe(true);
      // Should not repeat first page results
      expect(templates2).not.toEqual(templates1);
    }
  });

  it('lists resources with pagination', async () => {
    // First page
    const { results: resources1, nextPageToken } = await mcpClient.listResources({ pageSize: 2 });
    expect(Array.isArray(resources1)).toBe(true);
    expect(resources1.length).toBeLessThanOrEqual(2);
    // If there is a next page, fetch it
    if (nextPageToken) {
      const { results: resources2 } = await mcpClient.listResources({ pageSize: 2, pageToken: nextPageToken });
      expect(Array.isArray(resources2)).toBe(true);
      // Should not repeat first page results
      expect(resources2).not.toEqual(resources1);
    }
  });

  it('returns empty results and no crash for out-of-bounds page', async () => {
    // Use a nonsense pageToken
    const { results, nextPageToken } = await mcpClient.listResourceTemplates({ pageToken: 'nonexistent', pageSize: 2 });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
    expect(nextPageToken).toBeUndefined();
  });

  it('returns error for negative page size', async () => {
    let error;
    try {
      await mcpClient.listResources({ pageSize: -5 });
    } catch (err: unknown) {
      error = err;
    }
    expect(error).toBeDefined();
    expect(error instanceof Error ? error.message : error).toMatch(/invalid|page/i);
  });
});
