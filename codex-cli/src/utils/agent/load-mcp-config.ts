import * as fs from 'fs';
import * as path from 'path';
import { McpServersConfig } from './mcp-config.js';

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

  // Validate each server entry for stdio or sse
  for (const [name, entry] of Object.entries((parsed as any).mcpServers)) {
    if (
      !entry ||
      (typeof entry !== 'object') ||
      (!('command' in entry) && !('url' in entry))
    ) {
      throw new Error(`Invalid MCP server entry for '${name}': must have either 'command' (stdio) or 'url' (sse)`);
    }
    if ('command' in entry) {
      if (!Array.isArray((entry as any).args) || typeof (entry as any).command !== 'string') {
        throw new Error(`Invalid stdio MCP server entry for '${name}': missing or invalid 'command' or 'args'`);
      }
    }
    if ('url' in entry) {
      if (typeof (entry as any).url !== 'string') {
        throw new Error(`Invalid sse MCP server entry for '${name}': missing or invalid 'url'`);
      }
    }
  }
  return parsed as McpServersConfig;
}
