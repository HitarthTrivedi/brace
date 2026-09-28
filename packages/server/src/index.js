import "dotenv/config";
import express from "express";
import cors from "cors";
import { embed } from "./embeddings.js";
import { topK } from "./vectorStore.js";
import { chatCompletion } from "./llm.js";

const app = express();
app.use(cors());
app.use(express.json());

const SYSTEM_PROMPT = `You are Brace, a friendly website assistant. Answer the visitor's question
using ONLY the site excerpts provided below. If the excerpts don't contain the answer, say you're
not sure and suggest what part of the site they might check instead — never make up information
that isn't in the excerpts. Keep answers short (2-4 sentences) and conversational.`;

/** First ~10 words of a chunk's body (after its heading) — enough to find it on the page. */
function snippetOf(chunk, heading) {
  if (!chunk) return null;
  let body = chunk;
  if (heading && body.startsWith(heading)) body = body.slice(heading.length);
  const words = body.trim().split(/\s+/).filter(Boolean).slice(0, 10);
  return words.length >= 3 ? words.join(" ") : null;
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    const queryVector = await embed(message);
    const matches = await topK(queryVector, 5);

    if (matches.length === 0) {
      return res.json({
        answer: "I don't have an index of this site yet — the developer needs to run the crawler first (see AGENTS.md, step 5).",
        sources: [],
      });
    }

    const context = matches
      .map((m, i) => `[${i + 1}] (${m.title} — ${m.url})\n${m.chunk}`)
      .join("\n\n");

    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\nSite excerpts:\n${context}` },
      ...history.slice(-6),
      { role: "user", content: message },
    ];

    const answer = await chatCompletion(messages);

    const seen = new Set();
    const sources = matches
      .filter((m) => (seen.has(m.url) ? false : seen.add(m.url)))
      .slice(0, 3)
      .map((m) => ({
        url: m.url,
        title: m.title,
        // where on the page: the widget scrolls to the anchor, else finds the heading,
        // else searches for the snippet. All null for an index built before sections.
        heading: m.heading || null,
        anchor: m.anchor || null,
        snippet: snippetOf(m.chunk, m.heading),
      }));

    res.json({ answer, sources });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong answering that question." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Brace server listening on http://localhost:${port}`);
});
