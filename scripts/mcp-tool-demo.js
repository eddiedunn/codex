#!/usr/bin/env ts-node

// Minimal MCP tool call demo script
// Usage: npx ts-node scripts/mcp-tool-demo.js <toolName> '{"arg1":"value1"}'

import { AgentLoop } from '../codex-cli/src/utils/agent/agent-loop.ts';

async function main() {
  const [,, toolName, rawArgs] = process.argv;
  if (!toolName) {
    console.error('Usage: mcp-tool-demo.js <toolName> <jsonArgs>');
    process.exit(1);
  }
  let args = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch (e) {
    console.error('Invalid JSON for arguments:', rawArgs);
    process.exit(1);
  }

  // Minimal AgentLoop for demo purposes
  const agent = new AgentLoop({
    model: 'any',
    instructions: '',
    approvalPolicy: { mode: 'auto' },
    additionalWritableRoots: [],
    onItem: (item) => console.log('Agent item:', item),
    onLoading: () => {},
    getCommandConfirmation: async () => ({ review: 'yes' }),
    onLastResponseId: () => {},
  });
  await agent.initMcpTools();
  try {
    const result = await agent.invokeMcpTool(toolName, args);
    console.log('Tool result:', result);
  } catch (err) {
    console.error('Tool error:', err.message || err);
    process.exit(2);
  }
}

main();
