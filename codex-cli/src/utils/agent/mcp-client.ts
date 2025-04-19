// @ts-ignore MCP SDK package has no types and is not ESM-compatible with Vitest
import { createRequire } from 'module';
import path from 'path';
const require = createRequire(import.meta.url);

const sdkPackageRoot = path.dirname(require.resolve('@modelcontextprotocol/sdk/package.json'));
// Removed debug logs for sdkPackageRoot and sdkEntry
const sdkEntry = sdkPackageRoot.endsWith('dist/cjs')
  ? path.join(sdkPackageRoot, 'client/index.js')
  : path.join(sdkPackageRoot, 'dist/cjs/client/index.js');
const { McpClient, HttpClientTransport } = require(sdkEntry);

const MCP_SERVER_URL = process.env["MCP_SERVER_URL"] || "http://localhost:8080";
export const mcpClient = new McpClient(new HttpClientTransport(MCP_SERVER_URL));

export async function listMcpTools() {
  return await mcpClient.listTools();
}

export async function invokeMcpTool(toolName: string, params: Record<string, any>) {
  return await mcpClient.invokeTool(toolName, params);
}
