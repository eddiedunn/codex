import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor, screen } from 'ink-testing-library';
import TemplatesList from './templates';

// Mock MinimalMcpClient and dependency injection
vi.mock('../../../codex-cli/src/utils/agent/mcp-client', () => {
  class MockMcpClient {
    static templates = Array.from({ length: 25 }, (_, i) => ({ name: `Template #${i + 1}` }));
    constructor() {}
    isConnected() { return true; }
    async connect() {}
    async listResourceTemplates(opts) {
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

describe('TemplatesList CLI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders first page of templates', async () => {
    const { lastFrame } = render(<TemplatesList />);
    await waitFor(() => {
      expect(lastFrame()).toContain('Template #1');
      expect(lastFrame()).toContain('Template #10');
    });
  });

  it('paginates to next page', async () => {
    const { lastFrame, stdin } = render(<TemplatesList />);
    // Go to next page (simulate right arrow or 'n')
    stdin.write('n');
    await waitFor(() => {
      expect(lastFrame()).toContain('Template #11');
      expect(lastFrame()).toContain('Template #20');
    });
  });

  it('handles empty templates', async () => {
    const { MinimalMcpClient } = require('../../../codex-cli/src/utils/agent/mcp-client');
    MinimalMcpClient.templates = [];
    const { lastFrame } = render(<TemplatesList />);
    await waitFor(() => {
      expect(lastFrame()).not.toContain('Template #1');
    });
  });

  it('handles MCP client errors', async () => {
    vi.doMock('../../../codex-cli/src/utils/agent/mcp-client', () => {
      return {
        MinimalMcpClient: class {
          isConnected() { return true; }
          async connect() {}
          async listResourceTemplates() { throw new Error('MCP error'); }
        }
      };
    }, { virtual: true });
    // Re-import the component to use the new mock
    const ErrorTemplatesList = (await import('./templates')).default;
    const { lastFrame } = render(<ErrorTemplatesList />);
    await waitFor(() => {
      expect(lastFrame()).toContain('MCP error');
    });
  });
});
