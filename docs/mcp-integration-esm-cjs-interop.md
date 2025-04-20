# MCP SDK ESM/CJS Interop Workaround

## Context

The MCP SDK (`@modelcontextprotocol/sdk`) currently only provides a CommonJS (CJS) entrypoint and does not define proper `"exports"` in its `package.json`. This prevents ESM-based consumers (like Codex CLI) from importing the SDK client entrypoint directly, resulting in errors such as:

```
Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: No "exports" main defined in .../node_modules/@modelcontextprotocol/sdk/package.json
```

This is a well-known Node.js ESM/CJS interop issue. See [Node.js documentation on "exports"](https://nodejs.org/api/packages.html#exports) and [Node.js issue #43274](https://github.com/nodejs/node/issues/43274).

## Workaround: Local CJS Proxy

A local CJS proxy module is provided to bridge the gap until the SDK is updated upstream:

```js
// codex-cli/src/utils/agent/mcp-sdk-cjs-proxy.cjs
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
```

## Usage in ESM/TypeScript

```js
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('./mcp-sdk-cjs-proxy.cjs');
```

## Upstream Solution (for MCP SDK maintainers)

Add the following to the SDK's `package.json`:

```json
"exports": {
  ".": "./dist/cjs/client/index.js",
  "./client": "./dist/cjs/client/index.js"
}
```

This will allow ESM/CJS consumers to import the SDK client entrypoint directly.

---

*This document is a placeholder for the MCP integration PR and will be updated as the upstream situation evolves.*
