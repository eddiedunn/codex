import * as fs from "fs";
import * as path from "path";
import https from "https";

const WASM_DEST = path.resolve("node_modules/yoga-wasm-web/dist/yoga.wasm");
const WASM_DIR = path.dirname(WASM_DEST);
const WASM_URL = "https://github.com/shuding/yoga-wasm-web/releases/download/v0.3.3/yoga.wasm";

if (fs.existsSync(WASM_DEST)) {
  console.log("yoga.wasm already exists, skipping download.");
  process.exit(0);
}

if (!fs.existsSync(WASM_DIR)) {
  fs.mkdirSync(WASM_DIR, { recursive: true });
}

console.log(`Downloading yoga.wasm from ${WASM_URL} ...`);
const file = fs.createWriteStream(WASM_DEST);
https.get(WASM_URL, (response) => {
  if (response.statusCode !== 200) {
    console.error(`Failed to download yoga.wasm: ${response.statusCode}`);
    process.exit(1);
  }
  response.pipe(file);
  file.on("finish", () => {
    file.close();
    console.log(`Downloaded yoga.wasm to ${WASM_DEST}`);
  });
}).on("error", (err) => {
  fs.unlinkSync(WASM_DEST);
  console.error("Error downloading yoga.wasm:", err);
  process.exit(1);
});
