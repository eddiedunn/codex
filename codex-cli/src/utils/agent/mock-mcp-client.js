// Mock MCP client for CLI test mode
export async function listMcpTools() {
  if (process.env.MOCK_MCP_CLIENT_ERROR) {
    throw new Error("Mock MCP client error");
  }
  if (process.env.MOCK_MCP_CLIENT_EMPTY) {
    return [];
  }
  return [
    { name: "toolA", description: "Test tool A" },
    { name: "toolB", description: "Test tool B" },
  ];
}
