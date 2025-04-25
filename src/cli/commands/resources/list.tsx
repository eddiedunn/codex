console.error('[DEBUG] Top-level: ResourcesList file loaded, MOCK_RESOURCES_LENGTH:', process.env['MOCK_RESOURCES_LENGTH']);

import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { fetchPaginated, PaginationState } from '../../../agent/pagination.js';
import { PaginatedList } from '../../../ui/PaginatedList.js';
import { MinimalMcpClient } from '../../../codex-cli/src/utils/agent/mcp-client.js';

const mcpClient = new MinimalMcpClient({
  transport: 'stdio',
  stdioPath: process.env['MCP_SERVER_PATH'] || 'mcp-server',
  stdioArgs: [],
});

console.error('[DEBUG] Before ResourcesList component definition, MOCK_RESOURCES_LENGTH:', process.env['MOCK_RESOURCES_LENGTH']);

async function fetchResourcesPage({ page, pageSize, cursor }: { page: number; pageSize: number; cursor?: string }) {
  // Connect only once per session
  if (!mcpClient.isConnected()) {
    await mcpClient.connect();
  }
  // Use cursor-based pagination if available, fallback to page/pageSize
  const opts: any = {};
  if (cursor) opts.pageToken = cursor;
  if (pageSize) opts.pageSize = pageSize;
  // For strict protocol, we could also pass page number if supported
  const { results, nextPageToken } = await mcpClient.listResources(opts);
  return {
    items: results,
    total: undefined, // MCP does not always return total count
    nextCursor: nextPageToken,
  };
}

export default function ResourcesList() {
  console.error('[DEBUG] ResourcesList component rendered, MOCK_RESOURCES_LENGTH:', process.env['MOCK_RESOURCES_LENGTH']);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [data, setData] = useState<PaginationState<{ name: string }>>({
    items: [],
    page: 0,
    pageSize: 10,
    hasNext: true,
    hasPrev: false,
    cursor: undefined,
  });

  useEffect(() => {
    fetchPaginated(fetchResourcesPage, data).then(newState => {
      // Debug: log what is being set
      console.error('[DEBUG] setData called with:', {
        ...newState,
        page,
        pageSize
      });
      setData({ ...newState, page, pageSize });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, data.cursor]);

  // Debug: log state before rendering PaginatedList
  if (process.env['DEBUG_PAGINATION']) {
    console.error('[DEBUG] Before render PaginatedList', {
      state: data,
      itemsLength: data.items.length,
      items: data.items.map(i => i.name)
    });
  }

  // Prevent quitting until at least one fetch/render with items or empty is complete
  const [canQuit, setCanQuit] = useState(false);
  useEffect(() => {
    setCanQuit(true);
  }, [data.items]);

  return (
    <PaginatedList
      state={data}
      renderItem={(item, idx) => <Text key={idx}>{item.name}</Text>}
      onNext={() => {
        setPage(p => p + 1);
        setData(d => ({ ...d, cursor: d.cursor }));
      }}
      onPrev={() => {
        setPage(p => Math.max(0, p - 1));
        setData(d => ({ ...d, cursor: undefined }));
      }}
      onQuit={() => {
        if (canQuit) process.exit(0);
      }}
    />
  );
}

// To run interactively: render(<ResourcesList />);
