# Tool Calling Capabilities in Codex CLI

## Overview

Codex CLI supports programmatic tool calling, enabling the agent to invoke external tools or functions in a structured, extensible way. This design is compatible with modern agentic/LLM architectures, including OpenAI's function calling paradigm.

---

## Core Components

### Tool Call Representation

- **Type:** `ResponseFunctionToolCall`
  - Imported from OpenAI's `responses.mjs` types.
  - Represents a structured tool/function call with a `name` and `arguments` (typically JSON).

### Tool Call Dispatch

- **Class:** `AgentLoop`
  - **Method:** `handleFunctionCall(item: ResponseFunctionToolCall)`
    - Receives tool call requests (from LLM or other sources).
    - Dispatches to the appropriate handler based on the tool name.
    - Supports built-in tools (e.g., `container.exec`, `shell`) and custom tools (like MCP).

### MCP Tool Call Integration

- **MCP Tool Calls:**
  - If the tool name matches the MCP pattern, the agent invokes:
    - `invokeMcpTool(toolName: string, params: Record<string, any>)`
    - Routed through the MCP client, supporting multiple transport backends (HTTP, stdio).
    - Tool calls can be routed via a registry, prompt summary, or bypassed (configurable via `MCP_TOOL_EXPOSURE_MODE`).

---

## Extensibility

- **Adding New Tools:** Implement new handlers in `handleFunctionCall` or register in the MCP tool registry.
- **Exposure Modes:** MCP tools can be exposed in different modes (`registry`, `prompt`, `hybrid`, `bypass`) for flexibility and security.

---

## OpenAI Function Calling Compatibility

### Conformance

- **Schema:** Tool call infrastructure is designed to accept and process OpenAI-style function calls (name + JSON arguments).
- **Dispatch:** The `handleFunctionCall` method and MCP client both accept structured tool calls in the same format as OpenAI's function calling API.
- **Integration:** The agent can receive tool calls from LLM completions and invoke the corresponding MCP tool, returning structured outputs.

### MCP Client Details

- **Entrypoint:** `invokeMcpTool(toolName, params)` in `mcp-client.ts`
- **Behavior:** Forwards the tool call to the MCP backend, which is expected to handle the call and return results in a compatible format.
- **Limitations:** The MCP backend itself must adhere to the expected input/output contract for full compatibility (i.e., accept function name + JSON, return JSON).

---

## Example Flow

1. LLM or user triggers a tool call (e.g., `{"name": "mcp.some_tool", "arguments": {...}}`).
2. `AgentLoop.handleFunctionCall` receives the call.
3. If it's an MCP tool, `invokeMcpTool` is called with the name and arguments.
4. The MCP client forwards the call to the backend and returns the result.
5. The agent emits the result as a structured response.

---

## Summary Table

| Capability                       | Supported? | Notes                                                 |
| -------------------------------- | :--------: | ----------------------------------------------------- |
| OpenAI-style function calls      |    Yes     | Accepts name + JSON arguments, dispatches to handlers |
| MCP tool call routing            |    Yes     | Via registry, prompt, or bypass modes                 |
| Extensible tool registry         |    Yes     | Tools can be registered and exposed via config        |
| Multi-transport MCP backend      |    Yes     | HTTP and stdio supported                              |
| Structured output                |    Yes     | Results returned as JSON (stringified if necessary)   |
| Full OpenAI function call output |  Partial   | Dependent on MCP backend returning compatible output  |

---

## Recommendations

- **For full OpenAI function calling compatibility:** Ensure all MCP tools accept and return data in the exact schema expected by the OpenAI API (including error handling and output structure).
- **Documentation:** Consider documenting tool schemas and exposure modes for future contributors.
- **Testing:** Maintain and expand integration tests for tool calling, especially for edge cases and error handling.

---

## References

- `codex-cli/src/utils/agent/agent-loop.ts`
- `codex-cli/src/utils/agent/mcp-client.ts`
- `codex-cli/src/utils/agent/aggregate-mcp-tools.ts`
- `codex-cli/src/utils/agent/mcp-tool-exposure.ts`
- `codex-cli/src/utils/agent/handle-exec-command.ts`
