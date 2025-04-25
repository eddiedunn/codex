import { createMcpClient } from '@modelcontextprotocol/sdk';

async function main() {
  const client = await createMcpClient({ stdioServerName: 'server-everything' });
  const tools = await client.listTools();
  console.log('Tools:', tools);
  const result = await client.invokeTool('echo', { message: 'Hello MCP!' });
  console.log('Echo result:', result);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error in minimal MCP test:', err);
  process.exit(1);
});
