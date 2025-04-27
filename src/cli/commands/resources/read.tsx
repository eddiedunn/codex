import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { MinimalMcpClient } from '../../../codex-cli/src/utils/agent/mcp-client';

interface Props {
  uri: string;
}

export default function ResourceRead({ uri }: Props) {
  const [resource, setResource] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mcpClient = new MinimalMcpClient({
      transport: 'stdio',
      stdioPath: process.env['MCP_SERVER_PATH'] || 'mcp-server',
      stdioArgs: [],
    });
    (async () => {
      try {
        if (!mcpClient.isConnected()) {
          await mcpClient.connect();
        }
        const result = await mcpClient.readResource(uri);
        setResource(result);
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [uri]);

  if (loading) return <Text color="yellow">Loading resource...</Text>;
  if (error) return <Text color="red">Error: {error}</Text>;
  if (!resource) return <Text color="gray">No resource found.</Text>;

  return (
    <Box flexDirection="column">
      <Text color="green">Resource Details:</Text>
      <Text>{JSON.stringify(resource, null, 2)}</Text>
    </Box>
  );
}

// Usage: codex read --uri <resource-uri>
// Description: Read and display details for a specific MCP resource by URI.
