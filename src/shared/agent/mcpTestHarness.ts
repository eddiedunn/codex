import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import fs from 'fs';
import { getUUID } from '../../uuid.js';

const LOG_DIR = path.resolve(__dirname, '../../../../test-logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

export interface MockServerHandle {
  process: ChildProcessWithoutNullStreams;
  logPath: string;
  closeLog: () => void;
  logExists: boolean;
  logSize: number;
  getLogContent: () => string;
  getLogBuffer: () => string;
  waitForLogFinish: () => Promise<void>;
}

/**
 * Starts the MCP mock server as a subprocess, logs output to /tmp, and returns handle for test harness use.
 * Ensures all output is buffered and flushed to a log file for robust E2E diagnostics.
 */
export function startMockServer(logPrefix = 'codex-mock-server'): MockServerHandle {
  const compiledPath = path.resolve(__dirname, '../../../dist/utils/agent/mcp-mock-server.js');
  const logPath = `${LOG_DIR}/${logPrefix}-${getUUID()}.log`;
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  let logClosed = false;
  let logFinishedPromise: Promise<void> | null = null;
  let logBuffer = '';
  logStream.on('error', err => {
    console.error('[HARNESS DEBUG] logStream error:', err);
  });
  logStream.on('finish', () => {
    console.log('[HARNESS DEBUG] logStream finish event fired');
    try {
      const exists = fs.existsSync(logPath);
      const size = exists ? fs.statSync(logPath).size : 0;
      const contents = exists ? fs.readFileSync(logPath, 'utf8') : '[NO FILE]';
      console.log(`[HARNESS DEBUG] Post-finish log file check: exists=${exists}, size=${size}`);
      console.log(`[HARNESS DEBUG] Post-finish log file contents:\n${contents}`);
    } catch (err) {
      console.error('[HARNESS DEBUG] Error reading log after finish:', err);
    }
  });
  function safeWrite(msg: string) {
    if (!logClosed) {
      logBuffer += msg;
      const writeResult = logStream.write(msg);
      console.log(`[HARNESS DEBUG] safeWrite called, logClosed=${logClosed}, writeResult=${writeResult}`);
    } else {
      console.log('[HARNESS DEBUG] safeWrite skipped: logClosed');
    }
  }
  function safeCloseLog(reason: string) {
    if (!logClosed) {
      logFinishedPromise = new Promise(res => {
        logStream.end(() => {
          console.log(`[HARNESS DEBUG] logStream finished (${reason})`);
          logClosed = true;
          res();
        });
      });
      logClosed = true; // Prevent re-entry
    }
  }
  function closeLog() {
    safeCloseLog('closeLog');
  }
  function waitForLogFinish() {
    return logFinishedPromise || Promise.resolve();
  }
  const proc = spawn(process.execPath, [compiledPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  proc.stdout.on('data', data => {
    console.log('[HARNESS DEBUG] Received stdout:', data.toString());
    process.stdout.write(`[MOCK SERVER STDOUT] ${data}`);
    console.log('[HARNESS DEBUG] proc.stdout.on(data) fired, writing to log');
    console.log(`[HARNESS DEBUG] typeof data: ${typeof data}`);
    console.log(`[HARNESS DEBUG] data.toString(): ${data.toString()}`);
    safeWrite(`[MOCK SERVER STDOUT] ${data.toString()}`);
  });
  proc.stderr.on('data', data => {
    console.log('[HARNESS DEBUG] Received stderr:', data.toString());
    process.stderr.write(`[MOCK SERVER STDERR] ${data}`);
    console.log('[HARNESS DEBUG] proc.stderr.on(data) fired, writing to log');
    console.log(`[HARNESS DEBUG] typeof data: ${typeof data}`);
    console.log(`[HARNESS DEBUG] data.toString(): ${data.toString()}`);
    safeWrite(`[MOCK SERVER STDERR] ${data.toString()}`);
  });
  proc.on('exit', (code, signal) => {
    const msg = `[MOCK SERVER EXIT] code=${code}, signal=${signal}\n`;
    process.stdout.write(msg);
    console.log('[HARNESS DEBUG] proc.on(exit) fired, closing log');
    safeWrite(msg);
    safeCloseLog('exit event');
  });
  proc.on('close', (code, signal) => {
    const msg = `[MOCK SERVER CLOSE] code=${code}, signal=${signal}\n`;
    process.stdout.write(msg);
    console.log('[HARNESS DEBUG] proc.on(close) fired, closing log');
    safeWrite(msg);
    safeCloseLog('close event');
  });
  return {
    process: proc,
    logPath,
    closeLog,
    waitForLogFinish,
    get logExists() {
      return fs.existsSync(logPath);
    },
    get logSize() {
      try {
        return fs.statSync(logPath).size;
      } catch {
        return 0;
      }
    },
    getLogContent() {
      try {
        return fs.readFileSync(logPath, 'utf8');
      } catch {
        return '';
      }
    },
    getLogBuffer() {
      return logBuffer;
    },
  };
}
