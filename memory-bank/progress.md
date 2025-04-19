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

## What's Left
- MCP tool invocation logic
- Tests and documentation for MCP integration
- MCP client test integration and mocking
- Optionally improve output formatting (e.g., show schemas, arguments) for `codex mcp-tools`.
- Document usage in README/product docs.
- Integrate MCP tool discovery tests with CI if not already
- Expand tests for edge cases (e.g., malformed tool data)

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

## Known Issues
- MCP SDK is CJS and not ESM-compatible, but this does not block mocking in minimal reproductions.
- User frustration is high due to repeated attempts and persistent blockers.

## Current Status
- Preparing to add MCP integration on a new feature branch

---

*Review this progress and blockers before further work on MCP client test integration or mocking.*
