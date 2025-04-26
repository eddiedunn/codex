// PTY helper utilities for CLI E2E tests
import type { IPty } from 'node-pty';

/**
 * Wait for PTY output that matches a predicate, or timeout.
 */
export async function waitForOutput(
  pty: IPty,
  predicate: (output: string) => boolean,
  timeout = 5000
): Promise<string> {
  let buffer = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timeout waiting for PTY output'));
    }, timeout);
    function onData(data: string) {
      buffer += data;
      if (predicate(buffer)) {
        cleanup();
        resolve(buffer);
      }
    }
    function cleanup() {
      clearTimeout(timer);
      pty.removeListener('data', onData);
    }
    pty.on('data', onData);
  });
}

/**
 * Send input to the PTY (simulate user keystrokes).
 */
export async function sendInput(pty: IPty, input: string) {
  pty.write(input);
  // Give some time for CLI to react
  await new Promise((r) => setTimeout(r, 200));
}

/**
 * Kill the PTY process (cleanup).
 */
export function killPty(pty: IPty) {
  try {
    pty.kill();
  } catch {}
}
