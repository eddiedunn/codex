import { describe, it, expect } from 'vitest';
import { getMcpClientInstance } from './mcp-client';

describe('MCP Client Minimal Import', () => {
  it('should import and instantiate MCP client without hanging', async () => {
    const client = await getMcpClientInstance();
    expect(client).toBeTruthy();
    // Optionally print for debug
    // console.log('[MINIMAL TEST] client:', client);
  });
});
