import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReviewDecision } from "./review.js";
import type { ApprovalPolicy, CommandConfirmation } from "../../approvals.js";

// Mock MCP client so no real SDK code loads
vi.mock("./mcp-client.js", () => ({
  invokeMcpTool: vi.fn().mockResolvedValue("mocked"),
}));

// Patch MCP tool exposure logic BEFORE importing AgentLoop
vi.mock("./mcp-tool-exposure", async () => {
  const actual = await vi.importActual<any>("./mcp-tool-exposure");
  return {
    ...actual,
    buildMcpToolRegistry: vi.fn().mockResolvedValue({ echo: { server: "serverA", tool: { name: "echo", description: "Echoes input", parameters: { text: "string" } } } }),
    generateMcpPromptSummary: vi.fn().mockImplementation(() => "SUMMARY"),
    getMcpToolExposureMode: vi.fn(),
  };
});

import { AgentLoop } from "./agent-loop";
import * as mcpToolExposure from "./mcp-tool-exposure";

const APPROVAL_POLICY: ApprovalPolicy = "always";
const COMMAND_CONFIRMATION: CommandConfirmation = { review: "approve" as ReviewDecision };

const mockBuildMcpToolRegistry = vi.fn().mockResolvedValue({ echo: { server: "serverA", tool: { name: "echo", description: "Echoes input", parameters: { text: "string" } } } });
const mockGenerateMcpPromptSummary = vi.fn().mockImplementation(() => "SUMMARY");

function makeAgentLoopWithMode(mode: string) {
  (mcpToolExposure.getMcpToolExposureMode as any).mockReturnValue(mode);
  const agent = new AgentLoop({
    model: "gpt-test",
    approvalPolicy: APPROVAL_POLICY,
    onItem: () => {},
    onLoading: () => {},
    getCommandConfirmation: async () => COMMAND_CONFIRMATION,
    onLastResponseId: () => {},
    buildMcpToolRegistry: mockBuildMcpToolRegistry,
    generateMcpPromptSummary: mockGenerateMcpPromptSummary,
  });
  return agent;
}

describe("AgentLoop MCP tool exposure modes", () => {
  let origEnv: NodeJS.ProcessEnv;
  beforeEach(() => {
    origEnv = { ...process.env };
    vi.resetModules();
  });
  afterEach(() => {
    process.env = origEnv;
    vi.restoreAllMocks();
  });

  it("registry mode: builds registry, invokes tool, no prompt", async () => {
    const agent = makeAgentLoopWithMode("registry");
    await agent.initMcpTools();
    expect(agent.getMcpToolRegistry()).toBeTruthy();
    expect(agent.getMcpPromptSummary()).toBeNull();
    const result = await agent.invokeMcpTool("echo", { text: "hi" });
    expect(result).toBe("mocked");
  });

  it("prompt mode: builds prompt summary, no registry", async () => {
    const agent = makeAgentLoopWithMode("prompt");
    await agent.initMcpTools();
    expect(agent.getMcpToolRegistry()).toBeNull();
    expect(agent.getMcpPromptSummary()).toBe("SUMMARY");
    const result = await agent.invokeMcpTool("echo", { text: "hi" });
    expect(result).toBe("mocked");
  });

  it("hybrid mode: builds registry and prompt summary, invokes tool", async () => {
    const agent = makeAgentLoopWithMode("hybrid");
    await agent.initMcpTools();
    expect(agent.getMcpToolRegistry()).toBeTruthy();
    expect(agent.getMcpPromptSummary()).toBe("SUMMARY");
    const result = await agent.invokeMcpTool("echo", { text: "hi" });
    expect(result).toBe("mocked");
  });

  it("bypass mode: skips registry/prompt, returns warning stub", async () => {
    const agent = makeAgentLoopWithMode("bypass");
    await agent.initMcpTools();
    expect(agent.getMcpToolRegistry()).toBeNull();
    expect(agent.getMcpPromptSummary()).toBeNull();
    const warn = vi.spyOn(console, "warn");
    const result = await agent.invokeMcpTool("echo", { text: "hi" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Tool call 'echo' ignored: MCP tool exposure is bypassed")
    );
    expect(result).toEqual({ error: expect.any(String), tool: "echo" });
  });
});
