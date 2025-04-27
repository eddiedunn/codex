# MCP MVP Implementation Plan

_Last updated: 2025-04-26_

## **MVP Definition (Clarified)**

Codex must fully support the MCP protocol as specified, with no separate CLI agent or UI-specific logic. The LLM (model) is the orchestrator: it decides when to invoke a tool, but can only do so if all MCP tools are correctly discovered and exposed in the tool list/context.

### **MVP Requirements**

- **Tool Discovery:**
  - On startup or session start, Codex queries all configured MCP servers for their available tools using the MCP protocol.
  - All MCP tools are merged into the tool registry/context that is provided to the LLM.
- **Tool Invocation:**
  - When the LLM chooses to invoke a tool, Codex routes the invocation to the correct MCP server, using the MCP protocol.
  - Results (or errors) are faithfully returned to the LLM/user, following the MCP spec.
- **No agentic CLI, no UI-specific hacks, no orchestration outside the agent loop.**
- **All flows, errors, and resource interactions must be protocol-compliant.**

### **Out of Scope (for MVP)**

- CLI agent, CLI-only flows, or any orchestration outside the main agent loop.
- UI-specific or chat-specific hacks—MCP integration must be protocol-driven and LLM-centric.
- Multi-server aggregation, dynamic server management, or advanced resource flows (unless required by the MCP spec for tool discovery/invocation).

---

## **Action Steps**

1. **Remove all references to CLI agent/CLI-specific flows from code and docs.**
2. **Ensure MCP tool discovery is merged into the LLM tool list/context.**
3. **Ensure tool invocation is routed to the correct MCP server and result returned per MCP spec.**
4. **Update tests and documentation to reflect this clarified, protocol-centric MVP.**
5. **(Optional) Audit code for protocol compliance and LLM-driven flows.**

---

## **MCP Protocol Roadmap (2025-04-27)**

## Immediate Focus
- Tool Invocation (`tools/call`)
  - Implement type-safe `callTool` method in MCP client.
  - Ensure protocol-compliant error handling (in-band vs protocol-level errors).
  - Canonical Vitest tests with mock server for all tool call scenarios (success, tool error, protocol error).
  - Logging and diagnostics per windsurf rules.

## Full Protocol Coverage (Planned)
- [x] Tool invocation (`tools/call`)
- [ ] Resource listing/CRUD endpoints
- [ ] Template listing endpoints
- [ ] Subscriptions/notifications
- [ ] Streaming/content types (audio, blob, etc.)
- [ ] Error/edge-case handling
- [ ] Versioning/metadata endpoints
- [ ] Test coverage for all above (using canonical mock server)
- [ ] Documentation and memory bank updates for all new protocol features

## Next Steps
- Complete tool invocation implementation and tests.
- Sequentially implement and test each protocol area above.
- Update the memory bank and docs after each milestone.

---

## **Full Spec Roadmap (Post-MVP)**

- Multi-server support, dynamic server management, advanced resource flows, and additional endpoints can be added after the MVP is complete and protocol compliance is verified.

---

## **Open Questions / Risks**

- Confirm which transport(s) (stdio, HTTP) must be supported for MVP.
- Ongoing: MCP protocol may evolve; keep memory bank and codebase in sync with spec.

---

## **Next Steps**

- [ ] Save this plan in the memory bank (`mcp-implementation-plan.md`).
- [ ] Begin with removing CLI agent/CLI-specific flows and ensuring MCP tool discovery and invocation are protocol-compliant.
- [ ] Review and update after each major milestone.
