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
