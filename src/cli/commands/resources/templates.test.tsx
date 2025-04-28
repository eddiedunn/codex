import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import TemplatesList from './templates';

// Mock MinimalMcpClient and dependency injection
vi.mock('../../../../codex-cli/src/utils/agent/mcp-client', () => {
  class MockMcpClient {
    static templates = Array.from({ length: 25 }, (_, i) => ({ name: `Template #${i + 1}` }));
    constructor() {}
    isConnected() { return true; }
    async connect() {}
    async listResourceTemplates(opts) {
      // Diagnostic log to confirm mock usage
      console.log('[MOCK] listResourceTemplates called with', opts);
      const pageSize = opts.pageSize || 10;
      const pageToken = opts.pageToken ? parseInt(opts.pageToken, 10) : 0;
      const start = pageToken;
      const end = start + pageSize;
      const results = MockMcpClient.templates.slice(start, end);
      return {
        results,
        nextPageToken: end < MockMcpClient.templates.length ? String(end) : undefined,
      };
    }
  }
  return { MinimalMcpClient: MockMcpClient };
});

// Minimal async wait helper for CLI/Ink output
async function waitForOutput(fn: () => void, opts: { timeout?: number; interval?: number } = {}) {
  const { timeout = 2000, interval = 50 } = opts;
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      fn();
      return;
    } catch (err) {
      if (Date.now() - start > timeout) throw err;
      await new Promise(res => setTimeout(res, interval));
    }
  }
}

describe('TemplatesList CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders first page of templates', async () => {
    const { lastFrame } = render(<TemplatesList />);
    await waitForOutput(() => {
      expect(lastFrame()).toContain('Template #1');
      expect(lastFrame()).toContain('Template #10');
    });
  });

  it('paginates to next page', async () => {
    const { lastFrame, stdin } = render(<TemplatesList />);
    stdin.write('n');
    await waitForOutput(() => {
      expect(lastFrame()).toContain('Template #11');
      expect(lastFrame()).toContain('Template #20');
    });
  });

  it('handles empty templates', async () => {
    const { MinimalMcpClient } = require('../../../../codex-cli/src/utils/agent/mcp-client');
    MinimalMcpClient.templates = [];
    const { lastFrame } = render(<TemplatesList />);
    await waitForOutput(() => {
      expect(lastFrame()).not.toContain('Template #1');
    });
  });

  it('handles MCP client errors', async () => {
    vi.doMock('../../../../codex-cli/src/utils/agent/mcp-client', () => {
      return {
        MinimalMcpClient: class {
          isConnected() { return true; }
          async connect() {}
          async listResourceTemplates() { throw new Error('MCP error'); }
        }
      };
    }, { virtual: true });
    const ErrorTemplatesList = (await import('./templates')).default;
    const { lastFrame } = render(<ErrorTemplatesList />);
    await waitForOutput(() => {
      expect(lastFrame()).toContain('MCP error');
    });
  });
});
