console.log('[MCP][DIAG] mcp-client.ts top-level loaded');

// @ts-ignore MCP SDK package has no types and is not ESM-compatible with Vitest
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import type { McpServersConfig } from './mcp-config.js';
import { aggregateMcpToolsGeneric } from "./aggregate-mcp-tools.js";
import axios from 'axios';
import { lookpath } from 'lookpath';
import * as fs from 'fs';

// Use the CJS proxy for MCP SDK Client
let Client: any;
async function getClient() {
  if (!Client) {
    Client = (await import('./mcp-sdk-cjs-proxy.cjs')).Client;
  }
  return Client;
}

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

// Utility to check if a command exists in PATH
async function checkCommandAvailable(cmd: string): Promise<boolean> {
  return !!(await lookpath(cmd));
}

// --- Launch MCP server and wait for ready message ---
export async function launchMcpServer(serverName: string): Promise<void> {
  const entry = mcpConfig?.mcpServers?.[serverName];
  if (!entry) throw new Error(`No MCP server entry for '${serverName}'`);
  if (entry.process) {
    // Already launched
    return;
  }
  const env = { ...process.env, ...entry.env };
  const cmd = entry.command;
  const args = entry.args || [];
  console.log(`[MCP] Launching MCP stdio server '${serverName}' with command: ${cmd} ${args.join(' ')} | env: ${JSON.stringify(entry.env)}`);
  const proc = spawn(cmd, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
  entry.process = proc;
  proc.stdout.setEncoding('utf8');
  proc.stderr.setEncoding('utf8');

  // Wait for ready message on stdout
  await new Promise<void>((resolve, reject) => {
    let ready = false;
    const timeout = setTimeout(() => {
      if (!ready) {
        console.warn(`[MCP][${serverName}] WARNING: Server did not become ready after 5s.`);
        resolve(); // Still resolve, but warn
      }
    }, 5000);
    proc.stdout.on('data', (data: string) => {
      if (data.includes('MCP Server running on stdio')) {
        if (!ready) {
          ready = true;
          clearTimeout(timeout);
          console.log(`[MCP][${serverName}] MCP server is ready.`);
          resolve();
        }
      }
    });
    proc.stderr.on('data', (data: string) => {
      console.log(`[MCP][${serverName}] stderr: ${data}`);
      if (data.includes('MCP Server running on stdio')) {
        if (!ready) {
          ready = true;
          clearTimeout(timeout);
          console.log(`[MCP][${serverName}] MCP server is ready (stderr).`);
          resolve();
        }
      }
    });
    proc.on('exit', (code) => {
      if (!ready) {
        clearTimeout(timeout);
        reject(new Error(`[MCP][${serverName}] MCP server exited before ready (code ${code})`));
      }
    });
  });
}

// Utility to check if MCP server is running
export async function isMcpServerRunning(url: string): Promise<boolean> {
  try {
    // Try a health endpoint or root; adjust as needed for your MCP server
    const res = await axios.get(url + '/health');
    return res.status === 200;
  } catch {
    return false;
  }
}

// Wrap connect to auto-start server if needed
export async function connectWithAutoStart(client: any, serverName: string, url: string, timeoutMs = 10000) {
  if (!(await isMcpServerRunning(url))) {
    await launchMcpServer(serverName);
    // Wait for server to come up
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await isMcpServerRunning(url)) break;
      await new Promise(res => setTimeout(res, 500));
    }
    if (!(await isMcpServerRunning(url))) {
      throw new Error('MCP server failed to start');
    }
  }
  await client.connect();
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
export async function createMcpClient(opts: { stdioServerName?: string } = {}) {
  // Always load config at call time to respect test mocks
  let mcpConfigLocal: McpServersConfig | undefined;
  try {
    // Use dynamic require to avoid module cache issues with mocks
    mcpConfigLocal = (await import('./load-mcp-config.js')).loadMcpConfig(discoverMcpConfigPath());
  } catch (err) {
    try {
      mcpConfigLocal = (await import('./load-mcp-config.js')).loadMcpConfig(path.resolve(process.cwd(), 'claude_desktop_config.json'));
    } catch (e) {
      mcpConfigLocal = undefined;
      if (process.env["CLI_DEBUG"] || process.env["NODE_ENV"] === "development") {
        console.warn('[MCP] No valid MCP config found (dynamic):', err, e);
      }
    }
  }
  // Diagnostic logging
  console.log('[MCP][DEBUG][createMcpClient] mcpConfigLocal:', JSON.stringify(mcpConfigLocal, null, 2));

  let transportType: 'stdio' | 'http' | 'sse' = 'http';
  let selectedServer: any = undefined;
  if (opts.stdioServerName) {
    selectedServer = mcpConfigLocal?.mcpServers[opts.stdioServerName];
    transportType = 'stdio';
  } else {
    // Prefer explicit stdio servers, else HTTP/SSE
    for (const [name, entry] of Object.entries(mcpConfigLocal?.mcpServers || {})) {
      if (entry.command && entry.command === 'npx' && entry.args?.includes('@modelcontextprotocol/server-brave-search')) {
        selectedServer = entry;
        transportType = 'stdio';
        break;
      } else if (entry.url && entry.url.startsWith('http')) {
        selectedServer = entry;
        transportType = entry.sse ? 'sse' : 'http';
        break;
      }
    }
  }
  if (transportType === 'stdio' && selectedServer) {
    const { command, args, env } = selectedServer;
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
    const transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, ...(env || {}) },
    });
    const client = new Client({
      name: 'codex-cli',
      version: '1.0.0',
    });
    console.log('[MCP][DEBUG] Connecting MCP Client to stdio transport:', { command, args, env });
    await client.connect(transport);
    return client;
  } else if (selectedServer && selectedServer.url) {
    console.log('[MCP][DEBUG] Creating MCP Client with HTTP/SSE url:', selectedServer.url, 'transport:', transportType);
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    return new Client(selectedServer.url, { transport: transportType });
  }
  // Fallback: try MCP_SERVER_URL env or default
  const url = process.env.MCP_SERVER_URL || 'http://localhost:8080';
  console.log('[MCP][DEBUG] Creating MCP Client with fallback url:', url);
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  return new Client(url, { transport: 'http' });
}

