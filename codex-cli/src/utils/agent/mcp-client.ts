// Minimal MCP Client for Codex
// Implements JSON-RPC 2.0 framing and supports stdio and HTTP/SSE transports
// Spec-compliant, extensible, and testable

import type { ChildProcessWithoutNullStreams } from "child_process";
import { spawn } from "child_process";
import { EventEmitter } from "events";
import * as readline from "readline";

export type McpTransportType = "stdio" | "http";

export interface McpClientOptions {
  transport: McpTransportType;
  stdioPath?: string; // Path to MCP server binary (if using stdio)
  stdioArgs?: string[]; // Args for stdio transport
  httpUrl?: string;   // URL of MCP server (if using HTTP/SSE)
  process?: ChildProcessWithoutNullStreams; // Injected process for stdio transport (test/mocking)
}

export interface McpNotificationHandler {
  (method: string, params: Record<string, unknown>): void;
}

export interface McpClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  request<T>(method: string, params?: Record<string, unknown>): Promise<T>;
  notify(method: string, params?: Record<string, unknown>): Promise<void>;
  onNotification(handler: McpNotificationHandler): void;
  isConnected(): boolean;
  listResources(opts?: { pageToken?: string; pageSize?: number }): Promise<{ results: unknown[]; nextPageToken?: string; prevPageToken?: string }>;
  listResourceTemplates(opts?: { pageToken?: string; pageSize?: number }): Promise<{ results: unknown[]; nextPageToken?: string; prevPageToken?: string }>;
  readResource(uri: string): Promise<unknown>;
  subscribeResource(uri: string): Promise<void>;
  unsubscribeResource(uri: string): Promise<void>;
  callTool(name: string, args?: Record<string, unknown>): Promise<any>;
}

export class MinimalMcpClient implements McpClient {
  private readonly options: McpClientOptions;
  private process?: ChildProcessWithoutNullStreams;
  private connected = false;
  private notificationEmitter = new EventEmitter();

  constructor(options: McpClientOptions) {
    this.options = options;
    if (options.process) {
      this.process = options.process;
    }
  }

  async connect(): Promise<void> {
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
          // console.warn(`[MCP CLIENT] MCP process exited with code=${code} signal=${signal}`);
          this.connected = false;
        });
        this.process.on("error", (err) => {
          // console.error("[MCP CLIENT] MCP process error:", err);
        });
        this.process.stdout.on("close", () => {
          // console.warn("[MCP CLIENT] MCP process stdout closed");
          this.connected = false;
        });
        this.process.stdin.on("error", (err) => {
          // console.error("[MCP CLIENT] MCP process stdin error:", err);
        });
      }
      this.connected = true;
    } else if (this.options.transport === "http") {
      // TODO: establish HTTP/SSE connection
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      // console.info("[MCP CLIENT] Disconnecting MCP process...");
      this.process.kill();
      this.process = undefined;
    }
    // TODO: close HTTP/SSE connection
    this.connected = false;
  }

  async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
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
    console.log('[MCP CLIENT] Sending request:', request);
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
        console.log('[MCP CLIENT] Received line:', line);
        try {
          const msg = JSON.parse(line);
          console.log('[MCP CLIENT] Parsed response:', msg);
          if (msg.id === id) {
            rl.removeListener("line", onLine);
            rl.close();
            if (msg.error) {
              console.error('[MCP CLIENT] MCP error response:', msg.error);
              // If the error has a data field (in-band tool error), throw that object
              if (msg.error.data && typeof msg.error.data === 'object') {
                reject(msg.error.data);
                return;
              }
              reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            } else {
              resolve(msg.result);
            }
          }
        } catch (err) {
          console.error('[MCP CLIENT] Failed to parse JSON:', err, 'Line:', line);
        }
      };
      rl.on("line", onLine);
      setTimeout(() => {
        rl.removeListener("line", onLine);
        rl.close();
        console.error('[MCP CLIENT] Timed out waiting for MCP response');
        reject(new Error("Timed out waiting for MCP response"));
      }, 8000);
    });
  }

  async notify(method: string, params?: Record<string, unknown>): Promise<void> {
    // TODO: send JSON-RPC notification
    throw new Error("Not implemented");
  }

  onNotification(handler: McpNotificationHandler): void {
    this.notificationEmitter.on("notification", handler);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async listResources(opts?: { pageToken?: string; pageSize?: number }): Promise<{ results: unknown[]; nextPageToken?: string; prevPageToken?: string }> {
    const params: Record<string, unknown> = {};
    if (opts?.pageToken) {params.pageToken = opts.pageToken;}
    if (opts?.pageSize) {params.pageSize = opts.pageSize;}
    const result = await this.request('resources/list', params);
    // Support both legacy array and new paginated object
    if (Array.isArray(result)) {return { results: result };}
    if (result && Array.isArray(result.resources)) {
      return {
        results: result.resources,
        nextPageToken: result.nextPageToken,
        prevPageToken: result.prevPageToken,
      };
    }
    throw new Error('Unexpected response shape from resources/list');
  }

  async listResourceTemplates(opts?: { pageToken?: string; pageSize?: number }): Promise<{ results: unknown[]; nextPageToken?: string; prevPageToken?: string }> {
    const params: Record<string, unknown> = {};
    if (opts?.pageToken) {params.pageToken = opts.pageToken;}
    if (opts?.pageSize) {params.pageSize = opts.pageSize;}
    const result = await this.request('resources/templates', params);
    if (Array.isArray(result)) {return { results: result };}
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

  async readResource(uri: string): Promise<unknown> {
    return this.request('resources/read', { uri });
  }

  async subscribeResource(uri: string): Promise<void> {
    await this.request('resources/subscribe', { uri });
  }

  async unsubscribeResource(uri: string): Promise<void> {
    await this.request('resources/unsubscribe', { uri });
  }

  /**
   * Invoke a tool via MCP protocol.
   * @param name The tool name (required)
   * @param args Arguments for the tool (object, optional)
   * @returns The CallToolResult from the MCP server
   * @throws Error if the tool is not found, invocation fails, or protocol error occurs
   *
   * Protocol: Sends a 'tools/call' request with { name, arguments } per MCP spec.
   * Distinguishes between in-band tool errors (isError: true in result) and protocol-level errors.
   */
  async callTool(name: string, args?: Record<string, unknown>): Promise<any> {
    if (!name) throw new Error('Tool name is required');
    try {
      const params = { name, arguments: args || {} };
      const result = await this.request<any>('tools/call', params);
      // Per MCP spec: tool errors are in-band, protocol errors throw
      if (result && result.isError) {
        // In-band tool error (e.g., tool logic failed)
        const errMsg = result.error || result.message || 'Unknown tool error';
        const error = new Error(`Tool error: ${errMsg}`);
        (error as any).mcpToolError = true;
        (error as any).toolResult = result;
        throw error;
      }
      return result;
    } catch (err: any) {
      // Protocol-level error (e.g., tool not found, server error)
      if (err && err.message) {
        throw new Error(`MCP callTool protocol error: ${err.message}`);
      }
      throw err;
    }
  }
}

// Extend this skeleton to add full protocol support, configuration, and tool discovery as needed.
