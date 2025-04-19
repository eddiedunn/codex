import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { loadMcpConfig } from "./load-mcp-config";
import type { McpServersConfig } from "./mcp-config";

const tmpDir = path.join(os.tmpdir(), "codex-mcp-test");

const validConfig: McpServersConfig = {
  mcpServers: {
    testServer: {
      command: "node",
      args: ["/path/to/server.js"],
      env: { TOKEN: "abc123" },
    },
  },
};

const invalidConfig = {
  servers: {}, // wrong top-level key
};

const malformedJson = "{ this is not valid json }";

const validConfigPath = path.join(tmpDir, "valid.json");
const invalidConfigPath = path.join(tmpDir, "invalid.json");
const malformedConfigPath = path.join(tmpDir, "malformed.json");

describe("loadMcpConfig", () => {
  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(validConfigPath, JSON.stringify(validConfig, null, 2));
    fs.writeFileSync(invalidConfigPath, JSON.stringify(invalidConfig, null, 2));
    fs.writeFileSync(malformedConfigPath, malformedJson);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads a valid config", () => {
    const config = loadMcpConfig(validConfigPath);
    expect(config).toEqual(validConfig);
  });

  it("throws if missing top-level mcpServers", () => {
    expect(() => loadMcpConfig(invalidConfigPath)).toThrow(/mcpServers/);
  });

  it("throws on malformed JSON", () => {
    expect(() => loadMcpConfig(malformedConfigPath)).toThrow(/Invalid JSON/);
  });

  it("throws if file does not exist", () => {
    expect(() => loadMcpConfig(path.join(tmpDir, "nope.json"))).toThrow(/not found/);
  });
});
