const CHUNK_WORDS = 180;
const OVERLAP_WORDS = 30;

/** Split page text into overlapping word-count chunks for retrieval. */
export function chunkText(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= CHUNK_WORDS) return [words.join(" ")];

  const chunks = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + CHUNK_WORDS, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end === words.length) break;
    start = end - OVERLAP_WORDS;
  }
  return chunks;
}
