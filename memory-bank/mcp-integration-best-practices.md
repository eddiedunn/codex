# MCP Integration Best Practices & Implementation Patterns

_Last updated: 2025-04-24_

## Overview

This document collects best practices, code snippets, and implementation details for robust, multi-source MCP (Model Context Protocol) client integration. It includes general patterns and Brave MCP server specifics.

---

## 1. Multi-Server Support & Connection Management

- **Connection Manager Pattern:**
  - Use a central manager to handle connections to multiple MCP servers (HTTP, stdio, Docker, NPX, etc.).
  - Each server should be independently connectable/disconnectable.
  - Aggregate tools from all servers, but handle failures per-server.

```typescript
class MCPConnectionManager {
  private connections: Map<string, Client> = new Map();

  async connectToServer(id: string, command: string, args: string[]): Promise<Client> {
    const client = new Client(...); // see SDK docs
    const transport = new StdioClientTransport({ command, args });
    await client.connect(transport);
    await client.initialize();
    this.connections.set(id, client);
    return client;
  }

  async getAllTools(): Promise<{ serverId: string, tools: any[] }[]> {
    const results = await Promise.all(
      Array.from(this.connections.entries()).map(async ([id, client]) => {
        try {
          const tools = await client.listTools();
          return { serverId: id, tools: tools.tools };
        } catch (error) {
          console.error(`Error getting tools from server ${id}:`, error);
          return { serverId: id, tools: [] };
        }
      })
    );
    return results;
  }
}
```

---

## 2. Error Handling & Logging

- **Pre-Spawn Existence Check:**
  - Before spawning a stdio/Docker/NPX server, check if the binary/command exists (with `fs.existsSync` or `which`).
  - If the command is missing, log a clear, actionable error and skip that server.
- **Graceful Degradation:**
  - Never let one broken server block the rest; always degrade gracefully.
- **Per-Server Logging:**
  - Log connection attempts, failures, and tool listing errors per server.
  - Summarize skipped/broken servers at the end of aggregation.
- **Timeouts:**
  - Use timeouts for server startup and tool listing to avoid hangs.
- **Cleanup:**
  - On error, ensure resources (connections, processes) are cleaned up.

---

## 3. Security & Validation

- **Principle of Least Privilege:**
  - Only request/enable the capabilities you need.
- **Defense in Depth:**
  - Validate all server responses, never blindly trust remote data.
- **Testing & Validation:**
  - Test with a variety of MCP servers (HTTP, stdio, Docker, NPX, custom) and simulate failures.
- **Security Hygiene:**
  - Use fine-grained access controls, keep dependencies updated, and review security practices regularly.

---

## 4. Configuration Flexibility

- **Support all launch types:**
  - HTTP URL, stdio command, Docker, NPX.
- **Environment Variables:**
  - Support env injection for secrets (e.g., API keys).

**Example MCP config for Brave (Docker & NPX):**

```json
{
  "mcpServers": {
    "brave-search-docker": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "BRAVE_API_KEY", "mcp/brave-search"],
      "env": { "BRAVE_API_KEY": "YOUR_API_KEY_HERE" }
    },
    "brave-search-npx": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": { "BRAVE_API_KEY": "YOUR_API_KEY_HERE" }
    }
  }
}
```

---

## 5. Brave MCP Server Peculiarities

- **Do NOT use npm install:** The published npm package is often incomplete; prefer NPX or Docker.
- **API Key Required:** Always set `BRAVE_API_KEY` in the environment.
- **Docker:** Ensure Docker is installed and the image is available.
- **NPX:** Requires network access and npm registry availability.
- **Log actual command/environment** used to launch for troubleshooting.

---

## 6. Implementation Snippet: Robust MCP Tool Aggregation

