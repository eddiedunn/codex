import type { ResponseFunctionToolCallItem } from "openai/resources/responses/responses.mjs";
import { AutoApprovalMode } from '../auto-approval-mode.js';
import { AgentLoop } from './agent-loop.js';
import { describe, it, expect, vi } from 'vitest';
import { ReviewDecision } from './review.js';

describe('AgentLoop MCP tool call routing (DI pattern)', () => {
  it('routes mcp. tool calls to the injected invokeMcpTool and returns result', async () => {
    const invokeMcpTool = vi.fn().mockResolvedValue({ foo: 'bar' });
    const loop = new AgentLoop({
      model: 'test',
      approvalPolicy: AutoApprovalMode.SUGGEST,
      onItem: () => undefined,
      onLoading: () => undefined,
      getCommandConfirmation: async () => ({ review: ReviewDecision.YES }),
      onLastResponseId: () => undefined,
      additionalWritableRoots: [],
      invokeMcpTool
    });
    // Nested, spec-compliant tool call object
    const toolCall: ResponseFunctionToolCallItem = {
      id: '1',
      call_id: 'call-1',
      type: "function_call",
      name: 'mcp.testTool',
      arguments: '{"a":1}'
    };
    const result = await loop['handleFunctionCall'](toolCall);
    expect(invokeMcpTool).toHaveBeenCalledWith('mcp.testTool', { a: 1 });
    expect(result[0]?.type).toBe('function_call_output');
    const outputItem = result[0];
    if (outputItem && outputItem.type === 'function_call_output') {
      expect(() => JSON.parse(outputItem.output || '')).not.toThrow();
      expect(JSON.parse(outputItem.output || '{}')).toEqual({ foo: 'bar' });
    } else {
      throw new Error('Expected function_call_output');
    }
  });

  it('returns error output if invokeMcpTool throws', async () => {
    const invokeMcpTool = vi.fn().mockRejectedValue(new Error('fail'));
    const loop = new AgentLoop({
      model: 'test',
      approvalPolicy: AutoApprovalMode.SUGGEST,
      onItem: () => undefined,
      onLoading: () => undefined,
      getCommandConfirmation: async () => ({ review: ReviewDecision.YES }),
      onLastResponseId: () => undefined,
      additionalWritableRoots: [],
      invokeMcpTool
    });
    // Nested, spec-compliant tool call object
    const toolCall: ResponseFunctionToolCallItem = {
      id: '2',
      call_id: 'call-2',
      type: "function_call",
      name: 'mcp.failTool',
      arguments: '{}'
    };
    const result = await loop['handleFunctionCall'](toolCall);
    expect(result[0]?.type).toBe('function_call_output');
    const outputItem = result[0];
    if (outputItem && outputItem.type === 'function_call_output') {
      expect(() => JSON.parse(outputItem.output || '')).not.toThrow();
      expect(JSON.parse(outputItem.output || '{}')).toHaveProperty('error');
    } else {
      throw new Error('Expected function_call_output');
    }
  });
});
