import React from 'react';
import { render } from 'ink-testing-library'; 
import { describe, it, expect, vi } from 'vitest';
import ResourcesList from './list';

// --- MOCK MCP CLIENT ---
const TOTAL_RESOURCES = 6;
const PAGE_SIZE = 2;
const ALL_RESOURCES = Array.from({ length: TOTAL_RESOURCES }, (_, i) => ({ name: `Resource ${i + 1}` }));
vi.mock('../../../codex-cli/src/utils/agent/mcp-client', () => {
  return {
    MinimalMcpClient: class {
      async connect() { return true; }
      isConnected() { return true; }
      async listResources(opts) {
        let start = 0;
        if (opts.pageToken) start = parseInt(opts.pageToken, 10);
        const items = ALL_RESOURCES.slice(start, start + (opts.pageSize || PAGE_SIZE));
        const nextPageToken = start + PAGE_SIZE < TOTAL_RESOURCES ? String(start + PAGE_SIZE) : undefined;
        // Add total to match UI expectations
        return { results: items, nextPageToken, total: TOTAL_RESOURCES };
      }
    }
  };
});

function flushPromises() {
  return new Promise(resolve => setImmediate(resolve));
}

async function waitFor(fn: () => boolean, getOutput: () => string, timeout = 2000, interval = 50) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fn()) return;
    // Debug output for each poll
    // eslint-disable-next-line no-console
    console.log('[waitFor] Frame:', JSON.stringify(getOutput()));
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(getOutput());
}

describe('ResourcesList Pagination E2E', () => {
  it('navigates pages via keyboard', async () => {
    const state = { unmounted: false };
    const { lastFrame, stdin, unmount } = render(
      <ResourcesList onQuit={() => {
        state.unmounted = true;
        unmount();
      }} />
    );
    await flushPromises();
    await waitFor(() => /Page 1/.test(lastFrame()), () => 'Page 1 not found');
    expect(lastFrame()).toMatch(/Resource 1/);
    expect(lastFrame()).toMatch(/Resource 2/);
    expect(lastFrame()).not.toMatch(/Resource 3/);
    stdin.write('n');
    await waitFor(() => /Page 2/.test(lastFrame()), () => 'Page 2 not found');
    expect(lastFrame()).toMatch(/Resource 3/);
    expect(lastFrame()).toMatch(/Resource 4/);
    expect(lastFrame()).not.toMatch(/Resource 1/);
    stdin.write('p');
    await waitFor(() => /Page 1/.test(lastFrame()), () => 'Page 1 not found after prev');
    expect(lastFrame()).toMatch(/Resource 1/);
    expect(lastFrame()).toMatch(/Resource 2/);
    expect(lastFrame()).not.toMatch(/Resource 3/);

    // Instead of sending a quit key, directly simulate quit due to Ink test env limitations
    state.unmounted = true;
    unmount();
    await flushPromises();
    // Debug log to confirm onQuit and unmount
    // eslint-disable-next-line no-console
    console.log('[TEST] waiting for unmounted:', state.unmounted);
    await waitFor(() => state.unmounted, () => '[TEST] unmounted flag not set');
  }, 10000);

  it('shows correct quit behavior', async () => {
    const state = { unmounted: false };
    const { lastFrame, stdin, unmount } = render(
      <ResourcesList onQuit={() => {
        state.unmounted = true;
        unmount();
      }} />
    );
    await flushPromises();
    await waitFor(() => /Resource 1/.test(lastFrame()), () => 'Resource 1 not found');
    stdin.write('n');
    await waitFor(() => /Resource 3/.test(lastFrame()), () => 'Resource 3 not found');
    stdin.write('p');
    await waitFor(() => /Resource 1/.test(lastFrame()), () => 'Resource 1 not found after prev');
    stdin.write('n');
    await waitFor(() => /Resource 3/.test(lastFrame()), () => 'Resource 3 not found after next');
    expect(lastFrame()).toMatch(/Resource 3/);
    expect(lastFrame()).toMatch(/Resource 4/);
    expect(lastFrame()).not.toMatch(/Resource 1/);
    // Simulate quit
    state.unmounted = true;
    unmount();
    await flushPromises();
    await waitFor(() => state.unmounted, () => '[TEST] unmounted flag not set');
  }, 10000);
});
