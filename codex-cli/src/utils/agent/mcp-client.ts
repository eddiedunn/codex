// @ts-ignore MCP SDK package has no types and is not ESM-compatible with Vitest
import { createRequire } from 'module';
import path from 'path';
import { loadMcpConfig } from './load-mcp-config';
import os from 'os';
import { spawn } from 'child_process';
import type { McpServersConfig } from './mcp-config';

const require = createRequire(import.meta.url);

const sdkPackageRoot = path.dirname(require.resolve('@modelcontextprotocol/sdk/package.json'));
const sdkEntry = sdkPackageRoot.endsWith('dist/cjs')
  ? path.join(sdkPackageRoot, 'client/index.js')
  : path.join(sdkPackageRoot, 'dist/cjs/client/index.js');
const { McpClient, HttpClientTransport } = require(sdkEntry);

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

const MCP_SERVER_URL = resolveMcpServerUrl();
export const mcpClient = new McpClient(new HttpClientTransport(MCP_SERVER_URL));

export async function listMcpTools() {
  return await mcpClient.listTools();
}

export async function invokeMcpTool(toolName: string, params: Record<string, any>) {
  return await mcpClient.invokeTool(toolName, params);
}

export { mcpConfig };
