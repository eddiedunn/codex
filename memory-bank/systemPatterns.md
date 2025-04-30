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

## MCP Mock Server & Streaming Integration Pattern (April 28, 2025)

- The MCP mock server (`mcp-mock-server.ts`) is now the canonical reference for protocol-compliant integration testing.
- Strict validation: requires `params.name` and `params.arguments` for all tool calls; emits protocol-compliant errors for missing/invalid parameters and unknown tools.
- Unknown tools should emit `{ code: -32601, message: 'Tool not found: ...' }` per spec (currently still -32600, needs fix).
- Streaming tools (e.g., `stream_echo`) emit NDJSON chunk objects to stdout, followed by a final JSON-RPC response.
- E2E/integration tests must parse NDJSON output, reconstruct streamed messages, and assert on both chunked and final responses.
- All new streaming-capable tools and protocol extensions should follow this emission/test pattern for compatibility.
- Document all new protocol, error handling, and streaming patterns in the memory bank and onboarding docs.

---

## MCP Integration Test Streaming Pattern (April 2025)

- The canonical MCP mock server supports streaming via NDJSON:
  - The `stream_echo` tool emits multiple JSON objects (chunks) to stdout, each on its own line, followed by a final JSON-RPC response.
  - E2E tests listen for these chunked outputs, reconstruct the original message, and assert correctness.
- This enables robust, protocol-compliant testing of streaming tools and future MCP protocol extensions.
- All new streaming-capable tools should follow this emission pattern for compatibility.

### Test Example
- The E2E suite sends a `stream_echo` request with a message and chunk count.
- It collects all NDJSON chunk messages, verifies correct chunk count and message reconstruction, and checks for a valid final JSON-RPC response.

### Reference
- Documented in `memory-bank/progress.md` and the memory bank.
- Last updated: 2025-04-28

---

## REPL vs CLI Command Pattern (April 2025)

- **Canonical Pattern:** Codex is REPL/chat-first. All tool call integrations and business logic must be designed for the interactive prompt/chat interface, not traditional terminal CLI commands.
- **Business logic** for listing resources, templates, etc., must be implemented as reusable functions/services, not tied to terminal output or CLI handler specifics.
- **CLI commands (if present)** should delegate to these shared services, but the REPL/chat tool call is canonical.
- **Output** must be structured (JSON), paginated, and UI-friendly for all tool calls.
- **This pattern supersedes** any prior CLI-centric assumptions for tool call integration.

_Last updated: 2025-04-28_

---

## MVP REPL Tool Call Pattern (April 2025)

- All tool call and business logic must be REPL/chat-first: invoked via prompt, output structured for UI, not plain text.
- CLI commands (if present) must delegate to shared REPL-first services.
- Graceful fallback for missing MCP config: disables MCP tools, logs warning, never crashes.
- Tool schemas for all available tools (including MCP tools if enabled) must always be sent to the LLM at session start.
- E2E and integration tests must always verify tool call behavior in the REPL interface.
- Canonical prompt for new sessions: "You are starting a new Codex REPL session. Your goal is to reach MVP for robust tool calling in the chat interface. All tool calls and business logic must work via the REPL, with graceful fallback for missing MCP config and full tool schema exposure to the LLM. Do not lose context from previous sessions; refer to the memory bank for all patterns and requirements."
- Next: Continue updating productContext.md and document any new patterns in systemPatterns.md as MVP approaches.

## CLI Entrypoint & Output Pattern (2025-04)

- The canonical CLI entrypoint is `bin/codex`, mapped in `package.json` with the `"bin"` field (`"codex": "./bin/codex"`).
- The entrypoint script uses a Node.js shebang (`#!/usr/bin/env node`) and imports the main CLI logic (e.g., from `src/repl/index.js`).
- All user-facing output is sent to stdout (the terminal), never to log files.
- Diagnostic logs for debugging/testing use ephemeral files in `/tmp/` (e.g., `/tmp/codex-test-<timestamp>.log`) per windsurf rules.
- This pattern matches the main branch of openai/codex and is now canonical for this project.

---

## Canonical Build Setup for Node.js CLI with TypeScript & ESM (April 30, 2025)

- **All CLI and agent packages are built and published as ESM (ECMAScript Modules).**
  - `package.json` must include `"type": "module"`.
  - TypeScript config (`tsconfig.json`) must set `"module": "ESNext"` or compatible.
  - All source and build imports use explicit `.js` extensions for local files.
- **Vite/Rollup Build Configuration:**
  - Output format must be ESM (`format: 'es'`), not CommonJS, to support top-level await in dependencies.
  - All Node.js built-in modules must be marked as external using:
    ```js
    external: [...builtinModules, ...builtinModules.map(m => `node:${m}`)]
    ```
  - Never rely on browser polyfills or default Vite behavior for Node.js CLI builds.
- **TypeScript Import/Export Patterns:**
  - Use only ESM `import`/`export` syntax, never `require` or `module.exports`.
  - Always use `.js` extensions in source imports for local files, even in `.ts`/`.tsx` files.
  - Node core and npm package imports do NOT use `.js` extensions (e.g., `import fs from 'fs/promises'`).
- **Testing & Linting:**
  - Use Vitest for all tests; ensure test runner is ESM-compatible.
  - Confirm that all mocks and test helpers use the same import paths as the source code.
- **Troubleshooting:**
  - If you see errors like "Module format 'cjs' does not support top-level await", switch build output to ESM.
  - If you see import resolution errors, check for missing `.js` extensions or misconfigured `external` modules in Rollup config.
- **Documentation:**
  - All onboarding and architectural docs must reference these patterns as canonical for CLI/agent development.
