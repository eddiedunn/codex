const { spawn } = require('child_process');

// Start mcptools mock server with an echo tool (no parameter signature required)
const mcp = spawn('mcp', [
  'mock',
  'tool',
  'echo',
  'Echoes a message'
], { stdio: ['pipe', 'pipe', 'inherit'] });

// Compose a valid MCP echo request
const request = {
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'echo',
    arguments: { message: 'hello from codex' }
  }
};

// Collect response
let response = '';

mcp.stdout.on('data', (chunk) => {
  response += chunk.toString();
  // Try to parse as soon as we get a full JSON line
  try {
    const lines = response.split('\n').filter(Boolean);
    for (const line of lines) {
      const obj = JSON.parse(line);
      if (obj.id === 1) {
        console.log('[MCP MOCK RESPONSE]', obj);
        mcp.kill();
        process.exit(0);
      }
    }
  } catch (e) {
    // Ignore parse errors, keep buffering
  }
});

// Send the request after a short delay to ensure server is ready
setTimeout(() => {
  mcp.stdin.write(JSON.stringify(request) + '\n');
}, 200);

// Timeout in case of no response
setTimeout(() => {
  console.error('[ERROR] No response from mcptools mock after 3s');
  mcp.kill();
  process.exit(1);
}, 3000);
