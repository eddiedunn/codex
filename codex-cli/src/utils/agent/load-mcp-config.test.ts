import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { loadMcpConfig } from "./load-mcp-config.js";
import type { McpServersConfig } from "./mcp-config.js";

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

const validMixedConfig: McpServersConfig = {
  mcpServers: {
    stdioServer: {
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/Users/yourname/Desktop"]
    },
    sseServer: {
      url: "http://localhost:8081"
    },
    stdioWithEnv: {
      command: "node",
      args: ["./server.js"],
      env: { FOO: "bar" }
    },
    sseWithEnv: {
      url: "http://localhost:8000",
      env: { TOKEN: "xyz" }
    }
  }
};

const missingBothConfig = {
  mcpServers: {
    badServer: {
      // neither command nor url
      env: { X: "Y" }
    }
  }
};

const badStdioConfig = {
  mcpServers: {
    stdioServer: {
      command: "npx"
      // missing args
    }
  }
};

const badSseConfig = {
  mcpServers: {
    sseServer: {
      url: 12345 // not a string
    }
  }
};

const validConfigPath = path.join(tmpDir, "valid.json");
const invalidConfigPath = path.join(tmpDir, "invalid.json");
const malformedConfigPath = path.join(tmpDir, "malformed.json");
const validMixedConfigPath = path.join(tmpDir, "valid-mixed.json");
const missingBothConfigPath = path.join(tmpDir, "missing-both.json");
const badStdioConfigPath = path.join(tmpDir, "bad-stdio.json");
const badSseConfigPath = path.join(tmpDir, "bad-sse.json");

beforeAll(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.writeFileSync(validConfigPath, JSON.stringify(validConfig, null, 2));
  fs.writeFileSync(invalidConfigPath, JSON.stringify(invalidConfig, null, 2));
  fs.writeFileSync(malformedConfigPath, malformedJson);
  fs.writeFileSync(validMixedConfigPath, JSON.stringify(validMixedConfig, null, 2));
  fs.writeFileSync(missingBothConfigPath, JSON.stringify(missingBothConfig, null, 2));
  fs.writeFileSync(badStdioConfigPath, JSON.stringify(badStdioConfig, null, 2));
  fs.writeFileSync(badSseConfigPath, JSON.stringify(badSseConfig, null, 2));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("loadMcpConfig", () => {
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

  it("loads a valid mixed stdio/SSE config", () => {
    const config = loadMcpConfig(validMixedConfigPath);
    expect(config).toEqual(validMixedConfig);
  });

  it("throws if an entry is missing both command and url", () => {
    expect(() => loadMcpConfig(missingBothConfigPath)).toThrow(/must have either 'command' \(stdio\) or 'url' \(sse\)/);
  });

  it("throws if stdio entry is missing args", () => {
    expect(() => loadMcpConfig(badStdioConfigPath)).toThrow(/missing or invalid 'command' or 'args'/);
  });

  it("throws if sse entry has non-string url", () => {
    expect(() => loadMcpConfig(badSseConfigPath)).toThrow(/missing or invalid 'url'/);
  });
});