// Factory function for MCP client, always creates after mocks are set
export async function getMcpClientInstance() {
  return await createMcpClient();
}

// Legacy/async getters remain for backward compatibility
export function getMcpClient() { return getMcpClientInstance(); }

export async function listMcpTools() {
  const client = await getMcpClientInstance();
  return await client.listTools();
}

export async function invokeMcpTool(toolName: string, params: Record<string, any>) {
  const client = await getMcpClientInstance();
  return await client.invokeTool(toolName, params);
}

/**
 * Aggregates tools/resources from all MCP servers using the real MCP client and config.
 * Returns a flat array of tools/resources, each tagged with its server.
 */
export async function aggregateMcpTools(): Promise<Array<{ server: string; tool: any }>> {
  // Log MCP config path and contents
  const configPath = process.env.MCP_CONFIG_PATH || '~/.codex/mcp_servers.json (default)';
  console.log(`[DEBUG][MCP] aggregateMcpTools called. MCP_CONFIG_PATH: ${configPath}`);
  if (!mcpConfig) {
    console.log('[DEBUG][MCP] No MCP config loaded in aggregateMcpTools');
    return [];
  }
  console.log(`[DEBUG][MCP] MCP config loaded: ${JSON.stringify(mcpConfig, null, 2)}`);
  try {
    const client = await getMcpClientInstance();
    console.log(`[DEBUG][MCP] typeof mcpClient: ${typeof client}, mcpClient:`, client);
    if (!client) {
      console.error('[DEBUG][MCP] mcpClient is undefined or null!');
      return [];
    }
    if (typeof client.listTools !== 'function') {
      console.error('[DEBUG][MCP] mcpClient.listTools is not a function! mcpClient:', client);
      return [];
    }
    console.log('[DEBUG][MCP] Calling mcpClient.listTools()...');
    let listToolsResult;
    try {
      listToolsResult = await client.listTools();
      console.log(`[DEBUG][MCP] mcpClient.listTools() result:`, JSON.stringify(listToolsResult, null, 2));
    } catch (err) {
      console.error('[DEBUG][MCP] Error calling mcpClient.listTools():', err);
      return [];
    }
    const tools = await aggregateMcpToolsGeneric({
      mcpConfig,
      mcpClientFactory: async (_serverName) => client,
    });
    console.log(`[DEBUG][MCP] aggregateMcpTools loaded ${tools.length} tools.`);
    return tools;
  } catch (err) {
    console.error('[DEBUG][MCP] Top-level error in aggregateMcpTools:', err);
    return [];
  }
}

// --- DEBUG: Log MCP tool aggregation ---
export async function debugAggregateMcpTools() {
  if (!mcpConfig) {
    console.log('[DEBUG] No MCP config loaded in debugAggregateMcpTools');
    return [];
  }
  const { aggregateMcpToolsGeneric } = await import('./aggregate-mcp-tools.js');
  // Use correct per-server stdio/HTTP client creation logic
  const mcpClientFactory = async (serverName: string) => {
    const entry = mcpConfig.mcpServers[serverName];
    if (entry.command) {
      // STDIO SERVER (Brave, etc)
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
      const transport = new StdioClientTransport({
        command: entry.command,
        args: entry.args,
        env: { ...process.env, ...(entry.env || {}) },
      });
      const client = new Client({ name: 'codex-cli', version: '1.0.0' });
      console.log('[MCP][DEBUG] Connecting MCP Client to stdio transport:', { command: entry.command, args: entry.args, env: entry.env });
      await client.connect(transport);
      return client;
    } else if (entry.url) {
      // HTTP/SSE SERVER
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      console.log('[MCP][DEBUG] Creating MCP Client with HTTP/SSE url:', entry.url);
      return new Client(entry.url, { transport: entry.sse ? 'sse' : 'http' });
    }
    return null;
  };
  const results: Array<{ server: string; tool: any }> = [];
  const skippedServers: string[] = [];
  for (const serverName of Object.keys(mcpConfig.mcpServers)) {
    try {
      console.log(`[MCP] Listing tools for server '${serverName}'...`);
      const client = await mcpClientFactory(serverName);
      if (!client) {
        skippedServers.push(serverName);
        continue;
      }
      const toolsRaw = await client.listTools();
      // Fix: Support both array and { tools: array } response
      const tools = Array.isArray(toolsRaw) ? toolsRaw : toolsRaw?.tools;
      if (!Array.isArray(tools)) {
        throw new Error(`Unexpected tools format from server '${serverName}': ${JSON.stringify(toolsRaw)}`);
      }
      console.log(`[MCP][${serverName}] listTools() returned:`, JSON.stringify(tools));
      for (const tool of tools) {
        results.push({ server: serverName, tool });
      }
    } catch (err) {
      console.error(`[MCP][${serverName}] Failed to list tools:`, err);
      skippedServers.push(serverName);
    }
  }
  if (skippedServers.length > 0) {
    console.warn(`[MCP] Skipped servers due to missing or broken binaries: ${skippedServers.join(', ')}`);
  }
  console.log('[DEBUG] Raw MCP tools loaded:', JSON.stringify(results, null, 2));
  return results;
}

export { mcpConfig };
export { aggregateMcpToolsGeneric } from "./aggregate-mcp-tools.js";
