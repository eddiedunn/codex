// @ts-nocheck
/**
 * Minimal HTTP MCP mock server for integration testing.
 * Transport: HTTP (JSON-RPC 2.0)
 * Usage: node mcp-http-mock-server.js --port=12345
 * ESM-compatible (import syntax)
 */
import { createServer } from 'node:http';
import { parse } from 'node:url';

// Dynamic import workaround for @modelcontextprotocol/sdk
let MCPServer;
(async () => {
  const sdk = await import('@modelcontextprotocol/sdk');
  MCPServer = sdk.MCPServer;

  // Parse port from --port=xxxx or default to 3000
  const portArg = process.argv.find(arg => arg.startsWith('--port='));
  const port = portArg ? parseInt(portArg.replace('--port=', '')) : 3000;

  // Define minimal MCP resources/tools (parity with stdio mock)
  const resources = [
    {
      uri: 'mock://resource/1',
      name: 'mock://resource/1',
      description: 'Mock Resource (HTTP)',
      mimeType: 'text/plain',
    },
  ];

  const server = new MCPServer({
    resources,
    tools: [
      {
        name: 'echo',
        description: 'Echo a message',
        parameters: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
          required: ['message'],
        },
        execute: async ({ message }) => ({ message }),
      },
    ],
  });

  const httpServer = createServer(async (req, res) => {
    if (req.method !== 'POST' || parse(req.url).pathname !== '/') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', async () => {
      try {
        const json = JSON.parse(body);
        const response = await server.handle(json);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad request', details: e.message }));
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(`[HTTP MCP MOCK] Listening on http://localhost:${port}`);
  });
})();
