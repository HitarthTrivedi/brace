import * as cheerio from "cheerio";

const MAX_PAGES = 200;
const REQUEST_TIMEOUT_MS = 10000;

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "BraceBot/0.1 (+site-crawler)" } });
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

const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4"]);
const BLOCK_TAGS = new Set([
  "p", "div", "section", "article", "li", "ul", "ol", "td", "th", "tr", "table", "dd", "dt",
  "blockquote", "pre", "figcaption", "br", "h5", "h6", "aside", "details", "summary",
]);
const clean = (t) => t.replace(/\s+/g, " ").trim();

/**
 * The id a browser could scroll to for this heading: its own id, an id/name on an
 * element inside it (<h2><a id="pricing">), or the id of a wrapper it opens
 * (<section id="pricing"><h2>…). null when the page gives it none.
 */
function headingAnchor($, el) {
  const $el = $(el);
  const own = $el.attr("id");
  if (own) return own;
  const inner = $el.find("[id], a[name]").first();
  if (inner.length) return inner.attr("id") || inner.attr("name");
  const parent = $el.parent();
  if (parent.attr("id") && parent.children().first()[0] === el) return parent.attr("id");
  return null;
}

/**
 * Split the main content into sections, one per h1–h4, so every chunk remembers
 * where on the page it came from. Text before the first heading is a section
 * with heading null. Returns [{ heading, anchor, text }].
 */
function extractSections($, main) {
  const sections = [];
  let current = { heading: null, anchor: null, parts: [] };
  const flush = () => {
    const text = clean(current.parts.join(" "));
    if (text) sections.push({ heading: current.heading, anchor: current.anchor, text });
  };
  const walk = (nodes) => {
    nodes.each((_, node) => {
      if (node.type === "text") {
        current.parts.push(node.data);
        return;
      }
      if (node.type !== "tag") return;
      const tag = node.tagName.toLowerCase();
      if (HEADING_TAGS.has(tag)) {
        flush();
        const heading = clean($(node).text());
        // the heading's own words go into its section too, so they help retrieval
        current = { heading: heading || null, anchor: headingAnchor($, node), parts: [heading] };
        return;
      }
      walk($(node).contents());
      if (BLOCK_TAGS.has(tag)) current.parts.push(" ");
    });
  };
  walk(main.contents());
  flush();
  return sections;
}

function extractPage(html, url) {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header svg").remove();
  const title = $("title").first().text().trim() || url;
  const main = $("main").length ? $("main").first() : $("body");
  const sections = extractSections($, main);
  const text = clean(sections.map((s) => s.text).join(" "));
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
  return { title, text, sections, links: [...links] };
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
    const { title, text, sections, links } = extractPage(html, url);
    if (text) pages.push({ url, title, text, sections });

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
 * link-following if no sitemap exists. Returns [{ url, title, text, sections: [{ heading, anchor, text }] }].
 */
export async function crawlSite(baseUrl) {
  const sitemapUrls = await urlsFromSitemap(baseUrl);
  if (sitemapUrls) {
    const pages = [];
    for (const url of sitemapUrls.slice(0, MAX_PAGES)) {
      const html = await fetchText(url);
      if (!html) continue;
      const { title, text, sections } = extractPage(html, url);
      if (text) pages.push({ url, title, text, sections });
    }
    return pages;
  }
  return crawlByFollowingLinks(baseUrl);
}
