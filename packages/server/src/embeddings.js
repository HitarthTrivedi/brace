// Local, free, unlimited embeddings — no external API call, so indexing a site
// never touches an LLM provider's rate limit. Model weights download once and
// are cached under packages/server/.cache on first run.
import { pipeline, env } from "@huggingface/transformers";

env.cacheDir = new URL("../.cache/", import.meta.url).pathname;

let extractorPromise;
function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractorPromise;
}

export async function embed(text) {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

export async function embedBatch(texts, onProgress) {
  const vectors = [];
  for (let i = 0; i < texts.length; i++) {
    vectors.push(await embed(texts[i]));
    if (onProgress) onProgress(i + 1, texts.length);
  }
  return vectors;
}

export function cosineSimilarity(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // vectors are already normalized, so dot product == cosine similarity
}
