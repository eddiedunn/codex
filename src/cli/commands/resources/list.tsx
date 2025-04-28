console.error('[DEBUG] Top-level: ResourcesList file loaded, MOCK_RESOURCES_LENGTH:', process.env['MOCK_RESOURCES_LENGTH']);

import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { fetchPaginated, PaginationState } from '../../../agent/pagination.js';
import { PaginatedList } from '../../../ui/PaginatedList.js';
import { MinimalMcpClient } from '../../../../codex-cli/src/utils/agent/mcp-client';

const mcpClient = new MinimalMcpClient({
  transport: 'stdio',
  stdioPath: process.env['MCP_SERVER_PATH'] || 'mcp-server',
  stdioArgs: [],
});

console.error('[DEBUG] Before ResourcesList component definition, MOCK_RESOURCES_LENGTH:', process.env['MOCK_RESOURCES_LENGTH']);

// --- FORCE PAGE SIZE FOR TESTABILITY ---
const DEFAULT_PAGE_SIZE = 2;

async function fetchResourcesPage({ page, pageSize }: { page: number; pageSize: number }) {
  if (!mcpClient.isConnected()) {
    await mcpClient.connect();
  }
  const { results, nextPageToken } = await mcpClient.listResources({
    pageSize,
    pageToken: String(page * pageSize),
  });
  return {
    items: results,
    total: undefined, // or set to mock length if available
    nextCursor: nextPageToken,
  };
}

export default function ResourcesList({ onQuit }: { onQuit?: () => void } = {}) {
  console.error('[DEBUG] ResourcesList component rendered, MOCK_RESOURCES_LENGTH:', process.env['MOCK_RESOURCES_LENGTH']);
  const [page, setPage] = useState<number>(1);
  const [data, setData] = useState<PaginationState<{ name: string }>>({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    items: [],
    hasNext: false,
    hasPrev: false,
  });

  useEffect(() => {
    fetchPaginated(fetchResourcesPage, data).then((newState) => {
      // Ensure items are typed as { name: string }[]
      setData({ ...data, ...newState, items: (newState.items as { name: string }[]) });
    });
  }, [page, data.pageSize]);

  // Prevent quitting until at least one fetch/render with items or empty is complete
  const [canQuit, setCanQuit] = useState(false);
  useEffect(() => {
    setCanQuit(true);
  }, [data.items]);

  // Debug: log state before rendering PaginatedList
  if (process.env['DEBUG_PAGINATION']) {
    console.error('[DEBUG] Before render PaginatedList', {
      state: data,
      itemsLength: data.items.length,
      items: data.items.map(i => i.name)
    });
  }

  return (
    <PaginatedList
      state={data}
      renderItem={(item, idx) => <Text key={idx}>{item.name}</Text>}
      onNext={() => {
        setPage(p => p + 1);
      }}
      onPrev={() => {
        setPage(p => Math.max(0, p - 1));
      }}
      onQuit={onQuit || (() => {
        if (canQuit) process.exit(0);
      })}
    />
  );
}

// To run interactively: render(<ResourcesList />);
