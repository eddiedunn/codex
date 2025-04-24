import type { McpToolRegistry, McpToolExposureMode } from "./mcp-tool-exposure-types.js";

export type McpToolExposureMode = "registry" | "prompt" | "hybrid" | "bypass";

export interface McpToolRegistry {
  [toolName: string]: { server: string; tool: any };
}

export async function buildMcpToolRegistry(...args: any[]): Promise<McpToolRegistry> {
  const { aggregateMcpToolsGeneric } = await import("./mcp-client.js");
  return aggregateMcpToolsGeneric(...args);
}

export function generateMcpPromptSummary(registry: McpToolRegistry): string {
  const lines = ["You may use the following tools:"];
  for (const [name, { tool }] of Object.entries(registry)) {
    lines.push(`- ${name}: ${tool.description || "No description."} Parameters: ${JSON.stringify(tool.parameters || {})}`);
  }
  return lines.join("\n");
}

export function getMcpToolExposureMode(): McpToolExposureMode {
  const mode = process.env["MCP_TOOL_EXPOSURE_MODE"]?.toLowerCase();
  if (mode === "prompt" || mode === "hybrid" || mode === "bypass") return mode;
  return "registry"; // default
}
