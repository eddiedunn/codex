import type { McpServersConfig } from "./mcp-config";

/**
 * Aggregates tools/resources from all MCP servers defined in config.
 * Accepts an MCP client instance and config, returns a flat array of tools/resources, each tagged with its server.
 * The mcpClient must have a listTools() method returning a Promise<Array<any>>.
 */
export async function aggregateMcpToolsGeneric({
  mcpConfig,
  mcpClientFactory,
}: {
  mcpConfig: McpServersConfig;
  mcpClientFactory: (serverName: string) => { listTools: () => Promise<any[]> };
}): Promise<Array<{ server: string; tool: any }>> {
  if (!mcpConfig) throw new Error('No MCP config loaded');
  const results: Array<{ server: string; tool: any }> = [];
  for (const serverName of Object.keys(mcpConfig.mcpServers)) {
    try {
      const client = mcpClientFactory(serverName);
      const tools = await client.listTools();
      for (const tool of tools) {
        results.push({ server: serverName, tool });
      }
    } catch (err) {
      if (process.env['CLI_DEBUG'] || process.env['NODE_ENV'] === 'development') {
        console.warn(`[MCP] Failed to list tools for server '${serverName}':`, err);
      }
    }
  }
  return results;
}
