// TypeScript interfaces for Claude Desktop MCP config

export interface McpServersConfig {
  mcpServers: Record<string, McpServerEntry>;
}

export type McpServerEntry = StdioMcpServerEntry | SseMcpServerEntry;

export interface StdioMcpServerEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface SseMcpServerEntry {
  url: string;
  env?: Record<string, string>;
}
