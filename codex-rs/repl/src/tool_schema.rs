// Enumerate all available tool schemas (stub for now)
pub fn get_all_tool_schemas(mcp_enabled: bool) -> String {
    if mcp_enabled {
        // In real implementation, gather schemas from all providers
        "[core tools, mcp tools]".to_string()
    } else {
        "[core tools]".to_string()
    }
}
