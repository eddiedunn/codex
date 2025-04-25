import { describe, it, expect, vi } from 'vitest';
import { AgentLoop } from './agent-loop';
import type { ResponseFunctionToolCall } from "openai/resources/responses/responses.mjs";

describe('AgentLoop MCP tool call routing (DI pattern)', () => {
  it('routes mcp. tool calls to the injected invokeMcpTool and returns result', async () => {
    const invokeMcpTool = vi.fn().mockResolvedValue({ foo: 'bar' });
    const loop = new AgentLoop({
      model: 'test',
      approvalPolicy: {} as any,
      onItem: () => {},
      onLoading: () => {},
      getCommandConfirmation: async () => ({ review: 'approve' } as any),
      onLastResponseId: () => {},
      additionalWritableRoots: [],
      invokeMcpTool
    });
    // Nested, spec-compliant tool call object (cast as any to bypass TS limitation)
    const toolCall = {
      id: '1',
      call_id: 'call-1',
      type: "function_call",
      function: {
        name: 'mcp.testTool',
        arguments: '{"a":1}'
      }
    } as any;
    const result = await loop['handleFunctionCall'](toolCall);
    expect(invokeMcpTool).toHaveBeenCalledWith('mcp.testTool', { a: 1 });
    expect(result[0]?.type).toBe('function_call_output');
    expect(() => JSON.parse(result[0]?.output || '')).not.toThrow();
    expect(JSON.parse(result[0]?.output || '{}')).toEqual({ foo: 'bar' });
  });

  it('returns error output if invokeMcpTool throws', async () => {
    const invokeMcpTool = vi.fn().mockRejectedValue(new Error('fail'));
    const loop = new AgentLoop({
      model: 'test',
      approvalPolicy: {} as any,
      onItem: () => {},
      onLoading: () => {},
      getCommandConfirmation: async () => ({ review: 'approve' } as any),
      onLastResponseId: () => {},
      additionalWritableRoots: [],
      invokeMcpTool
    });
    // Nested, spec-compliant tool call object (cast as any to bypass TS limitation)
    const toolCall = {
      id: '2',
      call_id: 'call-2',
      type: "function_call",
      function: {
        name: 'mcp.failTool',
        arguments: '{}'
      }
    } as any;
    const result = await loop['handleFunctionCall'](toolCall);
    expect(result[0]?.type).toBe('function_call_output');
    expect(() => JSON.parse(result[0]?.output || '')).not.toThrow();
    expect(JSON.parse(result[0]?.output || '{}')).toHaveProperty('error');
  });
});
