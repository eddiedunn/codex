# Claude Desktop MCP Config Format (`claude_desktop_config.json`)

This document describes the canonical configuration format for MCP servers as used by Claude Desktop, Cursor, Windsurf, and compatible tools. It supports both stdio (process) and SSE/HTTP (remote) servers in any combination.

## Structure

```json
{
  "mcpServers": {
    "<server-name>": {
      // Stdio server (runs as subprocess)
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/yourname/Desktop"
      ]
      // Optional: "env": { ... }
    },
    "<another-server>": {
      // SSE/HTTP server (connects to remote URL)
      "url": "http://localhost:8081"
      // Optional: "env": { ... }
    }
    // ...more servers
  }
}
```

## Rules

- Each entry in `mcpServers` must have **either** a `command` (and `args`) **or** a `url`.
- No `transport` or `type` field is required or supported; the loader infers the transport from the presence of `command` or `url`.
- You can freely mix stdio and SSE servers in the same config file.
- Optional `env` values are supported for both types.

## Examples

### Stdio (default)

```json
"filesystem": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem", "/Users/yourname/Desktop"]
}
```

### SSE/HTTP

```json
"my-sse-server": {
  "url": "http://localhost:8081"
}
```

### Mixed

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/yourname/Desktop"
      ]
    },
    "my-sse-server": {
      "url": "http://localhost:8081"
    }
  }
}
```

## Validation

- The loader will throw an error if an entry is missing both `command` and `url`, or if required fields are of the wrong type.
- This format is 100% compatible with Claude Desktop and the wider MCP ecosystem.

---

For more details, see the Claude Desktop [official documentation](https://modelcontextprotocol.info/docs/quickstart/user/) or [community examples](https://github.com/angrysky56/100-tool-mcp-server-json-example/blob/main/claude_desktop_config.json).
