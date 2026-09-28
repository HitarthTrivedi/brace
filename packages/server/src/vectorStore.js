import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cosineSimilarity } from "./embeddings.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.join(__dirname, "..", "data", "index.json");

/**
 * Flat-file vector store. Fine for sites up to a few thousand chunks — a
 * brute-force cosine scan over that many small vectors takes well under
 * 100ms in Node, which is fast enough for a chat reply and avoids requiring
 * a separate database service for install.
 */
export async function saveIndex(records) {
  await mkdir(path.dirname(INDEX_PATH), { recursive: true });
  await writeFile(INDEX_PATH, JSON.stringify(records));
}

export async function loadIndex() {
  if (!existsSync(INDEX_PATH)) return [];
  const raw = await readFile(INDEX_PATH, "utf-8");
  return JSON.parse(raw);
}

export async function topK(queryVector, k = 5) {
  const records = await loadIndex();
  return records
    .map((r) => ({ ...r, score: cosineSimilarity(queryVector, r.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
