// Proxy to allow ESM code to import the MCP SDK CJS client entrypoint
// Usage: import { Client } from './mcp-sdk-cjs-proxy.cjs';
const path = require('path');
const pkgJson = require.resolve('@modelcontextprotocol/sdk/package.json');
const sdkRoot = path.dirname(pkgJson);
let sdkEntry;
if (sdkRoot.endsWith('dist/cjs')) {
  sdkEntry = path.join(sdkRoot, 'client/index.js');
} else {
  sdkEntry = path.join(sdkRoot, 'dist/cjs/client/index.js');
}
module.exports = require(sdkEntry);
