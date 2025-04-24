import { describe, it, expect, vi, beforeEach } from "vitest";
import { autoLaunchAllMcpServers, _setMcpConfigForTest } from "./auto-launch-mcp.js";
import { spawn } from "child_process";

vi.mock("child_process", () => {
  return {
    spawn: vi.fn(() => ({ pid: Math.floor(Math.random() * 10000) }))
  };
});

describe("autoLaunchAllMcpServers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _setMcpConfigForTest({
      mcpServers: {
        foo: { command: "echo", args: ["foo"] },
        bar: { command: "echo", args: ["bar"] },
      },
    });
  });

  it("launches all servers in config", async () => {
    const result = await autoLaunchAllMcpServers();
    expect(spawn).toHaveBeenCalledTimes(2);
    expect(Object.keys(result).sort()).toEqual(["bar", "foo"]);
    expect(result["foo"]).toHaveProperty("pid");
    expect(result["bar"]).toHaveProperty("pid");
  });

  it("throws if no config loaded", async () => {
    _setMcpConfigForTest(undefined);
    await expect(autoLaunchAllMcpServers()).rejects.toThrow(/No MCP config/);
  });

  it("throws if entry is missing for a server", async () => {
    _setMcpConfigForTest({ mcpServers: { foo: undefined as any } });
    await expect(autoLaunchAllMcpServers()).rejects.toThrow(/No server named 'foo'/);
  });
});
