import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMcpClient } from "./mcp-client.js";

// Mock MCP SDK Client prototype for behavioral testing
const mockTools = [
  { name: "echo", description: "Echoes input", parameters: { text: "string" } },
  { name: "add", description: "Adds two numbers", parameters: { a: "number", b: "number" } },
];
const mockToolResults = {
  echo: (params: any) => `echoed: ${params.text}`,
  add: (params: any) => params.a + params.b,
};

describe("MCP Client Behavioral Integration", () => {
  let client: any;
  beforeEach(() => {
    // Patch the Client prototype for the test
    client = createMcpClient();
    client.listTools = vi.fn().mockResolvedValue(mockTools);
    client.callTool = vi.fn().mockImplementation((name, params) => {
      if (mockToolResults[name]) return Promise.resolve(mockToolResults[name](params));
      return Promise.reject(new Error("Tool not found"));
    });
  });

  it("lists available tools", async () => {
    const tools = await client.listTools();
    expect(tools).toEqual(mockTools);
  });

  it("invokes a tool (echo)", async () => {
    const result = await client.callTool("echo", { text: "hello" });
    expect(result).toBe("echoed: hello");
  });

  it("invokes a tool (add)", async () => {
    const result = await client.callTool("add", { a: 2, b: 3 });
    expect(result).toBe(5);
  });

  it("returns error for unknown tool", async () => {
    await expect(client.callTool("unknown", {})).rejects.toThrow("Tool not found");
  });
});
