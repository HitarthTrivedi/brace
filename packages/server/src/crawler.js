import * as cheerio from "cheerio";

const MAX_PAGES = 200;
const REQUEST_TIMEOUT_MS = 10000;

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "ScoutBot/0.1 (+site-crawler)" } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function urlsFromSitemap(baseUrl) {
  const sitemapUrl = new URL("/sitemap.xml", baseUrl).href;
  const xml = await fetchText(sitemapUrl);
  if (!xml) return null;
  const $ = cheerio.load(xml, { xmlMode: true });
  const urls = [];
  $("loc").each((_, el) => urls.push($(el).text().trim()));
  return urls.length ? urls : null;
}

function extractPage(html, url) {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header svg").remove();
  const title = $("title").first().text().trim() || url;
  const main = $("main").length ? $("main") : $("body");
  const text = main
    .text()
    .replace(/\s+/g, " ")
    .trim();
  const links = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, url).href.split("#")[0];
      links.add(abs);
    } catch {
      /* ignore malformed hrefs */
    }
  });
  return { title, text, links: [...links] };
}

async function crawlByFollowingLinks(baseUrl) {
  const origin = new URL(baseUrl).origin;
  const visited = new Set();
  const queue = [baseUrl];
  const pages = [];

  while (queue.length && visited.size < MAX_PAGES) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    const html = await fetchText(url);
    if (!html) continue;
    const { title, text, links } = extractPage(html, url);
    if (text) pages.push({ url, title, text });

    for (const link of links) {
      if (new URL(link).origin === origin && !visited.has(link) && queue.length + visited.size < MAX_PAGES) {
        queue.push(link);
      }
    }
  }
  return pages;
}

/**
 * Crawl a site starting from its sitemap.xml, falling back to same-origin
 * link-following if no sitemap exists. Returns [{ url, title, text }].
 */
export async function crawlSite(baseUrl) {
  const sitemapUrls = await urlsFromSitemap(baseUrl);
  if (sitemapUrls) {
    const pages = [];
    for (const url of sitemapUrls.slice(0, MAX_PAGES)) {
      const html = await fetchText(url);
      if (!html) continue;
      const { title, text } = extractPage(html, url);
      if (text) pages.push({ url, title, text });
    }
    return pages;
  }
  return crawlByFollowingLinks(baseUrl);
}
