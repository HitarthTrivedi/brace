# Getting a free LLM API key for Scout

Scout only needs the LLM for the **chat/answer step** — indexing your site is done locally for
free (see `packages/server/src/embeddings.js`), so it never hits an external rate limit no matter
how big your site is. You only need one key below.

## Option A — Groq (recommended default)

Fast, no credit card required, and currently the most generous free daily limit of the options
here (thousands of requests/day on Llama 3.3 70B, more on smaller models).

1. Go to `https://console.groq.com`.
2. Sign in with Google or GitHub — no card needed.
3. Open **API Keys** in the left sidebar → **Create API Key**.
4. Copy the key (starts with `gsk_...`). You will not be able to see it again.
5. Paste it into `scout/server/.env`:
   ```
   LLM_PROVIDER=groq
   LLM_BASE_URL=https://api.groq.com/openai/v1
   LLM_MODEL=llama-3.3-70b-versatile
   LLM_API_KEY=gsk_your_key_here
   ```

Groq's free tier is rate-limited (requests/minute and requests/day), not usage-metered — if your
site gets heavy chat traffic, you'll hit a temporary 429 rather than a bill. Check current limits
at `https://console.groq.com/settings/limits`.

## Option B — OpenRouter (one key, many models — good for quick testing)

OpenRouter gives you a single key that can call dozens of providers' models, including several
`:free` ones at $0/token. No credit card needed for the free tier. Two things to know going in,
honestly: the free-tier rate limit is tighter than Groq's — **50 requests/day, 20/minute**, rising
to 1,000/day only if you've ever added $10 of credit to the account — and *which* models carry the
`:free` suffix rotates over time, so don't assume the exact model name below still exists when you
read this.

1. Go to `https://openrouter.ai/keys` and sign in (email or GitHub, no card required).
2. Click **Create Key**, name it, copy it. You will not be able to see it again.
3. Go to `https://openrouter.ai/collections/free-models` (or filter the models page to price = 0)
   and pick a current `:free` model — something in the Llama/Qwen/Gemini-flash family is a
   reasonable general-purpose pick for this use case.
4. Paste into `scout/server/.env`:
   ```
   LLM_PROVIDER=openrouter
   LLM_BASE_URL=https://openrouter.ai/api/v1
   LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free
   LLM_API_KEY=sk-or-your_key_here
   ```
   If that exact model ID 404s, it's rotated off the free tier — swap in whatever is currently
   listed on the free-models page above; no other code changes needed.
5. Optional: set `OPENROUTER_SITE_URL` and `OPENROUTER_APP_NAME` in `.env` — OpenRouter reads
   these for its own dashboard/analytics on your key. Not required for it to work.

Because the free-tier limit is only 50 requests/day, OpenRouter is a fine choice for developing
and testing Scout, but switch to Groq (or add OpenRouter credit) before pointing it at a real site
with real visitor traffic.

## Option C — Google Gemini (fallback / alternative)

No credit card needed either, but daily free limits are smaller and change more often than
Groq's — check your actual quota live in AI Studio rather than trusting any number printed here.

1. Go to `https://aistudio.google.com/apikey`.
2. Sign in with a Google account.
3. Click **Create API key** → choose "Create key in new project" if you don't have one.
4. Copy the key.
5. Paste it into `scout/server/.env`:
   ```
   LLM_PROVIDER=gemini
   LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
   LLM_MODEL=gemini-3.5-flash-lite
   LLM_API_KEY=your_key_here
   ```
   (Google exposes an OpenAI-compatible endpoint, which is why the base URL looks like that —
   Scout's server code doesn't need a separate code path per provider.)

## Option D — bring your own (OpenAI, Anthropic, a local Ollama model, anything OpenAI-compatible)

Scout's server just does a plain HTTPS call to `${LLM_BASE_URL}/chat/completions` with a Bearer
key, so any OpenAI-compatible provider works — just set the three `LLM_*` variables in `.env`
accordingly. This includes running a fully local model via Ollama (`LLM_BASE_URL=http://localhost:11434/v1`,
no key needed, zero external calls at all) if you'd rather not use a third-party API.
