import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

export function startMcpServer(command: string, args: string[], env: Record<string, string> = {}): ChildProcessWithoutNullStreams {
  const proc = spawn(command, args, {
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  // Print all stdout/stderr for diagnostics
  proc.stdout.on('data', (data) => {
    console.log(`[MCP_SERVER][stdout]: ${data.toString()}`);
  });
  proc.stderr.on('data', (data) => {
    console.error(`[MCP_SERVER][stderr]: ${data.toString()}`);
  });
  proc.on('exit', (code, signal) => {
    console.log(`[MCP_SERVER] exited with code ${code}, signal ${signal}`);
  });
  return proc;
}

export function stopMcpServer(proc: ChildProcessWithoutNullStreams) {
  if (proc && !proc.killed) {
    proc.kill();
  }
}
