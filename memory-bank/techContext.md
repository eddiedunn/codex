# Tech Context

## Technologies Used

- Node.js/TypeScript
- OpenAI SDK
- Custom agent loop and tool invocation logic

## Development Setup

- Codebase organized under `codex-cli/src/utils/agent/`
- Tests under `codex-cli/tests/`

## Constraints

- Maintain extensibility for future tool integrations
- Use TypeScript for all new code

## Dependencies

- MCP TypeScript SDK (@modelcontextprotocol/sdk) for client integration

## MCP Client Usage

- Initialize `McpClient` with `HttpClientTransport` and server URL
- Use `listTools()` to discover available tools
- Use `invokeTool(toolName, params)` to invoke tools

## MCP SDK Import Path Issue

- The correct import for MCP SDK is `@modelcontextprotocol/sdk` (not `/client/mcp.js`)
- Type declarations may be missing; if so, use `// @ts-ignore` or provide custom types until upstream is fixed
- **As of 2025-04-19:** The MCP SDK package is not compatible with Vite/Vitest ESM import resolution due to missing `exports`/`main` fields in its package.json. Use `// @ts-ignore` above imports and rely on mocks in tests. Documented limitation.

## Canonical Build Setup for Node.js CLI (April 30, 2025)

- All CLI/agent packages are ESM-only (`"type": "module"` in package.json, ESM output from Vite/Rollup)
- TypeScript config uses `"module": "ESNext"` for full ESM compatibility
- All local imports use explicit `.js` extensions
- Vite/Rollup config must:
  - Output ESM (`format: 'es'`)
  - Mark all Node.js built-ins as external: `[...builtinModules, ...builtinModules.map(m => `node:${m}`)]`
  - Never rely on browser polyfills
- Use Vitest for all tests; maintain ESM compatibility in test/mocking
- Troubleshooting: If you see top-level await or import errors, check output format and import extensions
- Document all new patterns in memory bank and onboarding

## Test/Lint Setup

- Ensure test runner types (e.g., Vitest, Jest) are installed and configured in tsconfig
- Use `process.env["MCP_SERVER_URL"]` for environment variables
