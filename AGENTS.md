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

**Always wrap whatever you insert in `scout:start` / `scout:end` marker comments**, in the
comment syntax native to that file type. This is what makes Scout cleanly removable later by any
agent, regardless of which framework you're integrating into — see "Uninstalling Scout" at the
end of this file. Never skip the markers, even for a one-line change.

Plain HTML — add near the closing `</body>`:

```html
<!-- scout:start -->
<script
  src="/scout/widget/scout-widget.js"
  data-api-url="/api/scout/chat"
  data-primary-color="#4f46e5"   <!-- the brand color you detected in step 1 -->
  data-position="bottom-right"
  defer
></script>
<!-- scout:end -->
```

Next.js App Router — add via `next/script` in `app/layout.tsx` with `strategy="lazyOnload"`,
wrapped the same way using JSX comment syntax:

```jsx
{/* scout:start */}
<Script src="/scout/widget/scout-widget.js" data-api-url="/api/scout/chat" data-primary-color="#4f46e5" strategy="lazyOnload" />
{/* scout:end */}
```

WordPress — add to `footer.php` or via the theme's script enqueue, wrapped in `<!-- scout:start -->`
/ `<!-- scout:end -->` the same as plain HTML. Never inline `<script>` directly into `functions.php`
output without escaping.

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
pages), chunks the text, embeds it **locally** (no API call, no cost, no rate limit — see
`packages/server/src/embeddings.js`), and writes `scout/server/data/index.json`. Tell the
developer to re-run this whenever they publish significant new content, or set up a cron/CI step
to do it for them.

## 6. Verify it actually works

1. Start their dev server.
2. Confirm the Scout bubble renders in the correct corner and matches the site's color.
3. Open it and ask a real question whose answer lives on a page other than the homepage (e.g.
   "do you have [some product/material] in stock" for a catalog site). Confirm the answer comes
   back with a correct link, and that clicking the link actually navigates there.
4. If you have browser tooling available, do this verification yourself before telling the
   developer it's done. If not, ask them to check and report back.

## 7. Write an install manifest

Before reporting back, write `scout/INSTALL_MANIFEST.md` in the developer's repo recording exactly
what you did:

```markdown
# Scout install manifest

- Installed: <date>
- Copied to: <path, e.g. scout/widget/, scout/server/>
- Files modified (script tag wrapped in scout:start/scout:end markers):
  - <path/to/file> — <where in the file, e.g. "before </body>">
  - <...>
- Backend: <how it's run, e.g. "standalone on PORT=4000" or "app/api/scout/chat/route.ts proxy">
- LLM provider: <groq | openrouter | gemini | other>, model <model id>
- Re-crawl command: `npm run crawl -- --base-url=<site base url>` (run from <path>)
```

This is the only reliable way a future agent (possibly a different one, in a different session) can
cleanly uninstall Scout later — **do not skip it**, even for a quick/manual install.

## 8. Report back

Summarize for the developer: what got installed, where, which LLM provider is wired up, how to
re-crawl, how to change the mascot's color/position later (both are just the `data-*` attributes on
the script tag — no rebuild needed), and that `scout/INSTALL_MANIFEST.md` is what a future "remove
Scout" request will use.

## Uninstalling Scout

If a developer asks you to remove Scout instead of install it, do this:

1. Look for `scout/INSTALL_MANIFEST.md` (or wherever step 7 wrote it) in their repo. If it exists,
   use it as the exact list of what to revert.
2. If no manifest exists (a manual or older install), fall back to searching the repo for
   `scout:start` / `scout:end` marker pairs and any top-level `scout/` folder — but tell the
   developer you're doing a best-effort removal without a manifest, and show them what you found
   before deleting anything.
3. For each modified file listed: delete everything between (and including) the `scout:start` /
   `scout:end` markers, leaving the rest of the file untouched.
4. Delete the copied widget/server folder(s).
5. Stop any backend process you know is still running (ask the developer for the port/process if
   you didn't start it yourself in this session).
6. Delete `scout/INSTALL_MANIFEST.md` itself last, once everything else is confirmed removed.
7. Report back exactly what was removed and confirm the site still builds/runs normally afterward.

Never delete a file outright merely because "scout" appears in its name or path without confirming
it's actually something Scout created — when in doubt, ask.
