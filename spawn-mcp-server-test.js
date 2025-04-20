const { spawn } = require('child_process');

const SERVER_COMMAND = 'npx';
const SERVER_ARGS = [
  '-y',
  '@modelcontextprotocol/server-everything',
  'dir',
  '--tool',
  'echo',
];

console.log('Spawning MCP server...');
const proc = spawn(SERVER_COMMAND, SERVER_ARGS, {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    FORCE_COLOR: '0',
    NODE_DISABLE_COLORS: '1',
    PYTHONUNBUFFERED: '1',
  },
});

proc.stdout.on('data', (data) => {
  process.stdout.write(`[STDOUT] ${data}`);
});

proc.stderr.on('data', (data) => {
  process.stderr.write(`[STDERR] ${data}`);
});

proc.on('spawn', () => {
  console.log('[EVENT] Child process spawned');
});
proc.on('exit', (code, signal) => {
  console.log(`[EVENT] Child process exited: code=${code}, signal=${signal}`);
});
proc.on('close', (code, signal) => {
  console.log(`[EVENT] Child process closed: code=${code}, signal=${signal}`);
});
proc.on('error', (err) => {
  console.log(`[EVENT] Child process error: ${err}`);
});
