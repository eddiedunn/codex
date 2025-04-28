import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { fetchPaginated, PaginationState } from '../../../agent/pagination.js';
import { PaginatedList } from '../../../ui/PaginatedList.js';
import { MinimalMcpClient } from '../../../../codex-cli/src/utils/agent/mcp-client';
import { render } from 'ink';

console.log('[DIAG] CLI ENTRYPOINT REACHED');

const mcpClient = new MinimalMcpClient({
  transport: 'stdio',
  stdioPath: process.env['MCP_SERVER_PATH'] || 'mcp-server',
  stdioArgs: [],
});

async function fetchTemplatesPage({ pageSize, cursor }: { pageSize: number; cursor?: string }) {
  if (!mcpClient.isConnected()) {
    await mcpClient.connect();
  }
  const opts: any = {};
  if (cursor) opts.pageToken = cursor;
  if (pageSize) opts.pageSize = pageSize;
  const { results, nextPageToken } = await mcpClient.listResourceTemplates(opts);
  console.log(`[DIAG] fetchTemplatesPage called with pageSize=${pageSize}, cursor=${cursor}`);
  console.log(`[DIAG] results:`, JSON.stringify(results));
  return {
    items: results as { name: string }[],
    total: undefined,
    nextCursor: nextPageToken,
  };
}

export default function TemplatesList() {
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([undefined]);
  const [data, setData] = useState<PaginationState<{ name: string }>>({
    page: 0,
    pageSize: 10,
    items: [],
    hasNext: false,
    hasPrev: false,
    total: undefined,
    cursor: undefined,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [canQuit, setCanQuit] = useState(false);

  // The current cursor is always the last in the stack
  const cursor = cursorStack[cursorStack.length - 1];
  const page = cursorStack.length - 1;

  // EFFECT: fetchPaginated keyed on cursorStack, not just cursor
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPaginated<{ name: string }>(fetchTemplatesPage, {
      items: [],
      page,
      pageSize: data.pageSize,
      total: undefined,
      hasNext: false,
      hasPrev: false,
      cursor: cursorStack[cursorStack.length - 1],
    })
      .then(newState => {
        if (!cancelled) {
          if (process.env['VITEST']) {
            // eslint-disable-next-line no-console
            console.log('[DEBUG] newState:', JSON.stringify(newState));
          }
          console.log(`[DIAG] RENDERING PAGE`, JSON.stringify(newState.items));
          setData(newState);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || String(err));
          setLoading(false);
          console.error('[DIAG] ERROR in fetchPaginated:', err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cursorStack.join('|'), data.pageSize]);

  useEffect(() => {
    setCanQuit(true);
  }, [data.items]);

  useEffect(() => {
    if (process.env['VITEST']) {
      // eslint-disable-next-line no-console
      console.log('[DEBUG] cursor:', cursor, 'page:', page, 'items:', data.items.map(i => i.name).join(','));
    }
  }, [cursor, page, data.items]);

  // Detect test environment to avoid process.exit()
  const isTest = typeof process !== 'undefined' && process.env['VITEST'];

  if (loading) return <Text color="yellow">Loading templates...</Text>;
  if (error) return <Text color="red">Error: {error}</Text>;
  if (!data.items || data.items.length === 0) return <Text color="gray">No templates found.</Text>;

  return (
    <PaginatedList
      state={{
        ...data,
        page,
        cursor,
      }}
      renderItem={(item, idx) => <Text key={idx}>{item.name}</Text>}
      onNext={() => {
        if (process.env['VITEST']) {
          // eslint-disable-next-line no-console
          console.log('[DEBUG] onNext called', { data, cursor });
        }
        if (data.hasNext && data.cursor) {
          setCursorStack(stack => {
            const newStack = [...stack, data.cursor];
            if (process.env['VITEST']) {
              // eslint-disable-next-line no-console
              console.log('[DEBUG] onNext newStack:', newStack);
            }
            return newStack;
          });
        }
      }}
      onPrev={() => {
        if (data.hasPrev && cursorStack.length > 1) {
          setCursorStack(stack => stack.slice(0, -1));
        }
      }}
      onQuit={() => {
        if (canQuit && !isTest) process.exit(0);
        // In test, just allow Ink to unmount naturally
      }}
    />
  );
}

// To run interactively: render(<TemplatesList />);

// --- Render CLI if run directly (ESM-compatible) ---
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url === process.argv[1]) {
  render(<TemplatesList />);
}
