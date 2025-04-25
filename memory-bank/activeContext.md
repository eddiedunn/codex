# Active Context: MCP Protocol Client Migration (April 24, 2025)

## Major Decision: Drop Anthropic MCP SDK, Implement Native MCP Client

### Context

- After extensive debugging, it was determined that the Anthropic MCP SDK (@modelcontextprotocol/sdk) is fundamentally incompatible with our ESM/monorepo/esbuild setup due to CJS-only packaging, missing exports, and path resolution issues.
- All attempts to patch, downgrade, or work around these issues resulted in fragile or broken integrations.

### Decision

- **We will no longer use the Anthropic MCP SDK in Codex.**
- Instead, we will implement our own minimal, ESM-native MCP protocol client inside the codebase.
- This client will:
  - Speak JSON-RPC 2.0 over stdio (and optionally HTTP) to the MCP server.
  - Handle tool discovery, invocation, and error handling directly.
  - Be fully testable, robust, and compatible with our architecture.

### Rationale

- Full control over protocol, logging, and error handling.
- No dependency on broken or incompatible SDK packaging.
- Easier to debug, maintain, and extend for our needs.
- Aligns with our best practices for dependency injection, testability, and documentation.

### Next Steps

- Scaffold a new branch from main for the protocol client.
- Port over only the robust patterns (timeouts, DI, logging, test harnesses) from prior work.
- Update memory bank and docs as the new client is built.

---

## MCP Client Test Integration: Debugging Session (April 19, 2025)

### Current Focus

- Unblocking persistent test failures for MCP client integration, specifically around mocking and argument handling in agent loop tests.
- Isolating the root cause of why Vitest mocks are not being triggered in the main project, despite all best-practice workarounds.

### Recent Progress

- Confirmed that argument handling and error management in agent-loop.ts is robust.
- Cleared Vitest cache and verified no global setup files or helpers interfere with mocking.
- Performed a minimal reproduction with a local dummy module: mocking works as expected.
- Performed a minimal reproduction with the actual MCP client wrapper: mocking also works as expected.
- The main project still fails to mock MCP client, but minimal repros prove Vitest and the SDK are not the root cause.

### Key Findings

- The persistent mocking issue is unique to the main project’s structure, import order, or test runner config.
- There is likely a hidden or transitive import of the MCP client before the mock is registered in the test file.
- The MCP SDK is CJS and has known ESM compatibility issues, but this does not block mocking in isolation.

### Next Steps

1. Audit the main project for any transitive imports or helpers that load the MCP client before the test mock is registered.
2. Consider dependency injection or runtime patching as a workaround if the import order cannot be fixed.
3. Optionally, upgrade Vitest to the latest version for improved isolation and mocking.
4. Summarize all findings and recommendations in the memory bank for future reference.

## MCP Auto-Launch Integration

### Current Focus

- Implemented and tested auto-launch logic for all MCP servers defined in config on agent/CLI startup.
- Ensured logic is fully decoupled from the MCP SDK (process management and SDK/tool discovery are separate concerns).
- All tests for auto-launch logic pass and are robust (mocking `child_process.spawn`, patchable config for test isolation).

### Recent Changes

- Added `auto-launch-mcp.ts` for process management.
- Added a test-only setter for config state (`_setMcpConfigForTest`).
- Updated tests to use only ESM/TS imports and the setter, no `require` hacks.

### Next Steps

- Proceed to tool/resource aggregation and LLM wiring after documentation.
- Maintain strict separation between process management and SDK logic in all future work.

### Decisions/Patterns

- Never import SDK or `mcp-client.ts` in process management or config logic/tests.
- Always provide test hooks (setters/mocks) for module state when needed.

## MCP Tool/Resource Aggregation Pattern (April 19, 2025)

### Current Focus

- Decoupled tool/resource aggregation logic from all MCP SDK and client dependencies.
- Implemented `aggregateMcpToolsGeneric` (SDK-free) with a testable, injectable client factory.
- All aggregation logic is now fully mockable and robustly tested.

### Recent Changes

- Created `aggregate-mcp-tools.ts` for SDK-free aggregation.
- Tests for aggregation logic run without SDK, using only mocks.

### Next Steps

- Wire up aggregation in the CLI/agent using the real MCP client and config.
- Integrate aggregated tools/resources with the LLM tool registry for dynamic invocation.

### Decisions/Patterns

- Always separate aggregation logic from SDK-dependent code for testability.
- Use dependency injection (client factory) for all network/service access in aggregation.
- Maintain this separation for all future tool/resource/agent integrations.

---

_This context should be reviewed before any further MCP client integration or mocking work. See progress.md for what works and what remains blocked._

_Last updated: 2025-04-19 18:39 EDT_
