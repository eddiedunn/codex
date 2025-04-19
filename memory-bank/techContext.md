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

## Test/Lint Setup
- Ensure test runner types (e.g., Vitest, Jest) are installed and configured in tsconfig
- Use `process.env["MCP_SERVER_URL"]` for environment variables
