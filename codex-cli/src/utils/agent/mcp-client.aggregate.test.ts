import { describe, it, expect, vi, beforeEach } from "vitest";
import { aggregateMcpTools } from "./mcp-client";

// We'll mock mcpClient.listTools and mcpConfig
vi.mock("./mcp-client", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    mcpClient: {
      listTools: vi.fn(),
    },
  };
});

describe("aggregateMcpTools", () => {
  let mcpConfigBackup: any;
  beforeEach(() => {
    // Patch mcpConfig directly (not ideal, but necessary for ESM singleton)
    const mcpClientMod = require("./mcp-client");
    mcpConfigBackup = mcpClientMod.mcpConfig;
    mcpClientMod.mcpConfig = {
      mcpServers: {
        serverA: { command: "foo", args: [] },
        serverB: { command: "bar", args: [] },
      },
    };
  });
  afterEach(() => {
    // Restore original config
    require("./mcp-client").mcpConfig = mcpConfigBackup;
    vi.clearAllMocks();
  });

  it("aggregates tools from all servers", async () => {
    const mcpClientMod = require("./mcp-client");
    mcpClientMod.mcpClient.listTools
      .mockResolvedValueOnce([{ name: "toolA1" }, { name: "toolA2" }])
      .mockResolvedValueOnce([{ name: "toolB1" }]);
    const result = await aggregateMcpTools();
    expect(result).toEqual([
      { server: "serverA", tool: { name: "toolA1" } },
      { server: "serverA", tool: { name: "toolA2" } },
      { server: "serverB", tool: { name: "toolB1" } },
    ]);
  });

  it("handles error from one server but continues", async () => {
    const mcpClientMod = require("./mcp-client");
    mcpClientMod.mcpClient.listTools
      .mockRejectedValueOnce(new Error("failA"))
      .mockResolvedValueOnce([{ name: "toolB1" }]);
    const result = await aggregateMcpTools();
    expect(result).toEqual([
      { server: "serverB", tool: { name: "toolB1" } },
    ]);
  });

  it("throws if no config loaded", async () => {
    const mcpClientMod = require("./mcp-client");
    mcpClientMod.mcpConfig = undefined;
    await expect(aggregateMcpTools()).rejects.toThrow(/No MCP config/);
  });
});
