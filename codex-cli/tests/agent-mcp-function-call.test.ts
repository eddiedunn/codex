import { vi, describe, it, expect, beforeEach } from "vitest";

describe("AgentLoop MCP function call integration", () => {
  beforeEach(() => {
    vi.resetModules(); // Not strictly needed now, but safe
  });

  it("should call MCP tool and return its result", async () => {
    const mockInvokeMcpTool = vi.fn(async (toolName: string, params: Record<string, any>) => {
      console.log("[TEST DEBUG] mockInvokeMcpTool called with", toolName, params);
      if (toolName === "mockTool") {
        return { result: "mocked!", params };
      }
      throw new Error("Tool not found");
    });
    const { AgentLoop } = await import("../src/utils/agent/agent-loop");
    const agent = new AgentLoop({
      model: "test-model",
      approvalPolicy: {} as any,
      onItem: () => {},
      onLoading: () => {},
      getCommandConfirmation: async () => ({} as any),
      onLastResponseId: () => {},
      invokeMcpTool: mockInvokeMcpTool,
    });

    const mockFunctionCall = {
      type: "function_call",
      name: "mcp.mockTool",
      arguments: JSON.stringify({ foo: "bar" }),
      id: "test-id"
    } as any;

    console.log("[TEST DEBUG] About to call handleFunctionCall with", mockFunctionCall);
    console.log("[TEST DEBUG] mockFunctionCall.name:", mockFunctionCall.name, typeof mockFunctionCall.name);
    const results = await (agent as any).handleFunctionCall(mockFunctionCall);
    console.log("[TEST DEBUG] handleFunctionCall results:", results);
    expect(results[0].output).toContain("mocked!");
    expect(results[0].output).toContain("foo");
  });

  it("should handle MCP tool errors gracefully", async () => {
    const mockInvokeMcpTool = vi.fn(async (toolName: string, params: Record<string, any>) => {
      console.log("[TEST DEBUG] mockInvokeMcpTool called with", toolName, params);
      throw new Error("Tool not found");
    });
    const { AgentLoop } = await import("../src/utils/agent/agent-loop");
    const agent = new AgentLoop({
      model: "test-model",
      approvalPolicy: {} as any,
      onItem: () => {},
      onLoading: () => {},
      getCommandConfirmation: async () => ({} as any),
      onLastResponseId: () => {},
      invokeMcpTool: mockInvokeMcpTool,
    });

    const mockFunctionCall = {
      type: "function_call",
      name: "mcp.nonexistent",
      arguments: JSON.stringify({}),
      id: "test-id"
    } as any;

    console.log("[TEST DEBUG] About to call handleFunctionCall with", mockFunctionCall);
    console.log("[TEST DEBUG] mockFunctionCall.name:", mockFunctionCall.name, typeof mockFunctionCall.name);
    const results = await (agent as any).handleFunctionCall(mockFunctionCall);
    console.log("[TEST DEBUG] handleFunctionCall results:", results);
    expect(results[0].output).toContain("error");
    expect(results[0].output).toContain("Tool not found");
  });
});
