import { vi, it, expect } from "vitest";

it("should mock invokeMcpTool (project wrapper)", async () => {
  vi.mock("./mcp-client", () => ({
    invokeMcpTool: vi.fn(async (toolName: string, params: Record<string, any>) => {
      console.log("MOCK CALLED", toolName, params);
      return `mocked: ${toolName} ${JSON.stringify(params)}`;
    }),
    listMcpTools: vi.fn(async () => [{ name: "mockTool", description: "A mock tool" }]),
    mcpClient: {},
  }));
  const { invokeMcpTool } = await import("./mcp-client");
  const result = await invokeMcpTool("mockTool", { foo: "bar" });
  expect(result).toContain("mocked");
  expect(result).toContain("foo");
});
