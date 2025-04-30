import nodepty from 'node-pty';
import { waitForOutput, sendInput, killPty } from './pty-helpers';
import { describe, it, expect } from 'vitest';
import path from 'path';

// Use absolute path to CLI entrypoint for ts-node
const CLI_PATH = path.resolve(__dirname, '../commands/resources/templates.tsx');
const NODE_BIN = process.execPath;

describe('Templates CLI Pagination E2E', () => {
  it('should paginate templates list on user input', async () => {
    // Spawn: npx ts-node src/cli/commands/resources/templates.tsx
    const pty = nodepty.spawn(NODE_BIN, ['node_modules/ts-node/dist/bin.js', CLI_PATH], {
      name: 'xterm-color',
      cols: 80,
      rows: 30,
      cwd: process.cwd(),
      env: process.env,
    });

    try {
      // Wait for first page
      await waitForOutput(pty, (out) => out.includes('Template #1') && out.includes('Template #10'));
      // Send 'n' for next page
      await sendInput(pty, 'n\r');
      // Wait for second page
      const output = await waitForOutput(pty, (out) => out.includes('Template #11') && out.includes('Template #20'));
      expect(output).toMatch(/Template #1/);
      expect(output).toMatch(/Template #10/);
      expect(output).toMatch(/Template #11/);
      expect(output).toMatch(/Template #20/);
      // Optionally, send 'q' to quit
      await sendInput(pty, 'q\r');
    } finally {
      await killPty(pty, 'templates-pagination');
    }
  }, 15000);
});
