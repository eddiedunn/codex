// @ts-ignore MCP SDK package has no types and is not ESM-compatible with Vitest
import { McpClient, HttpClientTransport } from "@modelcontextprotocol/sdk";

const MCP_SERVER_URL = process.env["MCP_SERVER_URL"] || "http://localhost:8080";
export const mcpClient = new McpClient(new HttpClientTransport(MCP_SERVER_URL));

export async function listMcpTools() {
  return await mcpClient.listTools();
}

export async function invokeMcpTool(toolName: string, params: Record<string, any>) {
  return await mcpClient.invokeTool(toolName, params);
}
