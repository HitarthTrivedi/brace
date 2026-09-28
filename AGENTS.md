# Scout — install playbook for coding agents

You (a coding agent — Claude Code, or any other agent reading this file) have been asked by a
developer to integrate **Scout** into their website. Scout is a small floating chat mascot that
lets a visitor ask questions about the *entire* site (not just the current page) and get answered
with links straight to the right page. This file is your complete instruction set. Follow it in
order. Do not skip the safety rules in section 0.

Scout has two parts:
- `packages/widget/scout-widget.js` — a dependency-free Web Component (Shadow DOM). Drops into
  any site: React, Next.js, plain HTML, WordPress, Shopify. No build step required.
- `packages/server/` — a small self-hosted Node backend: crawls the site, indexes it locally
  (no external database needed), and answers questions using a free LLM API.

## 0. Safety rules — read first

- **Never overwrite a file that already exists** in the target repo without asking the developer
  first. If `packages/`, `scout/`, `.env`, or similar already exist and look unrelated to Scout,
  stop and ask.
- **Never commit or print API keys.** `.env` must be in `.gitignore`. If you create `.gitignore`,
  check one doesn't already exist and merge into it instead of replacing it.
- **Do not run `npm install` with elevated/global flags, and do not modify CI/CD, deployment
  config, or unrelated dependencies.**
- **Explain each step out loud to the developer as you do it** — this is a bigger ask than
  `npm install`, since you're an agent editing their live codebase. Show your plan before writing
  files, and offer a dry run ("show me what you'd do") if the developer seems unsure.
- If any step fails (missing Node, no sitemap, etc.), stop and report — don't guess around it
  silently.

## 1. Detect the target project

Look at the developer's repo root. Determine:
1. **Framework**: Next.js (`next.config.*`), other React/Vite app, plain static HTML, WordPress
   (`wp-content/`), or something else.
2. **Where pages render**: the root layout (`app/layout.tsx`, `_document.tsx`, `index.html`,
   `header.php`, etc.) — this is where the widget's one `<script>`/import goes.
3. **Existing brand color**: check `tailwind.config.*`, top-level CSS custom properties (look for
   `--primary`, `--brand`, `--accent`), or a computed style on the primary button/header if
   nothing else is found. You'll pass this to Scout so the mascot matches their site instead of
   looking bolted-on.
4. **Site's live/dev base URL** — ask the developer if it isn't obvious (e.g. from `package.json`
   scripts, `.env`, or a README).

## 2. Copy Scout into their repo

Copy `packages/widget/` and `packages/server/` into their project, e.g. under a new top-level
`scout/` folder (`scout/widget/`, `scout/server/`). Keep both — the widget is static and can be
served from anywhere; the server needs to run somewhere (same host, or a small separate Node
process/serverless function).

## 3. Wire the widget into their site

Add one line near the closing `</body>` (or the equivalent root layout for their framework):

```html
<script
  src="/scout/widget/scout-widget.js"
  data-api-url="/api/scout/chat"
  data-primary-color="#4f46e5"   <!-- the brand color you detected in step 1 -->
  data-position="bottom-right"
  defer
></script>
```

For Next.js App Router, add this via `next/script` in `app/layout.tsx` with `strategy="lazyOnload"`
instead of a raw tag. For WordPress, add it to `footer.php` or via the theme's script enqueue —
never inline `<script>` directly into `functions.php` output without escaping.

Adjust `data-primary-color` to the color found in step 1. Leave the rest as defaults unless the
developer asks otherwise.

## 4. Set up the backend

1. `cd` into the copied `scout/server/` folder and run `npm install`.
2. Copy `.env.example` to `.env`.
3. Ask the developer which free LLM provider they want (see `docs/GET_API_KEY.md` in this repo for
   exact click-by-click steps for each). Default recommendation: **Groq** (fast, generous free
   daily limit, no credit card). Put their key in `.env` as `LLM_API_KEY`.
   - If they don't have a key yet and want you to wait, pause here and ask them to paste it in
     once they've created one — don't fabricate a placeholder key and move on silently.
4. Set `SITE_BASE_URL` in `.env` to the site's real base URL from step 1.
5. Wire `/api/scout/chat` (referenced in the widget's `data-api-url`) to proxy to this server's
   `/api/chat` route — either by running the server standalone on its own port with a reverse
   proxy rule, or, if the site is Next.js, by adding a thin API route at
   `app/api/scout/chat/route.ts` that forwards the request to the local server module.

## 5. Build the initial index

Run the crawler once against the real site so Scout has something to answer from:

```bash
npm run crawl -- --base-url=https://their-real-site.com
```

This fetches `sitemap.xml` if present (falls back to same-origin link crawling, capped at 200
pages), chunks the text, embeds it **locally** (no API call, no cost, no rate limit — via
`@xenova/transformers`), and writes `scout/server/data/index.json`. Tell the developer to re-run
this whenever they publish significant new content, or set up a cron/CI step to do it for them.

## 6. Verify it actually works

1. Start their dev server.
2. Confirm the Scout bubble renders in the correct corner and matches the site's color.
3. Open it and ask a real question whose answer lives on a page other than the homepage (e.g.
   "do you have [some product/material] in stock" for a catalog site). Confirm the answer comes
   back with a correct link, and that clicking the link actually navigates there.
4. If you have browser tooling available, do this verification yourself before telling the
   developer it's done. If not, ask them to check and report back.

## 7. Report back

Summarize for the developer: what got installed, where, which LLM provider is wired up, how to
re-crawl, and how to change the mascot's color/position later (both are just the `data-*`
attributes on the script tag — no rebuild needed).
