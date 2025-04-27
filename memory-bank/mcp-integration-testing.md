# MCP Integration Testing Paradigm (mcptools Baseline)

_Last updated: 2025-04-26_

## Overview

All MCP protocol integration tests are now run against the [mcptools](https://github.com/f/mcptools) mock/proxy server. This ensures:

- True real-world interoperability (not just spec compliance)
- Robust, ecosystem-compatible behaviors
- Easy debugging via mcptools logs

## Implementation Pattern

- **Test Setup:** Spawn the `mcp mock ...` or `mcp proxy ...` process in `beforeAll`.
- **Client Connection:** Connect your client to the mock server's stdio transport.
- **Assertions:** Run all protocol assertions (tools, resources, error handling, etc.) against this live server.
- **Cleanup:** Kill the subprocess in `afterAll`.

## Example (Vitest + TypeScript)

```ts
import { spawn } from "child_process";
import { MinimalMcpClient } from "./mcp-client";

describe("MCP integration (mcptools mock)", () => {
  let mockProcess: any;
  let client: MinimalMcpClient;

  beforeAll(async () => {
    mockProcess = spawn(
      "mcp",
      [
        "mock",
        "tool",
        "hello_world",
        "A simple greeting tool",
        "resource",
        "docs://readme",
        "Documentation",
        "This is a mock resource",
      ],
      { stdio: ["pipe", "pipe", "pipe"], env: { ...process.env } },
    );
    await new Promise((res) => setTimeout(res, 1000));
    client = new MinimalMcpClient({
      transport: "stdio",
      process: mockProcess,
    });
    await client.connect();
  });

  afterAll(async () => {
    if (mockProcess) mockProcess.kill();
    await client.disconnect();
  });

  it("should list resources", async () => {
    const resources = await client.listResources();
    expect(Array.isArray(resources.results)).toBe(true);
    expect(resources.results[0]).toHaveProperty("uri");
  });
});
```

## Rationale

- mcptools is the de facto reference for MCP protocol compatibility.
- Passing tests against mcptools means your implementation will work with most real-world MCP servers/clients.
- This approach replaces the previous reliance on the "everything" reference server.

## Migration Status

- All integration tests in `codex-cli/src/utils/agent/` now use this pattern.
- No further test migration needed in this directory as of 2025-04-26.

## Next Steps

- Apply this paradigm to any new MCP protocol integration tests.
- Expand to other directories as new features are added.
- Keep this doc updated as the testing approach evolves.
