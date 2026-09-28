# Brace

A small chat mascot that lives on your website and can answer visitor questions using the
**whole site**, not just the page they're on — and can navigate them straight to the right page.

Open source, self-hosted, and designed to be installed by a coding agent instead of copy-paste:
clone this repo, point Claude Code (or any agent that reads `AGENTS.md`) at your project, and
say *"integrate Brace into my site."* It reads [`AGENTS.md`](./AGENTS.md), detects your stack and
brand colors, wires the widget in, sets up the backend, and indexes your site.

## What's here

- **`packages/widget/`** — the floating chat bubble. Dependency-free Web Component, Shadow DOM,
  works on any stack with one `<script>` tag.
- **`packages/server/`** — self-hosted backend: crawls your site, indexes it **locally for free**
  (no vector DB, no external embeddings cost — see `src/embeddings.js`), and answers questions via
  a free LLM API (Groq by default; Gemini, OpenAI, or a local Ollama model also work —
  see [`docs/GET_API_KEY.md`](./docs/GET_API_KEY.md)).
- **`AGENTS.md`** — the install playbook, written for a coding agent to follow, not a human to
  paste commands from. Also readable by any agent that supports the AGENTS.md standard.
- **`demo/index.html`** — a bare page to preview the widget against a locally running server.

## Quickstart (manual, for trying it yourself)

```bash
cd packages/server
npm install
cp .env.example .env        # then add an LLM_API_KEY — see docs/GET_API_KEY.md
npm run crawl -- --base-url=https://your-site.com
npm start                   # serves the chat API on http://localhost:4000
```

Then open `demo/index.html` in a browser to see the widget talk to your local server.

## Quickstart (the intended way)

Clone this repo into your project (or point your coding agent at both repos) and say:

> "Integrate Brace into this website, following AGENTS.md."

The agent will detect your framework, match the mascot to your brand color, wire up the backend,
and index your live content — see `AGENTS.md` for exactly what it will and won't do to your repo.

## Status

Early / MVP. This is meant to be genuinely useful out of the box for a small-to-medium site, not
a finished product — issues and PRs welcome.

## License

MIT — see [`LICENSE`](./LICENSE).
