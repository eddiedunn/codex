import { describe, it, expect } from "vitest";
import { execa } from "execa";
import path from "path";

const CLI_PATH = path.resolve(__dirname, "../dist/cli.js");

describe("codex mcp-tools CLI (Vitest) - no tools", () => {
  it("prints message if no tools", async () => {
    const { stdout } = await execa("node", [CLI_PATH, "mcp-tools"], {
      env: { ...process.env, MOCK_MCP_CLIENT: "1", MOCK_MCP_CLIENT_EMPTY: "1" },
    });
    expect(stdout).toContain("No MCP tools available.");
  });
});
