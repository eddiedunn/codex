import * as fs from "fs";
import * as path from "path";

const WASM_SRC = path.resolve("node_modules/yoga-wasm-web/dist/yoga.wasm");
const WASM_DEST = path.resolve("node_modules/yoga-wasm-web/dist/yoga.wasm");

if (fs.existsSync(WASM_DEST)) {
  console.log("yoga.wasm already exists at destination, skipping copy.");
  process.exit(0);
}

if (!fs.existsSync(WASM_SRC)) {
  console.error("yoga.wasm not found in node_modules/yoga-wasm-web/dist. Please install yoga-wasm-web first.");
  process.exit(1);
}

// Copy the .wasm file from node_modules to the destination
fs.copyFileSync(WASM_SRC, WASM_DEST);
console.log(`Copied yoga.wasm to ${WASM_DEST}`);
