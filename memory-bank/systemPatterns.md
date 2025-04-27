# System Patterns

## MCP Protocol Integration Testing (2025-04)

- MCP protocol integration now uses an in-repo, spec-correct mock server (`mcp-mock-server.ts`).
- All mcptools dependencies and related patterns have been deprecated.
- The mock server is the canonical way to test protocol correctness and can be easily extended.

## MCP Protocol Integration Testing (2025-04)

- All MCP protocol integration tests now use a local, spec-correct mock server (`mcp-mock-server.ts`).
- The previous `mcptools` dependency and related test harnesses have been fully removed.
- The mock server is maintained in-repo and can be rapidly extended as the MCP spec evolves.
- All protocol tests assert on spec-correct behavior (argument validation, error handling, etc.).
- This ensures reliability, full control, and avoids drift from the MCP protocol.

---

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

## MCP Integration Test Canonicalization (April 2025)

- **mcptools mock/proxy server is the living reference for MCP protocol integration tests.**
  - Test assertions must match mcptools's actual behavior, not just the written spec.
  - If a feature is not implemented, tests should expect `method not found` or the real error, not a hypothetical strict error.
  - Document all such expectations and TODOs for future strictness or upstream feature support.
- **Examples:**
  - Prompts/completions, streaming, and subscriptions: expect `method not found` unless implemented.
  - Pagination: expect a resource even for out-of-bounds/negative pages.
  - Malformed arguments: expect generic results, not errors.
  - Process disconnect: isConnected() may not update immediately; document as a known limitation.
- **Upstream Contribution:**
  - If the MCP spec requires stricter or different behavior, consider contributing to mcptools or forking to match the spec.

**Status:**

- This DI/testability pattern is now canonical for all future MCP/external tool integrations and tests.
- All MCP integration tests pass with Vitest as of 2025-04-23.

---
