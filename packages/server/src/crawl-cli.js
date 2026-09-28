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

const records = [];
let done = 0;
const total = pages.reduce((sum, p) => sum + chunkText(p.text).length, 0);

for (const page of pages) {
  const chunks = chunkText(page.text);
  const vectors = await embedBatch(chunks, (i) => {
    done++;
    process.stdout.write(`\rEmbedded ${done}/${total} chunks`);
  });
  chunks.forEach((chunk, i) => {
    records.push({
      id: `${page.url}#${i}`,
      url: page.url,
      title: page.title,
      chunk,
      embedding: vectors[i],
    });
  });
}

await saveIndex(records);
console.log(`\nIndex written: data/index.json (${records.length} chunks from ${pages.length} pages)`);
