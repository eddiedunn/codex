import * as fs from "fs";
import * as path from "path";

const WASM_SRC = path.resolve("node_modules/yoga-wasm-web/dist/yoga.wasm");
const OUT_DIR = path.resolve("dist");
const WASM_DEST = path.join(OUT_DIR, "yoga.wasm");

if (!fs.existsSync(WASM_SRC)) {
  console.error(`ERROR: yoga.wasm not found at ${WASM_SRC}`);
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

fs.copyFileSync(WASM_SRC, WASM_DEST);
console.log(`Copied yoga.wasm to ${WASM_DEST}`);
