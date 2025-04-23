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

// This file has been split into:
// - mcp-tools-cli.available.test.ts
// - mcp-tools-cli.empty.test.ts
// - mcp-tools-cli.error.test.ts
// Each file tests one scenario in isolation for reliable CLI subprocess mocking.

// (You may safely delete this file.)

describe("codex mcp-tools CLI (Vitest)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("prints available MCP tools", async () => {
    const { stdout } = await execa("node", [CLI_PATH, "mcp-tools"], {
      env: { ...process.env, MOCK_MCP_CLIENT: "1" },
    });
    expect(stdout).toContain("Available MCP Tools:");
    expect(stdout).toContain("toolA: Test tool A");
    expect(stdout).toContain("toolB: Test tool B");
  });

  it("prints message if no tools", async () => {
    const { stdout } = await execa("node", [CLI_PATH, "mcp-tools"], {
      env: { ...process.env, MOCK_MCP_CLIENT: "1", MOCK_MCP_CLIENT_EMPTY: "1" },
    });
    expect(stdout).toContain("No MCP tools available.");
  });

  it("prints error if listing fails", async () => {
    const { stderr, exitCode } = await execa("node", [CLI_PATH, "mcp-tools"], {
      env: { ...process.env, MOCK_MCP_CLIENT: "1", MOCK_MCP_CLIENT_ERROR: "1" },
      reject: false,
    });
    expect(stderr).toContain("Failed to list MCP tools:");
    expect(exitCode).toBe(1);
  });
});
