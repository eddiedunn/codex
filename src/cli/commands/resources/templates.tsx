import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { fetchPaginated, PaginationState } from '../../../agent/pagination.js';
import { PaginatedList } from '../../../ui/PaginatedList.js';
import { MinimalMcpClient } from '../../../codex-cli/src/utils/agent/mcp-client.ts';

const mcpClient = new MinimalMcpClient({
  transport: 'stdio',
  stdioPath: process.env['MCP_SERVER_PATH'] || 'mcp-server',
  stdioArgs: [],
});

async function fetchTemplatesPage({ page, pageSize, cursor }: { page: number; pageSize: number; cursor?: string }) {
  if (!mcpClient.isConnected()) {
    await mcpClient.connect();
  }
  const opts: any = {};
  if (cursor) opts.pageToken = cursor;
  if (pageSize) opts.pageSize = pageSize;
  const { results, nextPageToken } = await mcpClient.listResourceTemplates(opts);
  return {
    items: results,
    total: undefined,
    nextCursor: nextPageToken,
  };
}

export default function TemplatesList() {
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
    fetchPaginated(fetchTemplatesPage, data).then(newState => {
      setData({ ...newState, page, pageSize });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, data.cursor]);

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

// To run interactively: render(<TemplatesList />);