```typescript
import * as fs from "fs";
import * as path from "path";

async function trySpawnServer(entry) {
  const cmdPath =
    entry.command.startsWith(".") || entry.command.startsWith("/")
      ? path.resolve(process.cwd(), entry.command)
      : entry.command;
  if (
    cmdPath &&
    !fs.existsSync(cmdPath) &&
    !["docker", "npx"].includes(cmdPath)
  ) {
    console.error(`[MCP] Command not found: ${cmdPath}`);
    return null;
  }
  // ...spawn logic...
}

async function aggregateMcpTools(mcpServers) {
  const results = [];
  const skipped = [];
  for (const [name, entry] of Object.entries(mcpServers)) {
    try {
      if (entry.command && !["docker", "npx"].includes(entry.command)) {
        const cmdPath = path.resolve(process.cwd(), entry.command);
        if (!fs.existsSync(cmdPath)) {
          console.error(`[MCP][${name}] Command not found: ${cmdPath}`);
          skipped.push(name);
          continue;
        }
      }
      // ...connect and list tools...
    } catch (err) {
      console.error(`[MCP][${name}] Error:`, err);
      skipped.push(name);
    }
  }
  if (skipped.length > 0) {
    console.warn(`[MCP] Skipped servers: ${skipped.join(", ")}`);
  }
  return results;
}
```

---

## 7. MCP SDK Stdio Integration Best Practice (2025-04)

**Always use the official SDK pattern for stdio-based MCP servers:**

1. Import `StdioClientTransport` and instantiate it with `{ command, args, env }` for your server.
2. Instantiate the MCP `Client` with `{ name, version }`.
3. Call `await client.connect(transport)` before making any tool or resource calls.

**Do NOT** pass `{ transport: 'stdio', ... }` directly to the Client constructor—this will not work as expected.

### Example: Connecting to Brave MCP Server via stdio

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-brave-search"],
  env: { BRAVE_API_KEY: "..." },
});

const client = new Client({
  name: "codex-cli",
  version: "1.0.0",
});

await client.connect(transport);

// Now you can use client.listTools(), client.callTool(), etc.
```

**Why:** This ensures the child process is attached, the protocol handshake is performed, and all stdio-based MCP servers work reliably with the Codex CLI.

---

## 8. MCP Integration Test & Dependency Injection Pattern

_Last updated: 2025-04-24_

### Key Patterns & Best Practices

- **Dependency Injection:**
  - `AgentLoop` accepts an optional `invokeMcpTool` function for test/mock injection.
  - If provided, this function is always called for MCP tool calls (tool names starting with `mcp.`), bypassing the registry lookup.
  - This enables deterministic, import/mocking-order-agnostic tests.
- **Argument Handling:**
  - MCP tool arguments are always parsed as JSON from the `arguments` field and passed to the injected/mock implementation.
  - Errors in argument parsing or tool invocation are caught and formatted for easy test assertions.
- **Test Robustness:**
  - Tests assert on both the output and error cases, ensuring that the code path is exercised for both successful and failing MCP tool calls.
  - The fallback registry path is only used in production/non-test code.
- **call_id Propagation:**
  - Always include the original `call_id` (or `id`) in the output object for function call outputs, as required by the OpenAI/MCP spec.
- **Error Handling:**
  - All errors are returned as JSON strings for safe parsing and test assertions.

#### Lessons Learned

- Bypassing the registry when a DI function is present is critical for reliable, order-independent testability.
- Always parse and pass arguments explicitly for tool calls to avoid undefined/empty parameter issues in mocks.
- Catch and stringify errors in the DI path for better test diagnostics.

#### Status

- MCP integration logic is robust, merge-ready, and fully testable with Vitest.
- Pattern is now canonical for all future tool-call integrations and tests.

---

## References

- [MCP Client Development Guide](https://github.com/cyanheads/model-context-protocol-resources/blob/main/guides/mcp-client-development-guide.md)
- [Brave MCP Server README](https://github.com/modelcontextprotocol/servers/blob/main/src/brave-search/README.md)
- [Known Issues: Brave MCP Server](https://github.com/modelcontextprotocol/servers/issues/52)

---

This document should be referenced for all future MCP integration, config, and troubleshooting work.
