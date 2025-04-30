# ESM + TypeScript Interop in Codex

## Overview
The Codex project is fully standardized on ESM (ECMAScript Modules) for both source and build output. All code uses `import`/`export` syntax and explicit `.js` extensions for local file imports, per modern Node.js and Vite best practices. TypeScript is used for static type-checking and emits ESM code.

## ESM Import Pattern
- **All local imports use explicit `.js` extensions** (e.g., `import { foo } from './bar.js'`).
- **No CommonJS (`require`, `exports`) is allowed**.
- `package.json` includes `"type": "module"` in all packages.
- TypeScript configs use `"module": "ESNext"` and output ESM.

## TypeScript Limitations (as of April 2025)
TypeScript currently does **not** resolve type-only imports from `.js` extensions in ESM projects, even if the actual source file is `.ts`. This causes errors like:

```
TS2307: Cannot find module '../utils/responses.js' or its corresponding type declarations.
```

### What This Means
- **These errors are expected** and will persist until TypeScript natively supports ESM+explicit extension workflows.
- The runtime and build output will work correctly; only type-checking is affected.

## Workarounds Used in Codex
- A `.d.ts` shim (e.g., `responses.js.d.ts`) is used to help TypeScript resolve some imports, but this does not fully resolve all TS2307 errors.
- The project uses a dedicated `tsconfig.typecheck.json` for type-checking.
- Contributors should be aware of these limitations and not attempt to "fix" imports by removing `.js` extensions (this will break runtime ESM).

## Contributor Guidance
- **Use `.js` in all local imports** in `.ts`/`.tsx` files.
- **Ignore TS2307 errors** for local `.js` imports; monitor TypeScript releases for improvements.
- If you need to add new modules, follow the same import/export conventions.
- Document any new workarounds or patterns in this file.

## References
- [TypeScript ESM Docs](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [Node.js ESM Docs](https://nodejs.org/api/esm.html)

_Last updated: 2025-04-29_
