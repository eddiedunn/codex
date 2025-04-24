import { loadMcpConfig } from "./load-mcp-config.js";
import type { McpServersConfig } from "./mcp-config.js";
import { spawn } from "child_process";
import os from "os";
import path from "path";

// MCP config loader/discovery logic (duplicated here for test isolation)
function getDefaultMcpConfigPath() {
  return path.join(os.homedir(), ".codex", "mcp_servers.json");
}
function discoverMcpConfigPath() {
  if (process.env["MCP_CONFIG_PATH"]) return process.env["MCP_CONFIG_PATH"]!;
  const cliIdx = process.argv.indexOf("--mcp-config");
  if (cliIdx !== -1 && process.argv.length > cliIdx + 1) {
    return process.argv[cliIdx + 1]!;
  }
  return getDefaultMcpConfigPath();
}

let mcpConfig: McpServersConfig | undefined;
try {
  mcpConfig = loadMcpConfig(discoverMcpConfigPath());
} catch (err) {
  try {
    mcpConfig = loadMcpConfig(path.resolve(process.cwd(), "claude_desktop_config.json"));
  } catch (e) {
    mcpConfig = undefined;
    if (process.env["CLI_DEBUG"] || process.env["NODE_ENV"] === "development") {
      console.warn('[MCP] No valid MCP config found:', err, e);
    }
  }
}

/**
 * Launches all MCP servers defined in the config.
 * Returns a map of server names to ChildProcess objects.
 * Throws if config is missing or empty.
 */
export async function autoLaunchAllMcpServers(): Promise<Record<string, any>> {
  if (!mcpConfig) throw new Error("No MCP config loaded");
  const procs: Record<string, any> = {};
  for (const serverName of Object.keys(mcpConfig.mcpServers)) {
    const entry = mcpConfig.mcpServers[serverName];
    if (!entry) throw new Error(`No server named '${serverName}' in MCP config`);
    procs[serverName] = spawn(entry.command, entry.args, {
      env: { ...process.env, ...(entry.env || {}) },
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: process.platform === 'win32',
    });
  }
  return procs;
}

/**
 * Test-only setter for mcpConfig (for unit tests)
 */
export function _setMcpConfigForTest(config: McpServersConfig | undefined) {
  mcpConfig = config;
}

export { mcpConfig };
