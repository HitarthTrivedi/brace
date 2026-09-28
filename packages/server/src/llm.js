// Generic OpenAI-compatible chat client. Groq, Google's Gemini compat layer,
// OpenAI itself, and local Ollama all speak this same shape, so swapping
// providers is just changing three env vars — no provider-specific code.
export async function chatCompletion(messages) {
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  const apiKey = process.env.LLM_API_KEY;

  if (!baseUrl || !model) {
    throw new Error("LLM_BASE_URL and LLM_MODEL must be set in .env — see docs/GET_API_KEY.md");
  }

  // OpenRouter reads these two headers for its leaderboard/analytics — harmless to
  // omit, and harmless to send to other OpenAI-compatible providers, which ignore them.
  const attributionHeaders = {};
  if (process.env.OPENROUTER_SITE_URL) attributionHeaders["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  if (process.env.OPENROUTER_APP_NAME) attributionHeaders["X-Title"] = process.env.OPENROUTER_APP_NAME;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...attributionHeaders,
    },
    // max_tokens is the real backstop against runaway cost/latency: some free models
    // (especially ones labeled "reasoning") emit long hidden chain-of-thought before
    // the visible answer, which otherwise burns thousands of tokens per reply.
    body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 400 }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}
