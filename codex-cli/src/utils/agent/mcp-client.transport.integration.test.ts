// REAL MCP SERVER INTEGRATION TEST
// To run this test, ensure a real MCP server is running and MCP_SERVER_URL/MCP_TRANSPORT are set appropriately.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startMcpServer, stopMcpServer } from './mcp-server-lifecycle';
import type { ChildProcessWithoutNullStreams } from 'child_process';

const MCP_CLIENT_PATH = './mcp-client';
const STDIO_SERVER_NAME = 'server-everything';

let mcpProc: ChildProcessWithoutNullStreams | undefined;

// Use the official MCP server-everything for this test
const MCP_SERVER_COMMAND = 'npx';
const MCP_SERVER_ARGS = ['-y', '@modelcontextprotocol/server-everything'];
const MCP_SERVER_ENV = {};

beforeAll(async () => {
  vi.resetModules();
  mcpProc = startMcpServer(MCP_SERVER_COMMAND, MCP_SERVER_ARGS, MCP_SERVER_ENV);
  // Wait a few seconds for the server to be ready (should ideally poll for readiness)
  await new Promise(res => setTimeout(res, 3000));
  process.env['MCP_SERVER_URL'] = 'http://localhost:9999'; // fallback, not used for stdio
  process.env['MCP_TRANSPORT'] = 'http';
});

afterAll(() => {
  if (mcpProc) stopMcpServer(mcpProc);
});

describe('MCP Client Transport Integration (server-everything)', () => {
  it('connects and instantiates MCP client with server-everything', async () => {
    const { createMcpClient } = await import(MCP_CLIENT_PATH);
    const client = await createMcpClient({ stdioServerName: STDIO_SERVER_NAME });
    expect(client).toBeTruthy();
  });

  it('invokes listTools on server-everything (correct structure)', async () => {
    const { createMcpClient } = await import(MCP_CLIENT_PATH);
    const client = await createMcpClient({ stdioServerName: STDIO_SERVER_NAME });
    expect(client).toBeTruthy();
    if (typeof client.listTools === 'function') {
      const result = await client.listTools();
      expect(result).toHaveProperty('tools');
      expect(Array.isArray(result.tools)).toBe(true);
      expect(result.tools.length).toBeGreaterThan(0);
      // Log tool names for diagnostics
      const toolNames = result.tools.map((t: any) => t.name);
      console.log('[MCP][TEST][DIAG] tool names:', toolNames);
      // Just assert at least one tool exists
      expect(toolNames.length).toBeGreaterThan(0);
    } else {
      throw new Error('MCP client does not expose a listTools() method');
    }
  });

  it('invokes a tool on server-everything (callTool)', async () => {
    const { createMcpClient } = await import(MCP_CLIENT_PATH);
    const client = await createMcpClient({ stdioServerName: STDIO_SERVER_NAME });
    expect(client).toBeTruthy();
    if (typeof client.callTool === 'function') {
      // List tools to pick a valid one
      const tools = (await client.listTools()).tools;
      let tool = tools.find((t: any) => t.name === 'add');
      let toolName, inputSchema, payload;
      if (tool) {
        toolName = tool.name;
        inputSchema = tool.inputSchema;
        payload = { a: 1, b: 2 };
        console.log('[MCP][TEST][DIAG] Invoking tool: add with payload:', payload);
      } else {
        tool = tools[0];
        toolName = tool?.name;
        inputSchema = tool?.inputSchema;
        // Build a valid payload for the required fields
        payload = {};
        if (inputSchema && Array.isArray(inputSchema.required)) {
          for (const field of inputSchema.required) {
            const prop = inputSchema.properties[field];
            if (prop) {
              if (prop.type === 'string') {
                payload[field] = 'hello MCP';
              } else if (prop.type === 'number') {
                payload[field] = 1;
              } else if (prop.type === 'boolean') {
                payload[field] = true;
              } else if (prop.type === 'object') {
                payload[field] = {};
              } else if (prop.type === 'array') {
                payload[field] = [];
              } else {
                payload[field] = null;
              }
            }
          }
        }
        console.log(`[MCP][TEST][DIAG] Invoking tool: ${toolName} with payload:`, payload);
      }
      let result;
      try {
        result = await client.callTool(toolName, payload);
        console.log('[MCP][TEST][DIAG] callTool result:', result);
        expect(result).toBeTruthy();
      } catch (err) {
        console.error('[MCP][TEST][ERROR] callTool threw:', err);
        throw err;
      }
    } else {
      console.log('[MCP][TEST][DIAG] client prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));
      throw new Error('MCP client does not expose a callTool() method');
    }
  }, 30000);

  it('diagnostics: log all client methods and prototype', async () => {
    const { createMcpClient } = await import(MCP_CLIENT_PATH);
    const client = await createMcpClient({ stdioServerName: STDIO_SERVER_NAME });
    expect(client).toBeTruthy();
    // Log all own property keys
    console.log('[MCP][TEST][DIAG] client keys:', Object.keys(client));
    // Log all prototype method names
    const proto = Object.getPrototypeOf(client);
    console.log('[MCP][TEST][DIAG] client prototype keys:', Object.getOwnPropertyNames(proto));
    // Optionally log the prototype itself
    // console.log('[MCP][TEST][DIAG] client prototype:', proto);
  });
});
