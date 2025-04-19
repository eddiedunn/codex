# Claude Desktop MCP Server Config (claude_desktop_config.json)

This file configures MCP servers for use with Claude Desktop, Cursor, Windsurf, and compatible tools. It is a map of named servers, each specifying how to launch/connect to an MCP server.

## Structure
- `mcpServers`: An object where each key is a unique server name, and each value is a server configuration.
- Each server config has:
  - `command`: The executable to launch (e.g., `node`, `npx`, `uv`)
  - `args`: Arguments to the command (first is usually the entry JS file, then server-specific args)
  - `env` (optional): Environment variables for auth or server config

## Example
```json
{
  "mcpServers": {
    "sqlite": {
      "command": "uv",
      "args": [
        "--directory", "./servers/sqlite", "run", "mcp-server-sqlite", "--db-path", "./data/NEXUS_PRIME.db"
      ]
    },
    "github": {
      "command": "node",
      "args": ["./node_modules/@modelcontextprotocol/server-github/dist/index.js"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Usage
1. Place your config as `claude_desktop_config.json` in your CLI/app directory.
2. Edit/add servers as needed. Paths can be absolute or relative.
3. Use the `env` block for secrets (API keys, tokens, etc). **Do not commit secrets to version control!**
4. Your CLI can load and parse this file to discover and launch/connect to MCP servers.

## Common Pitfalls
- Use valid JSON (no trailing commas, double quotes only)
- Use absolute paths for reliability, or ensure relative paths are correct
- Ensure all required env vars are set for servers needing authentication

## Further Reading
- [Claude Desktop MCP Docs](https://modelcontextprotocol.info/docs/quickstart/user/)
- [Reference Example](https://github.com/angrysky56/100-tool-mcp-server-json-example)
