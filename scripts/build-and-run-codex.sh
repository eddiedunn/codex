#!/bin/bash
# Build the codex CLI and run it with DEBUG=1

set -e

# Clean build output (optional, uncomment if needed)
# rm -rf dist .next build

# Build step (adjust if your build command is different)
echo "[build-and-run-codex] Running: npm run build"
npm run build

# Run the CLI with DEBUG=1 and pass all arguments
DEBUG=1 npx codex "$@"
