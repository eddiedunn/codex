import { getMcpClientInstance } from './mcp-client';

console.log('[SMOKE TEST] import succeeded');

(async () => {
  try {
    const client = await getMcpClientInstance();
    console.log('[SMOKE TEST] getMcpClientInstance resolved:', client);
  } catch (err) {
    console.log('[SMOKE TEST] getMcpClientInstance threw:', err);
  }
})();
