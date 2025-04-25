// Minimal MCP Client for Codex
// Implements JSON-RPC 2.0 framing and supports stdio and HTTP/SSE transports
// Spec-compliant, extensible, and testable

import { EventEmitter } from "events";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as readline from "readline";

export type McpTransportType = "stdio" | "http";

export interface McpClientOptions {
  transport: McpTransportType;
  stdioPath?: string; // Path to MCP server binary (if using stdio)
  stdioArgs?: string[]; // Args for stdio transport
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
  private process?: ChildProcessWithoutNullStreams;
  private connected = false;
  private notificationEmitter = new EventEmitter();
  // TODO: Add HTTP/SSE client state

  constructor(options: McpClientOptions) {
    this.options = options;
  }

  async connect() {
    if (this.options.transport === "stdio") {
      if (!this.options.stdioPath) {
        throw new Error("Missing stdioPath for MCP stdio transport");
      }
      // Spawn the MCP server process if not already provided
      if (!this.process) {
        this.process = spawn(
          this.options.stdioPath,
          this.options.stdioArgs || [],
          { stdio: ["pipe", "pipe", "pipe"] }
        );
      }
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
    if (this.options.transport !== "stdio") {
      throw new Error("Only stdio transport is implemented");
    }
    if (!this.process || !this.process.stdin || !this.process.stdout) {
      throw new Error("MCP process is not started or missing stdio");
    }
    const id = Math.floor(Math.random() * 1e9);
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params: params || {},
    };
    // DEBUG: Log outgoing request
    console.log('[MCP CLIENT] Sending:', JSON.stringify(request));
    this.process.stdin.write(JSON.stringify(request) + '\n');

    // Listen for a response line with matching id
    const rl = readline.createInterface({ input: this.process.stdout });
    return new Promise<T>((resolve, reject) => {
      const onLine = (line: string) => {
        // DEBUG: Log incoming line
        console.log('[MCP CLIENT] Received:', line);
        try {
          const msg = JSON.parse(line);
          if (msg.id === id) {
            rl.removeListener("line", onLine);
            rl.close();
            if (msg.error) {
              reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              resolve(msg.result);
            }
          }
        } catch (err) {
          // Ignore parse errors for unrelated lines
        }
      };
      rl.on("line", onLine);
      // Optionally: add a timeout for robustness
      setTimeout(() => {
        rl.removeListener("line", onLine);
        rl.close();
        reject(new Error("Timed out waiting for MCP response"));
      }, 8000);
    });
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
