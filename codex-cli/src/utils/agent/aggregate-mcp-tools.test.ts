import { describe, it, expect, vi, beforeEach } from "vitest";
import { aggregateMcpToolsGeneric } from "./aggregate-mcp-tools.js";

describe("aggregateMcpToolsGeneric", () => {
  let mcpConfig: any;
  let mcpClientFactory: any;

  beforeEach(() => {
    mcpConfig = {
      mcpServers: {
        serverA: { command: "foo", args: [] },
        serverB: { command: "bar", args: [] },
      },
    };
    mcpClientFactory = vi.fn();
  });

  it("aggregates tools from all servers", async () => {
    mcpClientFactory.mockImplementation((serverName: string) => {
      if (serverName === "serverA") {
        return { listTools: () => Promise.resolve([{ name: "toolA1" }, { name: "toolA2" }]) };
      }
      if (serverName === "serverB") {
        return { listTools: () => Promise.resolve([{ name: "toolB1" }]) };
      }
    });
    const result = await aggregateMcpToolsGeneric({ mcpConfig, mcpClientFactory });
    expect(result).toEqual([
      { server: "serverA", tool: { name: "toolA1" } },
      { server: "serverA", tool: { name: "toolA2" } },
      { server: "serverB", tool: { name: "toolB1" } },
    ]);
  });

  it("handles error from one server but continues", async () => {
    mcpClientFactory.mockImplementation((serverName: string) => {
      if (serverName === "serverA") {
        return { listTools: () => Promise.reject(new Error("failA")) };
      }
      if (serverName === "serverB") {
        return { listTools: () => Promise.resolve([{ name: "toolB1" }]) };
      }
    });
    const result = await aggregateMcpToolsGeneric({ mcpConfig, mcpClientFactory });
    expect(result).toEqual([
      { server: "serverB", tool: { name: "toolB1" } },
    ]);
  });

  it("throws if no config loaded", async () => {
    await expect(aggregateMcpToolsGeneric({ mcpConfig: undefined, mcpClientFactory })).rejects.toThrow(/No MCP config/);
  });
});
