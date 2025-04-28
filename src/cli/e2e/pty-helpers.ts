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
      if (disposeData) disposeData.dispose();
    }
    const disposeData = pty.onData(onData);
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
 * Kill the PTY process (cleanup) and wait for exit.
 */
export async function killPty(pty: IPty, logTag?: string) {
  if (logTag) console.log(`[killPty] Killing PTY for: ${logTag}`);
  let exited = false;
  const exitPromise = new Promise((resolve) => {
    const disposeExit = pty.onExit(() => {
      exited = true;
      if (logTag) console.log(`[killPty] PTY exited for: ${logTag}`);
      resolve(true);
      disposeExit.dispose();
    });
  });
  try {
    pty.kill();
  } catch (e) {
    if (logTag) console.log(`[killPty] Error killing PTY: ${e}`);
  }
  // Wait up to 2s for exit
  await Promise.race([
    exitPromise,
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  if (!exited && logTag) console.log(`[killPty] PTY did not exit in time for: ${logTag}`);
  // No removeAllListeners in node-pty; handlers are disposed above.
}
