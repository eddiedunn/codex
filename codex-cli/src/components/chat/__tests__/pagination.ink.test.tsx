import App from "../../../app.js";
import { render } from 'ink-testing-library';
import { vi, describe, it, expect } from "vitest";
import stripAnsi from "strip-ansi";
import { AutoApprovalMode } from "../../../utils/auto-approval-mode.js";

// Mock MCP client with paginated responses
const mockMcpClient = {
  listResources: vi
    .fn()
    // First page
    .mockResolvedValueOnce({
      results: [{ name: "res1" }, { name: "res2" }],
      nextPageToken: "page2",
      prevPageToken: undefined,
    })
    // Second page (after "next")
    .mockResolvedValueOnce({
      results: [{ name: "res3" }, { name: "res4" }],
      nextPageToken: undefined,
      prevPageToken: "page1",
    })
    // First page again (after "previous")
    .mockResolvedValueOnce({
      results: [{ name: "res1" }, { name: "res2" }],
      nextPageToken: "page2",
      prevPageToken: undefined,
    }),
  listResourceTemplates: vi.fn(),
};

// Minimal AppConfig with mcpClient
const mockConfig = {
  mcpClient: mockMcpClient,
  model: "test-model",
  provider: "test-provider",
  instructions: "",
  approvalMode: AutoApprovalMode.SUGGEST,
  disableResponseStorage: true,
  cwd: "/tmp",
  version: "test-version",
  name: "test-user",
  baseURL: "http://localhost",
  envKey: "TEST_API_KEY",
  history: {
    maxSize: 100,
    saveHistory: false,
    sensitivePatterns: [],
  },
  maxSize: 100,
  saveHistory: false,
  sensitivePatterns: [],
  sessionId: "test-session",
};

// Helper: wait for output to contain expected string (strips ANSI)
async function waitForOutput(fn: () => string, matcher: (s: string) => boolean, timeout = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const val = stripAnsi(fn() ?? "");
    if (matcher(val)) return;
    await new Promise(res => setTimeout(res, 25));
  }
  throw new Error("Timeout waiting for output");
}

describe("CLI Pagination (Ink)", () => {
  it("shows paginated results and responds to 'next' and 'previous'", async () => {
    const { lastFrame, stdin } = render(
      <App
        config={mockConfig}
        approvalPolicy={AutoApprovalMode.SUGGEST}
        additionalWritableRoots={[]}
        fullStdout={false}
      />
    );

    // Simulate user entering "list resources"
    stdin.write("list resources");
    stdin.write("\r");
    for (let i = 0; i < 20; i++) {
      await new Promise(res => setTimeout(res, 100));
      console.log(`[frame ${i}]`, stripAnsi(lastFrame() ?? "<empty>"));
    }

    await waitForOutput(() => lastFrame() ?? "", s => s.includes("res1") && s.includes("res2") && /more results available/i.test(s));
    expect(stripAnsi(lastFrame() ?? "")).toContain("res1");
    expect(stripAnsi(lastFrame() ?? "")).toContain("res2");
    expect(stripAnsi(lastFrame() ?? "")).toMatch(/more results available/i);

    // Simulate user entering "next"
    stdin.write("next");
    stdin.write("\r");
    for (let i = 0; i < 20; i++) {
      await new Promise(res => setTimeout(res, 100));
      console.log(`[frame ${i}] after next`, stripAnsi(lastFrame() ?? "<empty>"));
    }

    await waitForOutput(() => lastFrame() ?? "", s => s.includes("res3") && s.includes("res4") && /previous.*to go back/i.test(s));
    expect(stripAnsi(lastFrame() ?? "")).toContain("res3");
    expect(stripAnsi(lastFrame() ?? "")).toContain("res4");
    expect(stripAnsi(lastFrame() ?? "")).toMatch(/previous.*to go back/i);

    // Simulate user entering "previous"
    stdin.write("previous");
    stdin.write("\r");
    for (let i = 0; i < 20; i++) {
      await new Promise(res => setTimeout(res, 100));
      console.log(`[frame ${i}] after previous`, stripAnsi(lastFrame() ?? "<empty>"));
    }

    await waitForOutput(() => lastFrame() ?? "", s => s.includes("res1") && s.includes("res2") && /more results available/i.test(s));
    expect(stripAnsi(lastFrame() ?? "")).toContain("res1");
    expect(stripAnsi(lastFrame() ?? "")).toContain("res2");
    expect(stripAnsi(lastFrame() ?? "")).toMatch(/more results available/i);
  });
});
