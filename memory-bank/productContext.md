# Product Context

This CLI agent aims to provide a flexible, extensible automation platform for developers and power users. By integrating the MCP ecosystem, the agent will be able to access a wide range of external tools and data sources, expanding its capabilities and usefulness.

## Problems Solved

- Unified interface for tool invocation
- Easy extension to new tool protocols (like MCP)

## User Experience Goals

- Seamless discovery and usage of MCP tools
- Clear documentation and onboarding for new integrations

---

## MVP Product Context: REPL-First Tool Call (April 2025)

- The product's core goal is robust, REPL-first tool calling: all user actions, resource listings, and commands must be invoked via chat prompt, not traditional CLI commands.
- The system must always gracefully handle missing MCP config, disabling MCP tools but never crashing.
- Tool schemas for all available providers/tools must be sent to the LLM at session start, ensuring full discoverability for the model.
- The canonical session start prompt for contributors: "You are starting a new Codex REPL session. Your goal is to reach MVP for robust tool calling in the chat interface. All tool calls and business logic must work via the REPL, with graceful fallback for missing MCP config and full tool schema exposure to the LLM. Do not lose context from previous sessions; refer to the memory bank for all patterns and requirements."
- MVP is achieved when all tool calls, resource listings, and business logic are reliably accessible and testable in the REPL/chat interface.
- Next: Keep productContext.md and memory bank in sync as MVP approaches.
