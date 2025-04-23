// scripts/copy-mock-mcp-client.js
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../src/utils/agent/mock-mcp-client.js');
const dest = path.join(__dirname, '../dist/src/utils/agent/mock-mcp-client.js');

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log(`[copy-mock-mcp-client] Copied ${src} -> ${dest}`);
