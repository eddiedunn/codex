import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentLoop, type CommandConfirmation, type ApprovalPolicy } from "./agent-loop";
import { ReviewDecision } from "./review";

// Mock LLM interface
const mockLlm = {
  // Simulate an LLM response that includes a tool call for 'echo'
  getResponse: vi.fn().mockResolvedValue({
    toolCall: {
      name: "echo",
      arguments: { text: "hello integration" },
    },
  }),
};

// Mock MCP tool registry
const mockRegistry = {
  echo: {
    server: "mockServer",
    tool: { name: "echo", description: "Echoes input", parameters: { text: "string" } },
  },
};

// Mock MCP tool invocation (simulate tool execution)
const mockInvokeMcpTool = vi.fn().mockResolvedValue("echoed: hello integration");

// Mock prompt summary
const mockPromptSummary = "MOCK_SUMMARY";

// Use a valid ApprovalPolicy value for tests
const APPROVAL_POLICY: ApprovalPolicy = "full-auto";
const alwaysApprove: CommandConfirmation = { review: ReviewDecision.ALWAYS };

// Add a no-op onItem handler for AgentLoopParams
const noop = () => {};

// Integration test for 'registry' mode
describe("AgentLoop MCP Integration (registry mode)", () => {
  let agent: AgentLoop;

  beforeEach(async () => {
    agent = new AgentLoop({
      model: "gpt-4",
      instructions: "",
      approvalPolicy: APPROVAL_POLICY,
      onItem: noop,
      onLoading: () => {},
      getCommandConfirmation: async () => alwaysApprove,
      onLastResponseId: () => {},
      buildMcpToolRegistry: vi.fn().mockResolvedValue(mockRegistry),
      generateMcpPromptSummary: vi.fn().mockReturnValue(mockPromptSummary),
    });
    agent.setMcpToolExposureMode("registry");
    await agent.initMcpTools();
    agent.invokeMcpTool = mockInvokeMcpTool;
  });

  it("invokes the correct tool and returns the mocked response", async () => {
    const toolCall = (await mockLlm.getResponse()).toolCall;
    const result = await agent.invokeMcpTool(toolCall.name, toolCall.arguments);
    expect(result).toBe("echoed: hello integration");
    expect(mockInvokeMcpTool).toHaveBeenCalledWith("echo", { text: "hello integration" });
    expect(agent.getMcpToolRegistry()).toEqual(mockRegistry);
    expect(agent.getMcpPromptSummary()).toBeNull();
  });
});

// Integration test for 'prompt' mode
describe("AgentLoop MCP Integration (prompt mode)", () => {
  let agent: AgentLoop;
  const promptSummary = "PROMPT_SUMMARY";
  beforeEach(async () => {
    agent = new AgentLoop({
      model: "gpt-4",
      instructions: "",
      approvalPolicy: APPROVAL_POLICY,
      onItem: noop,
      onLoading: () => {},
      getCommandConfirmation: async () => alwaysApprove,
      onLastResponseId: () => {},
      buildMcpToolRegistry: vi.fn().mockResolvedValue(mockRegistry), // should not be called
      generateMcpPromptSummary: vi.fn().mockReturnValue(promptSummary),
    });
    agent.setMcpToolExposureMode("prompt");
    await agent.initMcpTools();
    agent.invokeMcpTool = mockInvokeMcpTool;
  });

  it("exposes only the prompt summary and invokes the mocked tool", async () => {
    const toolCall = (await mockLlm.getResponse()).toolCall;
    const result = await agent.invokeMcpTool(toolCall.name, toolCall.arguments);
    expect(result).toBe("echoed: hello integration");
    expect(agent.getMcpToolRegistry()).toBeNull();
    expect(agent.getMcpPromptSummary()).toBe(promptSummary);
  });
});

// Integration test for 'hybrid' mode
describe("AgentLoop MCP Integration (hybrid mode)", () => {
  let agent: AgentLoop;
  const hybridSummary = "HYBRID_SUMMARY";
  beforeEach(async () => {
    agent = new AgentLoop({
      model: "gpt-4",
      instructions: "",
      approvalPolicy: APPROVAL_POLICY,
      onItem: noop,
      onLoading: () => {},
      getCommandConfirmation: async () => alwaysApprove,
      onLastResponseId: () => {},
      buildMcpToolRegistry: vi.fn().mockResolvedValue(mockRegistry),
      generateMcpPromptSummary: vi.fn().mockReturnValue(hybridSummary),
    });
    agent.setMcpToolExposureMode("hybrid");
    await agent.initMcpTools();
    agent.invokeMcpTool = mockInvokeMcpTool;
  });

  it("exposes both registry and summary and invokes the mocked tool", async () => {
    const toolCall = (await mockLlm.getResponse()).toolCall;
    const result = await agent.invokeMcpTool(toolCall.name, toolCall.arguments);
    expect(result).toBe("echoed: hello integration");
    expect(agent.getMcpToolRegistry()).toEqual(mockRegistry);
    expect(agent.getMcpPromptSummary()).toBe(hybridSummary);
  });
});

// Integration test for 'bypass' mode
describe("AgentLoop MCP Integration (bypass mode)", () => {
  let agent: AgentLoop;
  beforeEach(async () => {
    agent = new AgentLoop({
      model: "gpt-4",
      instructions: "",
      approvalPolicy: APPROVAL_POLICY,
      onItem: noop,
      onLoading: () => {},
      getCommandConfirmation: async () => alwaysApprove,
      onLastResponseId: () => {},
      buildMcpToolRegistry: vi.fn().mockResolvedValue(mockRegistry), // should not be called
      generateMcpPromptSummary: vi.fn().mockReturnValue("SHOULD_NOT_BE_USED"),
    });
    agent.setMcpToolExposureMode("bypass");
    await agent.initMcpTools();
    // Explicitly stub invokeMcpTool to avoid MCP SDK code in bypass mode
    agent.invokeMcpTool = vi.fn().mockImplementation((tool, _args) => {
      console.warn(`[MCP] Tool call '${tool}' ignored: MCP tool exposure is bypassed (MCP_TOOL_EXPOSURE_MODE=bypass)`);
      return { error: "MCP tool exposure is bypassed", tool };
    });
  });

  it("logs a warning and returns a stub for any tool call", async () => {
    const warn = vi.spyOn(console, "warn");
    const toolCall = (await mockLlm.getResponse()).toolCall;
    const result = await agent.invokeMcpTool(toolCall.name, toolCall.arguments);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Tool call 'echo' ignored: MCP tool exposure is bypassed")
    );
    expect(result).toEqual({ error: expect.any(String), tool: "echo" });
    expect(agent.getMcpToolRegistry()).toBeNull();
    expect(agent.getMcpPromptSummary()).toBeNull();
  });
});
