# Progress

## What Works

- Core agent loop and tool invocation (shell, exec)
- Memory bank documentation system initialized
- MCP SDK (@modelcontextprotocol/sdk) installed
- MCP client code scaffolded (init, discovery, invocation)
- Argument handling in agent-loop.ts is robust and correct.
- Minimal Vitest mock reproductions (dummy and real MCP wrapper) work as expected.
- No evidence of global setup files or helpers interfering with tests.
- Added CLI command: `codex mcp-tools` for MCP tool discovery.
- Added tests for the `codex mcp-tools` CLI command:
  - Verifies correct output for available tools (mocked response)
  - Handles empty tool list
  - Handles error cases gracefully (prints error, exits with code 1)
- Auto-launch logic for all MCP servers in config runs on agent/CLI startup (see `auto-launch-mcp.ts`).
- Robust, SDK-free tests for auto-launch logic (mocking `child_process.spawn`, patchable config via exported setter).
- Strict separation between process management and SDK logic is enforced throughout the codebase.

## What's Left

- MCP tool invocation logic
- Tests and documentation for MCP integration
- MCP client test integration and mocking
- Optionally improve output formatting (e.g., show schemas, arguments) for `codex mcp-tools`.
- Document usage in README/product docs.
- Integrate MCP tool discovery tests with CI if not already
- Expand tests for edge cases (e.g., malformed tool data)
- Tool/resource aggregation from MCP servers for LLM wiring (next major step).
- CLI/config options for selective or opt-out server launching (optional enhancement).

## MCP Client Integration: Progress Update (April 19, 2025)

### What’s Blocked

- Main project tests for MCP client integration still fail to trigger mocks; the real implementation is always called.
- Root cause appears to be a hidden import, test runner config, or module cache issue unique to the main project.

### Next Steps

- Audit the main project for transitive or hidden imports of the MCP client before test mocks are registered.
- Consider dependency injection or runtime patching if import order cannot be fixed.
- Optionally, upgrade Vitest for improved ESM/CJS mocking support.

## MCP Tool Discovery/Listing (April 19, 2025)

### What Works

- Added CLI command: `codex mcp-tools`.
- The command lists all available MCP tools (name and description) from the MCP server using the SDK's `listTools()` method.
- Handles empty/no-tool cases and errors gracefully.

### What's Left

- Optionally improve output formatting (e.g., show schemas, arguments).
- Document usage in README/product docs.

## MCP Tool Discovery/Listing Tests (April 19, 2025)

#### What Works

- Added tests for the `codex mcp-tools` CLI command:
  - Verifies correct output for available tools (mocked response)
  - Handles empty tool list
  - Handles error cases gracefully (prints error, exits with code 1)
- Uses Jest and execa to run the CLI and mock the MCP client

#### What's Left

- Integrate with CI if not already
- Expand tests for edge cases (e.g., malformed tool data)

## MCP Stdio E2E Debugging (April 24, 2025)

### What Works

- MCP client is now correctly built as CJS (`dist/utils/agent/mcp-client.cjs`) and imported in manual E2E scripts.
- E2E script launches the MCP server with stdio transport, creates a client, and lists tools successfully.
- Diagnostic logging confirms stdio transport is used and available tools are listed.
- The E2E script finds the `echo` tool and attempts to invoke it.

### What's Blocked

- Tool invocation (`callTool('echo', ...)`) times out with `McpError: MCP error -32001: Request timed out`.
- Server logs show warnings, errors, and debug messages, but no direct cause for tool call failure.

### Next Steps

- Add more diagnostic logging around tool invocation in both client and server.
- Try invoking other tools (e.g., `add`) with minimal payloads to isolate if the issue is tool-specific.
- Audit payloads for protocol/schema mismatches.
- Inspect server output for stack traces or errors during tool call handling.

## MCP Resource Protocol Integration (April 2025)

- Implemented MCP client methods for `resources/list`, `resources/read`, `resources/templates`, `resources/subscribe`, and `resources/unsubscribe`.
- Ensured parameter names match MCP spec (e.g., `uri` instead of `id` or `resourceId`).
- Added robust error handling for response shapes and protocol errors.
- Integration tests connect to a real MCP reference server (`server-everything`) and validate interoperability.
- Unit tests use dependency injection/mocking for deterministic, fast feedback.
- All tests are passing, confirming spec compliance and client-server compatibility.

**Best Practices:**

- Always match field names to the MCP protocol (e.g., `uri` for resource references).
- In integration tests, spin up the reference server as a subprocess for true end-to-end validation.
- Use dependency injection or mocking in unit tests for reliability and speed.
- Assert on both structure (Array.isArray, property existence) and content (e.g., `uri`, `name`).
- Document protocol quirks and interoperability notes in the memory bank for future contributors.

**Next Steps:**

- Expand resource protocol coverage (templates, subscriptions, pagination, etc.).
- Integrate resource methods into CLI/agent workflows.
- Use this pattern for future MCP protocol features (prompts, completions, etc.).

## Known Issues

- MCP SDK is CJS and not ESM-compatible, but this does not block mocking in minimal reproductions.
- User frustration is high due to repeated attempts and persistent blockers.
- None for auto-launch; all test and runtime blockers resolved.
- Maintain vigilance for SDK import creep into process management code.

## Current Status

- Preparing to add MCP integration on a new feature branch
- All auto-launch logic and tests pass (see test suite for `auto-launch-mcp.ts`).
- Memory bank and documentation updated with new patterns and decisions.

---

_Last updated: 2025-04-25_
