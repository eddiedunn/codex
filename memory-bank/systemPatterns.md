# System Patterns

## Architecture

- Core agent loop manages input, output, and tool invocation
- Tool types are handled via function calls (e.g., shell, exec)
- New tool protocols (like MCP) are integrated by extending the function call handler

## Key Decisions

- Use official SDKs for external protocols (e.g., MCP TypeScript SDK)
- Document integration steps and design patterns

## MCP Client Integration Pattern

- Use `@modelcontextprotocol/sdk` for MCP tool discovery/invocation
- Initialize a singleton MCP client with a configurable server URL
- Expose `listMcpTools` and `invokeMcpTool` for agent integration
- Extend agent function call handler to support `mcp.` tool calls

## MCP Integration: Dependency Injection & Testability Pattern (2025)

- **Dependency Injection for Testing:**
  - `AgentLoop` accepts an optional `invokeMcpTool` function for MCP tool calls.
  - If provided, this DI function is always used for `mcp.` tool calls, bypassing the registry and enabling deterministic, import-order-agnostic tests.
- **Argument Handling:**
  - MCP arguments are always parsed from JSON and passed directly to the injected/mock implementation.
  - Errors in argument parsing or invocation are caught and returned as error strings for robust test assertions.
- **Test Robustness:**
  - Tests assert on both output and error cases, ensuring all code paths are exercised.
  - The fallback registry path is only used in production/non-test code.

### Lessons Learned

- Bypassing the registry when a DI function is present is critical for reliable, order-independent testability.
- Always parse and pass arguments explicitly for tool calls.
- Catch and stringify errors in the DI path for better test diagnostics.

**Status:**

- This DI/testability pattern is now canonical for all future MCP/external tool integrations and tests.
- All MCP integration tests pass with Vitest as of 2025-04-23.

---
