# Progress: MCP Tool Integration

## What Works

- MCP tool registry is initialized and available after `initMcpTools()`.
- MCP tool calls are supported via the CLI and integration tests (`agent-mcp-function-call.test.ts`).
- Prompt summary and registry are correctly generated for tool calls.
- Error handling for missing/invalid tools is covered by tests.

## What’s Left / Next Steps

- Dynamic population of the `tools` field in OpenAI 4.1 requests from the MCP registry.
- Additional edge-case tests (malformed arguments, missing tool, registry re-init).
- CLI demo script for quick manual MCP tool call testing.
- Re-enable or rewrite legacy function call ID propagation tests for the new MCP architecture.

## Known Limitations

- The `tools` field in OpenAI payload is currently hardcoded to the built-in `shell` tool.
- Full OpenAI 4.1 dynamic tools support is not yet implemented.
- Some legacy regression tests are skipped due to architectural changes.

## For Future Contributors

- See `README.md` for usage and caveats.
- See integration tests for working MCP tool call examples.
- To add full 4.1 support, update the code to generate the `tools` field from the MCP registry.
