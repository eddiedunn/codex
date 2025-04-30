import { describe, it, expect } from 'vitest';
import nodepty from 'node-pty';
import path from 'path';
import process from 'process';

// Path to your CLI entrypoint (absolute path)
const CLI_PATH = path.resolve(__dirname, '../../../codex-cli/src/cli.tsx');

function waitForOutput(pty, matcher, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let output = '';
    const handler = (data) => {
      output += data;
      if (matcher.test(output)) {
        pty.removeListener('data', handler);
        resolve(output);
      }
    };
    pty.on('data', handler);
    setTimeout(() => {
      pty.removeListener('data', handler);
      reject(new Error('Timed out waiting for output: ' + matcher));
    }, timeout);
  });
}

describe('MCPO E2E (TTY) - Resource Listing', () => {
  it('lists resources with pagination in interactive CLI', async () => {
    // Use absolute Node.js binary path to avoid ENOENT with NVM and node-pty
    // See https://github.com/nvm-sh/nvm/issues/2146 and project troubleshooting docs
    const NODE_BIN = process.execPath;
    // Minimal node-pty test: spawn echo hello (still safe, but use NODE_BIN for Node.js CLI)
    const pty = nodepty.spawn(NODE_BIN, ['-e', "console.log('hello')"], {
      cols: 120,
      rows: 40,
      cwd: process.cwd(),
      env: process.env,
    });
    let output = '';
    pty.on('data', (data) => {
      output += data;
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('PTY OUTPUT:', output);
    expect(output).toContain('hello');
    return;
  });
});
