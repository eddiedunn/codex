import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "child_process";
import { createMcpClient } from "./mcp-client";
import path from "path";
import { existsSync } from "fs";

// E2E test assumes you have @modelcontextprotocol/server-everything installed globally or locally
// and that it supports an 'echo' tool (as in the reference MCP server)
const SERVER_COMMAND = "npx";
const SERVER_ARGS = [
  "-y",
  "@modelcontextprotocol/server-everything",
  "dir", // start in current dir
  "--port",
  "8099",
  "--tool",
  "echo"
];

let serverProc: any;
let serverOutput: string[] = [];

// Give the server time to start up
async function waitForServerReady(urls: string[], timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) return;
      } catch {
        // not ready yet
      }
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error("MCP server did not become ready in time\nServer output:\n" + serverOutput.join(""));
}

function hasReferenceServer() {
  // Try to detect if @modelcontextprotocol/server-everything is installed globally or locally
  // This is a simple check for the local node_modules or global npm root
  const local = path.join(
    process.cwd(),
    "node_modules",
    "@modelcontextprotocol",
    "server-everything",
    "package.json"
  );
  if (existsSync(local)) return true;
  // Try global npm root
  try {
    const npmRoot = require("child_process")
      .execSync("npm root -g", { encoding: "utf8" })
      .trim();
    const globalPath = path.join(
      npmRoot,
      "@modelcontextprotocol",
      "server-everything",
      "package.json"
    );
    if (existsSync(globalPath)) return true;
  } catch {}
  return false;
}

describe("MCP Client E2E Integration (HTTP/SSE)", () => {
  if (!hasReferenceServer()) {
    it.skip("skipped: @modelcontextprotocol/server-everything is not installed", () => {});
    return;
  }

  beforeAll(async () => {
    serverOutput = [];
    serverProc = spawn(SERVER_COMMAND, SERVER_ARGS, {
      cwd: process.cwd(),
      env: { ...process.env },
      shell: process.platform === "win32"
    });
    serverProc.stdout?.on("data", d => serverOutput.push(`[stdout] ${d}`));
    serverProc.stderr?.on("data", d => serverOutput.push(`[stderr] ${d}`));
    await waitForServerReady([
      "http://localhost:8099/v1/health",
      "http://localhost:8099/health"
    ]);
  }, 20000);

  afterAll(() => {
    if (serverProc) serverProc.kill();
  });

  it("can list tools and call the echo tool", async () => {
    process.env.MCP_SERVER_URL = "http://localhost:8099";
    process.env.MCP_TRANSPORT = "http";
    const client = createMcpClient();
    const tools = await client.listTools();
    const echoTool = tools.find((t: any) => t.name === "echo");
    expect(echoTool).toBeTruthy();
    const result = await client.callTool("echo", { text: "hello e2e" });
    expect(result).toMatch(/hello e2e/i);
  });
});
