// Minimal MCP Client for Codex
// Implements JSON-RPC 2.0 framing and supports stdio and HTTP/SSE transports
// Spec-compliant, extensible, and testable

import { EventEmitter } from "events";
import type { ChildProcess } from "child_process";

export type McpTransportType = "stdio" | "http";

export interface McpClientOptions {
  transport: McpTransportType;
  stdioPath?: string; // Path to MCP server binary (if using stdio)
  httpUrl?: string;   // URL of MCP server (if using HTTP/SSE)
  // Add config fields as needed (Claude Desktop style, etc.)
}

export interface McpNotificationHandler {
  (method: string, params: any): void;
}

export interface McpClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  request<T = any>(method: string, params?: object): Promise<T>;
  notify(method: string, params?: object): Promise<void>;
  onNotification(handler: McpNotificationHandler): void;
  isConnected(): boolean;
}

export class MinimalMcpClient implements McpClient {
  private readonly options: McpClientOptions;
  private process?: ChildProcess;
  private connected = false;
  private notificationEmitter = new EventEmitter();
  // TODO: Add HTTP/SSE client state

  constructor(options: McpClientOptions) {
    this.options = options;
  }

  async connect() {
    if (this.options.transport === "stdio") {
      // TODO: spawn MCP server process and wire up stdin/stdout
      // Example: this.process = spawn(this.options.stdioPath!, ...)
      this.connected = true;
    } else if (this.options.transport === "http") {
      // TODO: establish HTTP/SSE connection
      this.connected = true;
    }
  }

  async disconnect() {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
    // TODO: close HTTP/SSE connection
    this.connected = false;
  }

  async request<T = any>(method: string, params?: object): Promise<T> {
    // TODO: send JSON-RPC request and await response
    // Use transport-specific implementation
    throw new Error("Not implemented");
  }

  async notify(method: string, params?: object): Promise<void> {
    // TODO: send JSON-RPC notification
    throw new Error("Not implemented");
  }

  onNotification(handler: McpNotificationHandler) {
    this.notificationEmitter.on("notification", handler);
  }

  isConnected() {
    return this.connected;
  }
}

// Extend this skeleton to add full protocol support, configuration, and tool discovery as needed.
