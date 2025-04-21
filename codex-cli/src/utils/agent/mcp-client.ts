// @ts-ignore MCP SDK package has no types and is not ESM-compatible with Vitest
import { createRequire } from 'module';
import path from 'path';
import { loadMcpConfig } from './load-mcp-config';
import os from 'os';
import { spawn } from 'child_process';
import type { McpServersConfig } from './mcp-config';
import { aggregateMcpToolsGeneric } from "./aggregate-mcp-tools";

const require = createRequire(import.meta.url);

// Use the CJS proxy for MCP SDK Client
const { Client } = require('./mcp-sdk-cjs-proxy.cjs');

// MCP config loader/discovery logic
function getDefaultMcpConfigPath() {
  return path.join(os.homedir(), '.codex', 'mcp_servers.json');
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
    mcpConfig = loadMcpConfig(path.resolve(process.cwd(), 'claude_desktop_config.json'));
  } catch (e) {
    mcpConfig = undefined;
    if (process.env["CLI_DEBUG"] || process.env["NODE_ENV"] === "development") {
      console.warn('[MCP] No valid MCP config found:', err, e);
    }
  }
}

// Utility to launch a server by name from config
export function launchMcpServer(serverName: string): Promise<ReturnType<typeof spawn>> {
  if (!mcpConfig) throw new Error('No MCP config loaded');
  const entry = mcpConfig.mcpServers[serverName];
  if (!entry) throw new Error(`No server named '${serverName}' in MCP config`);
  const child = spawn(entry.command, entry.args, {
    env: { ...process.env, ...(entry.env || {}) },
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: process.platform === 'win32',
  });
  return Promise.resolve(child);
}

// --- MCP Client Instantiation (Advanced Transport Config) ---
/**
 * Creates an MCP client with support for HTTP/SSE and stdio transports.
 *
 * - HTTP/SSE: Uses MCP_SERVER_URL or first HTTP server in config.
 * - stdio: Uses MCP_STDIO_SERVER (env/config) or first stdio server in config.
 *
 * @param opts Optional overrides: { stdioServerName?: string }
 */
export function createMcpClient(opts: { stdioServerName?: string } = {}) {
  const transportType = process.env["MCP_TRANSPORT"] || "http";
  const clientInfo = { name: "codex", version: "1.0.0" };
  let options;
  if (transportType === "stdio") {
    // Prefer explicit server name via env or opts, else first server
    const stdioServerName = opts.stdioServerName || process.env.MCP_STDIO_SERVER;
    let stdioConfig;
    if (stdioServerName && mcpConfig && mcpConfig.mcpServers[stdioServerName]) {
      stdioConfig = mcpConfig.mcpServers[stdioServerName];
    } else if (mcpConfig) {
      stdioConfig = Object.values(mcpConfig.mcpServers).find(srv => srv.command && srv.args);
    }
    if (!stdioConfig) {
      throw new Error("No MCP server config found for stdio transport");
    }
    options = {
      transport: "stdio",
      command: stdioConfig.command,
      args: stdioConfig.args,
      env: { ...process.env, ...(stdioConfig.env || {}) },
      cwd: process.cwd(),
      shell: process.platform === 'win32',
    };
  } else {
    options = {
      transport: "http",
      url: resolveMcpServerUrl(),
    };
  }
  return new Client(clientInfo, options);
}

// Default export for legacy code
export const mcpClient = createMcpClient();

// Default: Use MCP_SERVER_URL env or first HTTP/SSE server in config, else fallback
function resolveMcpServerUrl(): string {
  if (process.env["MCP_SERVER_URL"]) return process.env["MCP_SERVER_URL"]!;
  if (mcpConfig) {
    for (const [name, entry] of Object.entries(mcpConfig.mcpServers)) {
      // Heuristic: If args contain 'http' or '--port', treat as HTTP/SSE
      if (entry.args.some(arg => typeof arg === 'string' && (arg.startsWith('http') || arg === '--port'))) {
        // Try to find a URL in args
        const urlArg = entry.args.find(arg => typeof arg === 'string' && arg.startsWith('http'));
        if (urlArg) return urlArg;
      }
    }
  }
  return 'http://localhost:8080';
}

export async function listMcpTools() {
  return await mcpClient.listTools();
}

export async function invokeMcpTool(toolName: string, params: Record<string, any>) {
  return await mcpClient.invokeTool(toolName, params);
}

/**
 * Aggregates tools/resources from all MCP servers using the real MCP client and config.
 * Returns a flat array of tools/resources, each tagged with its server.
 */
export async function aggregateMcpTools(): Promise<Array<{ server: string; tool: any }>> {
  if (!mcpConfig) throw new Error('No MCP config loaded');
  // For now, use the same mcpClient instance for all servers (TODO: per-server client)
  return aggregateMcpToolsGeneric({
    mcpConfig,
    mcpClientFactory: (_serverName) => mcpClient,
  });
}

export { mcpConfig };
export { aggregateMcpToolsGeneric } from "./aggregate-mcp-tools";
