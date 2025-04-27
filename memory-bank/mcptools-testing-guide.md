# [REMOVED] MCP Integration Testing with mcptools

This guide is deprecated. The project now uses a local, spec-correct MCP mock server for all protocol integration testing. See `systemPatterns.md` and `activeContext.md` for the new pattern and rationale.

- All mcptools-related test harnesses, docs, and dependencies have been removed.
- For protocol integration, use `mcp-mock-server.ts` in `codex-cli/src/utils/agent/`.
- This file is retained for historical context only.

## Quickstart

- Ensure `mcptools` is installed and available in your PATH.
- Run integration tests with `pnpm run test` (or the appropriate command for your workspace).
- The test runner will automatically start `mcptools` in mock/proxy mode as needed.

## How It Works

- Integration tests spawn the `mcptools` mock/proxy server as a subprocess.
- The MCP client connects to the server via stdio transport.
- All protocol requests (e.g., `tools/call`) are sent through this live connection, ensuring real-world protocol compatibility.
- Tests assert on both success and error cases, mirroring production usage.

## Accessing Protocol Logs

- **Local:**
  - After running tests, view protocol logs at `~/.mcpt/logs/mock.log` or `proxy.log`.
  - These logs include all protocol traffic and errors for debugging.
- **CI:**
  - CI runs archive these logs as artifacts (see the "mcptools-logs" artifact in GitHub Actions after each run).
  - On test failures, download and inspect the log artifacts for root cause analysis.

## Troubleshooting

- If tests fail unexpectedly, always check the protocol logs for errors or protocol mismatches.
- Ensure no other process is using the same mcptools log directory.
- If logs are missing, verify that `mcptools` is installed and that the test runner is starting it correctly.

## Extending Tests

- To add new protocol feature coverage:
  - Add or modify test cases in the relevant integration test files (see `codex-cli/src/utils/agent/`).
  - Use the `MinimalMcpClient` to connect to the mcptools server and exercise new protocol methods or edge cases.
  - Assert on both expected success and failure/error responses.

## CI Integration

- Protocol logs are always uploaded as artifacts after each CI run.
- Download logs from the "mcptools-logs" artifact in the GitHub Actions UI for any run.
- This enables rapid debugging of MCP protocol issues in both local and CI environments.

## Log Masking and Upload Controls

- **Secret Masking:** By default, secrets (API keys, tokens, etc.) are masked in all mcptools logs before upload. To disable masking (not recommended), set `MASK_MCPTOOL_LOGS=0` in your environment.
- **Log Uploading:** By default, mcptools logs are uploaded as CI artifacts after each run. To disable log uploading, set `UPLOAD_MCPTOOL_LOGS=0` in your environment before running CI. If disabled, logs will not be archived or accessible from CI artifacts.

---

_Last updated: 2025-04-26_
