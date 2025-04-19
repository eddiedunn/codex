import fs from 'fs';
import path from 'path';
import { McpServersConfig } from './mcp-config';

/**
 * Loads and parses the MCP server config file.
 * @param configPath Optional path to config file. Defaults to 'claude_desktop_config.json' in cwd.
 * @returns Parsed config object
 * @throws Error if file not found or invalid
 */
export function loadMcpConfig(configPath?: string): McpServersConfig {
  const resolvedPath = configPath
    ? path.resolve(configPath)
    : path.resolve(process.cwd(), 'claude_desktop_config.json');

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`MCP config not found at: ${resolvedPath}`);
  }
  const raw = fs.readFileSync(resolvedPath, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in MCP config: ${err}`);
  }

  // Basic validation
  if (
    typeof parsed !== 'object' ||
    !parsed ||
    !('mcpServers' in parsed) ||
    typeof (parsed as any).mcpServers !== 'object'
  ) {
    throw new Error('Invalid MCP config structure: missing top-level "mcpServers" object');
  }
  return parsed as McpServersConfig;
}
