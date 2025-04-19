# System Patterns

## Architecture
- Core agent loop manages input, output, and tool invocation
- Tool types are handled via function calls (e.g., shell, exec)
- New tool protocols (like MCP) are integrated by extending the function call handler

## Key Decisions
- Use official SDKs for external protocols (e.g., MCP TypeScript SDK)
- Document integration steps and design patterns
