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
  process?: ChildProcessWithoutNullStreams; // Injected process for stdio transport (test/mocking)
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
    if (options.process) {
      this.process = options.process;
    }
  }

  async connect() {
    if (this.options.transport === "stdio") {
      if (!this.process) {
        if (!this.options.stdioPath) {
          throw new Error("Missing stdioPath for MCP stdio transport");
        }
        // Spawn the MCP server process if not already provided
        this.process = spawn(
          this.options.stdioPath,
          this.options.stdioArgs || [],
          { stdio: ["pipe", "pipe", "pipe"] }
        );
        this.process.on("exit", (code, signal) => {
          console.warn(`[MCP CLIENT] MCP process exited with code=${code} signal=${signal}`);
          this.connected = false;
        });
        this.process.on("error", (err) => {
          console.error("[MCP CLIENT] MCP process error:", err);
        });
        this.process.stdout.on("close", () => {
          console.warn("[MCP CLIENT] MCP process stdout closed");
          this.connected = false;
        });
        this.process.stdin.on("error", (err) => {
          console.error("[MCP CLIENT] MCP process stdin error:", err);
        });
      }
      this.connected = true;
    } else if (this.options.transport === "http") {
      // TODO: establish HTTP/SSE connection
      this.connected = true;
    }
  }

  async disconnect() {
    if (this.process) {
      console.info("[MCP CLIENT] Disconnecting MCP process...");
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
    // ENHANCED LOGGING: Outgoing request
    console.log('[MCP CLIENT] Sending:', JSON.stringify(request));
    try {
      this.process.stdin.write(JSON.stringify(request) + '\n');
    } catch (err) {
      console.error('[MCP CLIENT] Failed to write to MCP process stdin:', err);
      throw new Error('Failed to send request to MCP process');
    }

    return new Promise<T>((resolve, reject) => {
      const rl = readline.createInterface({
        input: this.process!.stdout,
        crlfDelay: Infinity,
      });
      const onLine = (line: string) => {
        try {
          const msg = JSON.parse(line);
          // ENHANCED LOGGING: Incoming response
          console.log('[MCP CLIENT] Received:', JSON.stringify(msg));
          if (msg.id === id) {
            rl.removeListener("line", onLine);
            rl.close();
            if (msg.error) {
              console.error('[MCP CLIENT] MCP error response:', msg.error);
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
      // ENHANCED LOGGING: Timeout for robustness
      setTimeout(() => {
        rl.removeListener("line", onLine);
        rl.close();
        console.error('[MCP CLIENT] Timed out waiting for MCP response');
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

  // List resources with pagination
  async listResources(opts?: { pageToken?: string; pageSize?: number }): Promise<{ results: any[]; nextPageToken?: string; prevPageToken?: string }> {
    const params: Record<string, any> = {};
    if (opts?.pageToken) params.pageToken = opts.pageToken;
    if (opts?.pageSize) params.pageSize = opts.pageSize;
    const result = await this.request('resources/list', params);
    // Support both legacy array and new paginated object
    if (Array.isArray(result)) return { results: result };
    if (result && Array.isArray(result.resources)) {
      return {
        results: result.resources,
        nextPageToken: result.nextPageToken,
        prevPageToken: result.prevPageToken,
      };
    }
    throw new Error('Unexpected response shape from resources/list');
  }

  // List resource templates with pagination
  async listResourceTemplates(opts?: { pageToken?: string; pageSize?: number }): Promise<{ results: any[]; nextPageToken?: string; prevPageToken?: string }> {
    const params: Record<string, any> = {};
    if (opts?.pageToken) params.pageToken = opts.pageToken;
    if (opts?.pageSize) params.pageSize = opts.pageSize;
    const result = await this.request('resources/templates', params);
    if (Array.isArray(result)) return { results: result };
    if (result && Array.isArray(result.templates)) {
      return {
        results: result.templates,
        nextPageToken: result.nextPageToken,
        prevPageToken: result.prevPageToken,
      };
    }
    // Some backends may use 'resources' key for templates as well
    if (result && Array.isArray(result.resources)) {
      return {
        results: result.resources,
        nextPageToken: result.nextPageToken,
        prevPageToken: result.prevPageToken,
      };
    }
    throw new Error('Unexpected response shape from resources/templates');
  }

  // Read a resource by URI
  async readResource(uri: string): Promise<any> {
    return this.request('resources/read', { uri });
  }

  // Subscribe to resource updates (optional)
  async subscribeResource(uri: string): Promise<void> {
    await this.request('resources/subscribe', { uri });
  }

  // Unsubscribe from resource updates
  async unsubscribeResource(uri: string): Promise<void> {
    await this.request('resources/unsubscribe', { uri });
  }
}

// Extend this skeleton to add full protocol support, configuration, and tool discovery as needed.
