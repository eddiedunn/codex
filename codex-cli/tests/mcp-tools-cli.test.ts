import { describe, it, expect, vi, beforeEach } from "vitest";
import { execa } from "execa";
import path from "path";

// Use the single-file bundled CLI output
const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");

vi.mock("../src/utils/agent/mcp-client", async () => {
  return {
    listMcpTools: vi.fn().mockResolvedValue([
      { name: "toolA", description: "Test tool A" },
      { name: "toolB", description: "Test tool B" },
    ]),
  };
});

describe("codex mcp-tools CLI (Vitest)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("prints available MCP tools", async () => {
    const { stdout } = await execa("node", [CLI_PATH, "mcp-tools"]);
    expect(stdout).toContain("Available MCP Tools:");
    expect(stdout).toContain("toolA: Test tool A");
    expect(stdout).toContain("toolB: Test tool B");
  });

  it("prints message if no tools", async () => {
    const mcpClient = await import("../src/utils/agent/mcp-client");
    mcpClient.listMcpTools.mockResolvedValueOnce([]);
    const { stdout } = await execa("node", [CLI_PATH, "mcp-tools"]);
    expect(stdout).toContain("No MCP tools available.");
  });

  it("prints error if listing fails", async () => {
    const mcpClient = await import("../src/utils/agent/mcp-client");
    mcpClient.listMcpTools.mockRejectedValueOnce(new Error("fail"));
    const { stderr, exitCode } = await execa("node", [CLI_PATH, "mcp-tools"], { reject: false });
    expect(stderr).toContain("Failed to list MCP tools:");
    expect(exitCode).toBe(1);
  });
});
