# WASM Build Requirements for Ink/Yoga Integration

This project uses [Ink](https://github.com/vadimdemedes/ink), which depends on [yoga-wasm-web](https://github.com/shuding/yoga-wasm-web) for terminal Flexbox layout. Ink requires a `yoga.wasm` binary to be present at runtime.

## Why This Matters

- The npm package for `yoga-wasm-web` does **not** ship with a prebuilt `yoga.wasm` binary.
- The WASM file must be built from source using [Emscripten](https://emscripten.org/) and `make`.
- This is required for running the CLI, as well as for passing all end-to-end/integration tests.

## Local Development Setup

**You must have Emscripten and Make installed.**

### 1. Install Emscripten

- Follow the official guide: https://emscripten.org/docs/getting_started/downloads.html
- TL;DR (on macOS):
  ```sh
  brew install emscripten
  # or follow the Emscripten SDK instructions for Linux/Windows
  ```

### 2. Build yoga.wasm

- From the project root:
  ```sh
  cd node_modules/yoga-wasm-web
  npm install # (if not already done)
  npm run build
  # This runs `make` and generates dist/yoga.wasm
  ```
- You can now run the CLI and integration tests.

## CI/CD Setup

- Ensure your CI pipeline installs Emscripten and Make before running the build.
- The build scripts will automatically generate and copy `yoga.wasm` as needed.

## Troubleshooting

- If you see errors about missing `yoga.wasm`, ensure Emscripten and Make are installed, and run the build steps above.
- If you cannot build the WASM file, check the yoga-wasm-web repo for updates or open an issue.

---

**This doc is standalone and does not modify existing documentation.**
