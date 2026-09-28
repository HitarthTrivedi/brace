import "dotenv/config";
import { crawlSite } from "./crawler.js";
import { chunkText } from "./chunk.js";
import { embedBatch } from "./embeddings.js";
import { saveIndex } from "./vectorStore.js";

const arg = process.argv.find((a) => a.startsWith("--base-url="));
const baseUrl = arg ? arg.split("=")[1] : process.env.SITE_BASE_URL;

if (!baseUrl) {
  console.error("Usage: npm run crawl -- --base-url=https://your-site.com");
  process.exit(1);
}

console.log(`Crawling ${baseUrl} ...`);
const pages = await crawlSite(baseUrl);
console.log(`Found ${pages.length} pages. Chunking + embedding locally (first run downloads a small model, ~90MB, then cached)...`);

// Chunk per section (not per page) so each chunk keeps the heading + anchor it
// came from — that's what lets the widget take a visitor to the exact spot.
const pieces = (page) =>
  (page.sections && page.sections.length ? page.sections : [{ heading: null, anchor: null, text: page.text }])
    .flatMap((s) => chunkText(s.text).map((chunk) => ({ chunk, heading: s.heading, anchor: s.anchor })));

const records = [];
let done = 0;
const total = pages.reduce((sum, p) => sum + pieces(p).length, 0);

for (const page of pages) {
  const parts = pieces(page);
  const vectors = await embedBatch(parts.map((p) => p.chunk), (i) => {
    done++;
    process.stdout.write(`\rEmbedded ${done}/${total} chunks`);
  });
  parts.forEach((p, i) => {
    records.push({
      id: `${page.url}#${i}`,
      url: page.url,
      title: page.title,
      heading: p.heading,
      anchor: p.anchor,
      chunk: p.chunk,
      embedding: vectors[i],
    });
  });
}

await saveIndex(records);
console.log(`\nIndex written: data/index.json (${records.length} chunks from ${pages.length} pages)`);
