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

async function fetchTemplatesPage({ pageSize, cursor }: { pageSize: number; cursor?: string }) {
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
  const [data, setData] = useState<PaginationState<{ name: string }>>({
    page: 1,
    pageSize: 10,
    items: [],
    hasNext: false,
    hasPrev: false,
  });
  const [canQuit, setCanQuit] = useState(false);

  useEffect(() => {
    fetchPaginated(fetchTemplatesPage, data).then(newState => {
      setData({ ...data, ...newState, items: (newState.items as { name: string }[]) });
    });
  }, [data.pageSize, data.cursor]);

  useEffect(() => {
    setCanQuit(true);
  }, [data.items]);

  return (
    <PaginatedList
      state={data}
      renderItem={(item, idx) => <Text key={idx}>{item.name}</Text>}
      onNext={() => {
        setData(d => ({ ...d, cursor: (d as any).nextPageToken ?? undefined }));
      }}
      onPrev={() => {
        setData(d => ({ ...d, cursor: undefined }));
      }}
      onQuit={() => {
        if (canQuit) process.exit(0);
      }}
    />
  );
}

// To run interactively: render(<TemplatesList />);
