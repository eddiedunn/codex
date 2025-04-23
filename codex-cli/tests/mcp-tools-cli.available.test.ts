import { describe, it, expect } from "vitest";
import { execa } from "execa";
import path from "path";

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");

describe("codex mcp-tools CLI (Vitest) - available tools", () => {
  it("prints available MCP tools", async () => {
    const { stdout } = await execa("node", [CLI_PATH, "mcp-tools"], {
      env: { ...process.env, MOCK_MCP_CLIENT: "1" },
    });
    expect(stdout).toContain("Available MCP Tools:");
    expect(stdout).toContain("toolA: Test tool A");
    expect(stdout).toContain("toolB: Test tool B");
  });
});
