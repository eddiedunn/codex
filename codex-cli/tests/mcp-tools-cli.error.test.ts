import { describe, it, expect } from "vitest";
import { execa } from "execa";
import path from "path";

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");

describe("codex mcp-tools CLI (Vitest) - error", () => {
  it("prints error if listing fails", async () => {
    const { stderr, exitCode } = await execa("node", [CLI_PATH, "mcp-tools"], {
      env: { ...process.env, MOCK_MCP_CLIENT: "1", MOCK_MCP_CLIENT_ERROR: "1" },
      reject: false,
    });
    expect(stderr).toContain("Failed to list MCP tools:");
    expect(exitCode).toBe(1);
  });
});
