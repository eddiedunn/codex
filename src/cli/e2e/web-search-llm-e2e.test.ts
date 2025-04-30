import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import nodepty from 'node-pty';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { waitForOutput, sendInput, killPty } from './pty-helpers';

const PROMPT = 'please search the web for current events about comets';
const LOG_PATH = `/tmp/codex-test-web-search-llm-${Date.now()}.log`;
const MCP_CONFIG_PATH = '/tmp/mcp_server_test-brave.json';

function writeMcpConfig() {
  const apiKey = process.env.BRAVE_API_KEY;
  if (!apiKey) throw new Error('BRAVE_API_KEY not set in environment');
  const config = {
    command: process.execPath,
    args: ['node_modules/@modelcontextprotocol/server-brave-search/dist/cli.js'],
    env: { BRAVE_API_KEY: apiKey }
  };
  fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(config, null, 2));
}

function cleanupMcpConfig() {
  if (fs.existsSync(MCP_CONFIG_PATH)) fs.unlinkSync(MCP_CONFIG_PATH);
}

describe('E2E: Web search via real Brave MCP (stdio, no docker)', () => {
  let pty;
  let sessionLog = '';

  beforeAll(() => {
    writeMcpConfig();
    process.env.MCP_SERVER_PATH = MCP_CONFIG_PATH;
    // Debug: print MCP_SERVER_PATH and config contents
    // eslint-disable-next-line no-console
    console.log('[DEBUG] MCP_SERVER_PATH:', process.env.MCP_SERVER_PATH);
    if (fs.existsSync(MCP_CONFIG_PATH)) {
      // eslint-disable-next-line no-console
      console.log('[DEBUG] MCP config:', fs.readFileSync(MCP_CONFIG_PATH, 'utf8'));
    } else {
      // eslint-disable-next-line no-console
      console.log('[DEBUG] MCP config file not found!');
    }
    // Launch the CLI in REPL mode
    pty = nodepty.spawn(process.execPath, ['codex-cli/bin/codex.js'], {
      name: 'xterm-color',
      cols: 120,
      rows: 40,
      cwd: path.resolve(__dirname, '../../..'),
      env: { ...process.env },
    });
    // Log all output and print to console for debugging
    pty.onData((data) => {
      sessionLog += data;
      fs.appendFileSync(LOG_PATH, data);
      // Print to Vitest runner console for debug
      process.stdout.write(`[PTY]: ${data}`);
    });
    pty.onExit(() => {
      console.log('[PTY]: Process exited');
    });
    pty.on('error', (err) => {
      console.error('[PTY]: Error', err);
    });
  });

  afterAll(async () => {
    if (pty) await killPty(pty, 'web-search-llm-e2e');
    cleanupMcpConfig();
    // Mask API keys in log if present
    const apiKey = process.env.BRAVE_API_KEY;
    if (apiKey && fs.existsSync(LOG_PATH)) {
      const log = fs.readFileSync(LOG_PATH, 'utf8');
      const masked = log.replace(new RegExp(apiKey, 'g'), '[MASKED_API_KEY]');
      fs.writeFileSync(LOG_PATH, masked);
    }
  });

  it('should search the web and return results about comets', async () => {
    // Wait for REPL help message as readiness signal
    await waitForOutput(pty, (out) => out.includes('try: explain this codebase to me'));
    // Send the prompt
    await sendInput(pty, PROMPT + '\r');
    // Wait for a structured web search response
    const output = await waitForOutput(
      pty,
      (out) => out.includes('"tool_call"') && out.includes('search_web') && !!out.match(/comet/i),
      30000
    );
    expect(output).toMatch(/search_web/);
    expect(output).toMatch(/comet/i);
    expect(output).toMatch(/url|title|snippet/i);
    // Optionally, parse JSON and check structure
    const match = output.match(/({[\s\S]*?})/);
    expect(match).toBeTruthy();
    const json = JSON.parse(match[1]);
    expect(json).toHaveProperty('tool_call');
    expect(json.tool_call).toHaveProperty('name', 'search_web');
    expect(json.tool_call).toHaveProperty('args');
    expect(json.tool_call.args.query).toMatch(/comet/i);
    expect(json).toHaveProperty('results');
    expect(Array.isArray(json.results)).toBe(true);
    expect(json.results.length).toBeGreaterThan(0);
    expect(json.results[0]).toHaveProperty('url');
  }, 40000);
});
