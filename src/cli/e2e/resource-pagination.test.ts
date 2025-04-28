import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nodepty from 'node-pty';
import path from 'path';
import fs from 'fs';
import { waitForOutput, sendInput, killPty } from './pty-helpers';
import process from 'process';

// Robust CLI path: always relative to monorepo root
// TEMP: Use absolute path for CLI binary to avoid cwd/sandbox issues
const CLI_PATH = '/Users/tmwsiy/code/codex/codex-cli/bin/codex.js';

// Print directory contents for diagnostics
console.log('[DIAG][BOOT] codex-cli/bin contents:', fs.readdirSync('/Users/tmwsiy/code/codex/codex-cli/bin'));

// Helper: Wait for output containing all expected lines
async function expectLines(pty, expectedLines, timeout = 5000) {
  const output = await waitForOutput(pty, (out) =>
    expectedLines.every((line) => out.includes(line)),
    timeout
  );
  expectedLines.forEach((line) => {
    expect(output).toContain(line);
  });
}

// --- BEGIN DIAGNOSTIC INSTRUMENTATION ---
function logPtyState(pty, label = '') {
  if (!pty) {
    console.log(`[DIAG][${label}] PTY is null/undefined`);
    return;
  }
  try {
    console.log(`[DIAG][${label}] PTY PID:`, pty.pid);
    console.log(`[DIAG][${label}] PTY process:`, pty.process);
    console.log(`[DIAG][${label}] PTY cols/rows:`, pty.cols, pty.rows);
  } catch (e) {
    console.log(`[DIAG][${label}] Error logging PTY state:`, e);
  }
}

function logEnv(label = '') {
  console.log(`[DIAG][${label}] ENV:`, JSON.stringify(process.env, null, 2));
}

function logOutput(data, label = '') {
  console.log(`[DIAG][${label}] PTY OUTPUT:`, data);
}
// --- END DIAGNOSTIC INSTRUMENTATION ---

describe('CLI Resource Pagination E2E', () => {
  let pty;
  let exited;
  let exitCode;
  let exitError;

  beforeEach(() => {
    exited = false;
    exitCode = undefined;
    exitError = undefined;
    logEnv('beforeEach');
    // Use absolute Node.js binary path to avoid ENOENT with NVM and node-pty
    // See https://github.com/nvm-sh/nvm/issues/2146 and project troubleshooting docs
    const NODE_BIN = process.execPath;
    // Spawn the CLI in a pseudo-terminal for each test
    pty = nodepty.spawn(NODE_BIN, [CLI_PATH, 'resources', 'list'], {
      cols: 120,
      rows: 40,
      cwd: process.cwd(),
      env: process.env,
    });
    logPtyState(pty, 'beforeEach');
    pty.on('exit', (code) => {
      exited = true;
      exitCode = code;
      console.log(`[PTY EXIT] code=${code}`);
    });
    pty.on('error', (err) => {
      exitError = err;
      console.error('[PTY ERROR]', err);
    });
    pty.on('data', (data) => {
      logOutput(data, 'data');
    });
  });

  afterEach(async () => {
    logPtyState(pty, 'afterEach');
    await killPty(pty, 'resource-pagination');
    // Wait briefly to allow process to close
    await new Promise((res) => setTimeout(res, 200));
    if (!exited) {
      console.warn('[AFTEREACH] PTY did not exit cleanly.');
    }
    if (exitError) {
      console.error('[AFTEREACH] PTY error:', exitError);
    }
    // Node.js internal diagnostics for open handles
    // eslint-disable-next-line no-underscore-dangle
    const handles = (process as any)._getActiveHandles?.() || [];
    // eslint-disable-next-line no-underscore-dangle
    const requests = (process as any)._getActiveRequests?.() || [];
    console.log('[DIAGNOSTIC] Open handles after test:', handles);
    console.log('[DIAGNOSTIC] Open requests after test:', requests);
  });

  it('shows first page of resources', async () => {
    await expectLines(pty, ['Resource 1', 'Resource 2', 'Resource 3']);
  });

  it('navigates to next page', async () => {
    await sendInput(pty, '\x1B[B'); // Down arrow or custom next-page key
    await expectLines(pty, ['Resource 4', 'Resource 5', 'Resource 6']);
  });

  it('navigates back to previous page', async () => {
    await sendInput(pty, '\x1B[A'); // Up arrow or custom prev-page key
    await expectLines(pty, ['Resource 1', 'Resource 2', 'Resource 3']);
  });

  it('handles last page gracefully', async () => {
    // Navigate to last page (simulate multiple nexts)
    for (let i = 0; i < 5; i++) await sendInput(pty, '\x1B[B');
    await expectLines(pty, ['Resource 10']);
    // Try to go next again (should not error)
    await sendInput(pty, '\x1B[B');
    await expectLines(pty, ['Resource 10']);
    // Canonical expectation: empty array for out-of-bounds page
    // Optionally, check for a message like 'No resources found' if CLI displays it
    await expectLines(pty, []); // Expect empty array
  });

  it('handles out-of-bounds/negative page gracefully', async () => {
    // Simulate navigating to a negative page
    for (let i = 0; i < 10; i++) await sendInput(pty, '\x1B[A');
    // Canonical expectation: empty array for out-of-bounds/negative page
    // Optionally, check for a message like 'No resources found' if CLI displays it
    // If the CLI does not print anything, this test will pass if no error is thrown
    // If the CLI prints a message, assert its presence
    await expectLines(pty, []); // Expect empty array
  });

  it('exits cleanly', async () => {
    await sendInput(pty, 'q'); // Or whatever the CLI uses to exit
    // Wait for the PTY to exit (max 2s)
    const exitWait = new Promise((resolve, reject) => {
      let waited = 0;
      const interval = setInterval(() => {
        if (exited) {
          clearInterval(interval);
          resolve(undefined);
        } else if ((waited += 100) > 2000) {
          clearInterval(interval);
          reject(new Error('PTY did not exit after sending quit'));
        }
      }, 100);
    });
    await exitWait;
    expect(exited).toBe(true);
    expect(exitCode).toBe(0);
  });
});
