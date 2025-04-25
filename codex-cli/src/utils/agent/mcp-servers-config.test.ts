import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('MCP servers config', () => {
  const configPath = path.join(os.homedir(), '.codex', 'mcp_servers.json');

  it('should exist and be readable', () => {
    expect(fs.existsSync(configPath)).toBe(true);
    const raw = fs.readFileSync(configPath, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('should contain a brave server with API key', () => {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    expect(config.mcpServers).toHaveProperty('brave');
    const brave = config.mcpServers.brave;
    expect(brave).toHaveProperty('command');
    expect(brave).toHaveProperty('args');
    expect(brave.env).toHaveProperty('BRAVE_API_KEY');
    expect(typeof brave.env.BRAVE_API_KEY).toBe('string');
    expect(brave.env.BRAVE_API_KEY.length).toBeGreaterThan(0);
  });

  it('should not contain obvious placeholder API keys', () => {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    const brave = config.mcpServers.brave;
    expect(brave.env.BRAVE_API_KEY).not.toMatch(/<.*>/);
  });
});
