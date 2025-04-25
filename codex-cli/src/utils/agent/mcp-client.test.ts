import { describe, it, expect, vi } from 'vitest';
import { MinimalMcpClient, McpClientOptions } from './mcp-client';

describe('MinimalMcpClient', () => {
  const options: McpClientOptions = { transport: 'stdio', stdioPath: '/bin/echo' };
  it('should instantiate and be disconnected by default', () => {
    const client = new MinimalMcpClient(options);
    expect(client.isConnected()).toBe(false);
  });

  it('should throw on request and notify (not implemented)', async () => {
    const client = new MinimalMcpClient(options);
    await expect(client.request('foo')).rejects.toThrow('Not implemented');
    await expect(client.notify('bar')).rejects.toThrow('Not implemented');
  });

  it('should register notification handlers', () => {
    const client = new MinimalMcpClient(options);
    const handler = vi.fn();
    client.onNotification(handler);
    // Simulate notification event
    // @ts-expect-error private access for test
    client.notificationEmitter.emit('notification', 'test.method', { foo: 1 });
    expect(handler).toHaveBeenCalledWith('test.method', { foo: 1 });
  });
});
