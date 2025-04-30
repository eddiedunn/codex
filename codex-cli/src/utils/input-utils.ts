import type { ResponseInputMessageItem } from "openai/resources/responses/responses.mjs";
import { fileTypeFromBuffer } from "file-type";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "node:crypto";

// --- PATCH TYPE FOR OPENAI STYLE ---
type OpenAIInputTextContent = { type: "text"; text: string };
type PatchedResponseInputMessageItem = Omit<ResponseInputMessageItem, "content"> & {
  content: OpenAIInputTextContent[];
};

export async function createInputItem(
  text: string,
  images: Array<string>,
): Promise<PatchedResponseInputMessageItem> {
  const inputItem: PatchedResponseInputMessageItem = {
    id: randomUUID(),
    role: "user",
    content: [{ type: "text", text }],
    type: "message",
  };

  for (const filePath of images) {
    try {
      /* eslint-disable no-await-in-loop */
      const binary = await fs.readFile(filePath);
      const kind = await fileTypeFromBuffer(binary);
      /* eslint-enable no-await-in-loop */
      const encoded = binary.toString("base64");
      const mime = kind?.mime ?? "application/octet-stream";
      // Only push image type if compatible with OpenAI style, else skip or adapt as needed
      inputItem.content.push({
        type: "input_image", // If OpenAI expects just "image", adapt here
        detail: "auto",
        image_url: `data:${mime};base64,${encoded}`,
      } as any);
    } catch (err) {
      inputItem.content.push({
        type: "text",
        text: `[missing image: ${path.basename(filePath)}]`,
      });
    }
  }

  return inputItem;
}
