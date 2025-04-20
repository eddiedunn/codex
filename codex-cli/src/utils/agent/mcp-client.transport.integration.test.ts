import { describe, it, expect, vi, beforeEach } from "vitest";

// Dynamically import the MCP client module so env vars are respected per test
const MCP_CLIENT_PATH = "./mcp-client";

// Mock config for stdio
const mockMcpConfig = {
  mcpServers: {
    local: {
      command: "echo",
      args: ["mock-server-started"],
      env: { FOO: "bar" },
    },
  },
};

describe("MCP Client Transport Integration", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.MCP_SERVER_URL = "http://localhost:9999";
    delete process.env.MCP_TRANSPORT;
  });

  it("uses HTTP/SSE transport by default", async () => {
    const { mcpClient } = await import(MCP_CLIENT_PATH);
    expect(mcpClient.constructor.name).toBe("Client");
    expect(mcpClient._options.transport).toBe("http");
    expect(mcpClient._options.url).toBe("http://localhost:9999");
  });

  it("uses HTTP/SSE transport when MCP_TRANSPORT=http", async () => {
    process.env.MCP_TRANSPORT = "http";
    const { mcpClient } = await import(MCP_CLIENT_PATH);
    expect(mcpClient.constructor.name).toBe("Client");
    expect(mcpClient._options.transport).toBe("http");
    expect(mcpClient._options.url).toBe("http://localhost:9999");
  });

  it("uses stdio transport when MCP_TRANSPORT=stdio", async () => {
    process.env.MCP_TRANSPORT = "stdio";
    // Patch the config loader to inject our mock config
    vi.doMock("./load-mcp-config", () => ({
      loadMcpConfig: () => mockMcpConfig,
    }));
    // Re-import with mock in place
    const { mcpClient } = await import(MCP_CLIENT_PATH);
    expect(mcpClient.constructor.name).toBe("Client");
    expect(mcpClient._options.transport).toBe("stdio");
    expect(mcpClient._options.command).toBe("echo");
    expect(mcpClient._options.args).toContain("mock-server-started");
  });
});
