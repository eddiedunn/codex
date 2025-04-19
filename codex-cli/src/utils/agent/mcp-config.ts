// TypeScript interfaces for Claude Desktop MCP config

export interface McpServersConfig {
  mcpServers: Record<string, McpServerEntry>;
}

export interface McpServerEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}
