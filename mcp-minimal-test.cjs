const { Client } = require("./node_modules/@modelcontextprotocol/sdk/dist/cjs/client/index.js");

(async () => {
  try {
    const client = new Client({ stdioServerName: 'server-everything' });
    await client.connect();
    const tools = await client.listTools();
    console.log('Tools:', tools);
    const result = await client.callTool('echo', { message: 'Hello MCP!' });
    console.log('Echo result:', result);
    process.exit(0);
  } catch (err) {
    console.error('Error in minimal MCP test:', err);
    process.exit(1);
  }
})();
