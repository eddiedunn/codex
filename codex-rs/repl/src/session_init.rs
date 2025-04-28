use crate::tool_schema::get_all_tool_schemas;
use crate::log_writer::LogWriter;
use codex_core::config::Config;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct SessionInitResult {
    pub mcp_enabled: bool,
    pub warning: Option<String>,
}

pub fn initialize_session() -> SessionInitResult {
    // Determine MCP config presence
    let config = Config::load().unwrap_or_default();
    let mcp_enabled = config.mcp.is_some();

    // Prepare log file path
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    let timestamp = now.as_secs();
    let log_path = format!("/tmp/codex-test-{}.log", timestamp);
    let mut log_writer = LogWriter::new(&log_path);

    // Log tool schemas
    let schemas = get_all_tool_schemas(mcp_enabled);
    log_writer.log(format!("Tool Schemas: {}", schemas));

    // Log MCP status
    if mcp_enabled {
        log_writer.log("MCP tools enabled".to_string());
        SessionInitResult { mcp_enabled, warning: None }
    } else {
        let warning = "MCP config missing: MCP tools disabled".to_string();
        log_writer.log(warning.clone());
        SessionInitResult { mcp_enabled, warning: Some(warning) }
    }
}
