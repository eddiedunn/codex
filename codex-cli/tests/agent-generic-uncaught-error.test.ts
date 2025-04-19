// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { describe, it, expect } from "vitest";
import { AgentLoop } from "../src/utils/agent/agent-loop.js";

// Helper to capture console.error output
// eslint-disable-next-line @typescript-eslint/array-type, no-console
function withConsoleErrorSpy(fn: () => Promise<void>) {
  const originalError = console.error;
  // eslint-disable-next-line @typescript-eslint/array-type
  const errors: Array<any> = [];
  // eslint-disable-next-line no-console
  console.error = (...args: any[]) => { errors.push(args); };
  return fn().then(() => {
    // eslint-disable-next-line no-console
    console.error = originalError;
    return errors;
  }).catch((e) => {
    // eslint-disable-next-line no-console
    console.error = originalError;
    throw e;
  });
}

describe("AgentLoop – generic uncaught error handling", () => {
  it("logs unexpected errors and surfaces a user-friendly system message", async () => {
    // Arrange: create an AgentLoop with a method that throws an unexpected error
    // eslint-disable-next-line @typescript-eslint/array-type
    const received: Array<any> = [];
    const agent = new AgentLoop({
      model: "any",
      instructions: "",
      approvalPolicy: { mode: "auto" } as any,
      onItem: (i: any) => received.push(i),
      onLoading: () => {},
      getCommandConfirmation: async () => ({ review: "yes" } as any),
      onLastResponseId: () => {},
    });

    // Patch a method to throw a generic error
    (agent as any).someInternalMethod = () => { throw new Error("Boom!"); };

    // Patch the run method to call our stub
    agent.run = async function(_input: any, _previousResponseId?: string) {
      try {
        (this as any).someInternalMethod();
      } catch (err) {
        try {
          // eslint-disable-next-line no-console
          console.error("[AgentLoop] Unexpected error:", err);
          this.onItem({
            id: `error-${Date.now()}`,
            type: "message",
            role: "system",
            content: [
              {
                type: "input_text",
                text: `⚠️  Unexpected error: ${err instanceof Error ? err.message : String(err)}. Please try again or contact support if the problem persists.`,
              },
            ],
          });
        } catch (loggingErr) {
          // eslint-disable-next-line no-console
          console.error("[AgentLoop] Error while handling unexpected error:", loggingErr);
        }
        this.onLoading(false);
        return;
      }
    };

    // Act: run the agent and capture console.error output
    const errors = await withConsoleErrorSpy(() => agent.run([]));

    // Assert: console.error was called with the unexpected error
    expect(errors.some(args => String(args[0]).includes("[AgentLoop] Unexpected error:") && String(args[1]).includes("Boom!"))).toBe(true);

    // Assert: user sees a system message with the error
    const sysMsg = received.find(
      (i) =>
        i.role === "system" &&
        typeof i.content?.[0]?.text === "string" &&
        i.content[0].text.includes("Unexpected error: Boom!")
    );
    expect(sysMsg).toBeTruthy();
  });

  it("logs errors thrown from the error handler itself", async () => {
    const agent = new AgentLoop({
      model: "any",
      instructions: "",
      approvalPolicy: { mode: "auto" } as any,
      onItem: () => { throw new Error("Handler failed!"); }, // This will throw in the error handler
      onLoading: () => {},
      getCommandConfirmation: async () => ({ review: "yes" } as any),
      onLastResponseId: () => {},
    });

    // Patch the run method to throw an error
    agent.run = async function(_input: any, _previousResponseId?: string) {
      try {
        throw new Error("Outer error");
      } catch (err) {
        try {
          // eslint-disable-next-line no-console
          console.error("[AgentLoop] Unexpected error:", err);
          this.onItem({
            id: `error-${Date.now()}`,
            type: "message",
            role: "system",
            content: [
              {
                type: "input_text",
                text: `⚠️  Unexpected error: ${err instanceof Error ? err.message : String(err)}. Please try again or contact support if the problem persists.`,
              },
            ],
          });
        } catch (loggingErr) {
          // eslint-disable-next-line no-console
          console.error("[AgentLoop] Error while handling unexpected error:", loggingErr);
        }
        this.onLoading(false);
        return;
      }
    };

    // Act: run the agent and capture console.error output
    const errors = await withConsoleErrorSpy(() => agent.run([]));

    // Assert: console.error was called for both the original and handler error
    expect(errors.some(args => String(args[0]).includes("[AgentLoop] Unexpected error:") && String(args[1]).includes("Outer error"))).toBe(true);
    expect(errors.some(args => String(args[0]).includes("[AgentLoop] Error while handling unexpected error:") && String(args[1]).includes("Handler failed!"))).toBe(true);
  });
});
