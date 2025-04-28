import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import path from 'path';
import fs from 'fs';

export interface MockServerHandle {
  process: ChildProcessWithoutNullStreams;
  logPath: string;
  closeLog: () => void;
  logExists: boolean;
  logSize: number;
  getLogContent: () => string;
}

/**
 * Starts the MCP mock server as a subprocess, logs output to /tmp, and returns handle for test harness use.
 * Ensures all output is buffered and flushed to a log file for robust E2E diagnostics.
 */
export function startMockServer(logPrefix = 'codex-mock-server'): MockServerHandle {
  const compiledPath = path.resolve(__dirname, '../../../dist/utils/agent/mcp-mock-server.js');
  const logPath = `/tmp/${logPrefix}-${Date.now()}.log`;
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  let logClosed = false;
  function closeLog() {
    if (!logClosed) {
      logStream.end();
      logClosed = true;
    }
  }
  const proc = spawn('node', [compiledPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  proc.stdout.on('data', data => {
    process.stdout.write(`[MOCK SERVER STDOUT] ${data}`);
    if (!logClosed) logStream.write(`[MOCK SERVER STDOUT] ${data}`);
  });
  proc.stderr.on('data', data => {
    process.stderr.write(`[MOCK SERVER STDERR] ${data}`);
    if (!logClosed) logStream.write(`[MOCK SERVER STDERR] ${data}`);
  });
  proc.on('exit', (code, signal) => {
    const msg = `[MOCK SERVER EXIT] code=${code}, signal=${signal}\n`;
    process.stdout.write(msg);
    if (!logClosed) logStream.write(msg);
    closeLog();
  });
  proc.on('close', (code, signal) => {
    const msg = `[MOCK SERVER CLOSE] code=${code}, signal=${signal}\n`;
    process.stdout.write(msg);
    if (!logClosed) logStream.write(msg);
    closeLog();
  });
  return {
    process: proc,
    logPath,
    closeLog,
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
  };
}
