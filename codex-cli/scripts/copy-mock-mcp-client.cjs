// scripts/copy-mock-mcp-client.cjs
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/utils/agent/mock-mcp-client.js');
const dest1 = path.join(__dirname, '../dist/utils/agent/mock-mcp-client.js');
const dest2 = path.join(__dirname, '../../dist/utils/agent/mock-mcp-client.js'); // monorepo root-level dist

fs.mkdirSync(path.dirname(dest1), { recursive: true });
fs.copyFileSync(src, dest1);
console.log(`[copy-mock-mcp-client] Copied ${src} -> ${dest1}`);

fs.mkdirSync(path.dirname(dest2), { recursive: true });
fs.copyFileSync(src, dest2);
console.log(`[copy-mock-mcp-client] Copied ${src} -> ${dest2}`);
