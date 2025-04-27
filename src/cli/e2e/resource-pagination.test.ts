import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import nodepty from 'node-pty';
import path from 'path';
import { waitForOutput, sendInput, killPty } from './pty-helpers';

const CLI_PATH = path.resolve(__dirname, '../../codex-cli/bin/codex');

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

describe('CLI Resource Pagination E2E', () => {
  let pty;

  beforeAll(() => {
    // Spawn the CLI in a pseudo-terminal
    pty = nodepty.spawn('node', [CLI_PATH, 'resources', 'list'], {
      cols: 120,
      rows: 40,
      cwd: process.cwd(),
      env: process.env,
    });
  });

  afterAll(async () => {
    console.log('[afterAll] Cleaning up PTY for resource-pagination');
    await killPty(pty, 'resource-pagination');
    console.log('[afterAll] Cleanup complete for resource-pagination');
  });

  afterAll(() => {
    // Delay to allow PTY/process cleanup
    setTimeout(() => {
      // These are Node.js internal APIs for debugging only
      // eslint-disable-next-line no-underscore-dangle
      const handles = (process as any)._getActiveHandles?.() || [];
      // eslint-disable-next-line no-underscore-dangle
      const requests = (process as any)._getActiveRequests?.() || [];
      console.log('[DIAGNOSTIC] Open handles after resource-pagination.test.ts:', handles);
      console.log('[DIAGNOSTIC] Open requests after resource-pagination.test.ts:', requests);
    }, 500);
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
  });

  it('handles first page gracefully', async () => {
    // Back to first page
    for (let i = 0; i < 5; i++) await sendInput(pty, '\x1B[A');
    await expectLines(pty, ['Resource 1', 'Resource 2', 'Resource 3']);
    // Try to go prev again (should not error)
    await sendInput(pty, '\x1B[A');
    await expectLines(pty, ['Resource 1', 'Resource 2', 'Resource 3']);
  });

  it('exits cleanly', async () => {
    await sendInput(pty, 'q'); // Or whatever the CLI uses to exit
    // Optionally: check for CLI exit message or process close
  });
});
