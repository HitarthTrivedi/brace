/**
 * Brace — self-contained chat widget. The mascot (packages/widget/brace-mascot.js)
 * hides below the bottom edge of the page and peeks over it; clicking makes it climb
 * out and hand off to the chat panel.
 * Include via: <script src="brace-widget.js" data-api-url="/api/brace/chat" defer></script>
 * Auto-mounts a <brace-widget> element from the script tag's data-* attributes.
 * Ships as a Web Component with Shadow DOM so host-page CSS never leaks in or out.
 * Loads two same-directory files at runtime: vendor/gsap.min.js (optional — the mascot
 * degrades to CSS transitions without it) and brace-mascot.js (required — the widget
 * falls back to a plain unanimated launcher button if this fails to load, so a network
 * hiccup never leaves the site with no way to open the chat at all).
 * The chat is a speech bubble from the mascot (one exchange at a time, earlier ones in
 * an "Earlier" drawer), with suggested-question chips from data-suggestions="Q1|Q2|Q3"
 * or, if absent, this page's own h2 headings.
 * brace-guide.js (optional) powers "Take me there": it keeps the conversation across
 * page changes and spotlights the exact section an answer came from.
 */
(function () {
  const TAG = "brace-widget";
  if (customElements.get(TAG)) return;

  // The chat is a speech bubble coming out of the mascot, not a panel: one exchange
  // at a time, suggested questions as chips, earlier exchanges folded into a drawer.
  const STYLES = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

    .fallback-launcher {
      position: fixed;
      width: 60px; height: 60px;
      border-radius: 50%;
      background: linear-gradient(160deg, var(--brace-primary, #6d5ef8), var(--brace-primary-dark, #4b3ff0));
      color: #fff; font-size: 24px;
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      z-index: 999999;
      box-shadow: 0 8px 22px rgba(0,0,0,0.25);
    }

    .bubble {
      position: fixed; bottom: 124px;
      width: 340px; max-width: calc(100vw - 32px);
      max-height: calc(100vh - 150px);
      background: #fff; color: #14132b;
      border-radius: 22px;
      box-shadow: 0 18px 44px rgba(20,19,43,0.26), 0 0 0 1px rgba(20,19,43,0.06);
      display: flex; flex-direction: column;
      z-index: 999999;
      opacity: 0; transform: translateY(14px) scale(0.6);
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.42s cubic-bezier(0.34,1.56,0.64,1);
    }
    .bubble.open { opacity: 1; transform: none; pointer-events: auto; }
    /* the tail, pointing down at the mascot's head */
    .bubble::after {
      content: ""; position: absolute; bottom: -9px; width: 20px; height: 20px;
      background: #fff; transform: rotate(45deg); border-radius: 0 0 5px 0;
      box-shadow: 1px 1px 0 rgba(20,19,43,0.06);
    }

    .top { display: flex; align-items: center; gap: 6px; padding: 12px 12px 0 16px; }
    .who { font-size: 12px; color: #5b5a70; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .who b { color: #14132b; font-weight: 700; }
    .icon-btn {
      border: none; background: #f2f2f7; color: #14132b; cursor: pointer;
      height: 26px; min-width: 26px; padding: 0 8px; border-radius: 999px; font-size: 12px; font-weight: 600;
    }
    .icon-btn:hover { background: #e7e7f0; }
    .icon-btn[hidden] { display: none; }

    .scroll { overflow-y: auto; padding: 8px 16px 4px; }
    .drawer { display: none; flex-direction: column; gap: 10px; padding: 4px 0 12px; margin-bottom: 10px; border-bottom: 1px dashed #e2e2ec; }
    .drawer.open { display: flex; }
    .past .q { font-size: 12px; color: #5b5a70; margin-bottom: 2px; }
    .past .a { font-size: 13px; line-height: 1.45; color: #2c2b40; }
    .past .a p { margin: 0 0 4px; }

    .asked { font-size: 12px; color: #5b5a70; margin-bottom: 6px; }
    .asked b { color: #14132b; font-weight: 600; }
    .answer { font-size: 15px; line-height: 1.5; color: #14132b; animation: rise 0.35s ease both; }
    .answer p { margin: 0 0 8px; }
    .answer p:last-child { margin-bottom: 0; }
    .answer ul, .answer ol { margin: 2px 0 8px; padding-left: 18px; }
    .answer li { margin-bottom: 3px; }
    .answer strong { font-weight: 700; }
    @keyframes rise { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

    .go { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
    .take-btn {
      align-self: flex-start;
      background: var(--brace-primary, #6d5ef8); color: #fff; border: none; cursor: pointer;
      border-radius: 999px; padding: 9px 14px; font-size: 13px; font-weight: 700;
      transition: transform 0.15s ease;
    }
    .take-btn:hover { transform: translateX(3px); }
    .go a { font-size: 12px; font-weight: 600; color: var(--brace-primary, #6d5ef8); text-decoration: none; }
    .go a:hover { text-decoration: underline; }

    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .chips .label { width: 100%; font-size: 11px; color: #5b5a70; text-transform: uppercase; letter-spacing: 0.04em; }
    .chip {
      border: 1px solid #d9d8e6; background: #fff; color: #14132b; cursor: pointer;
      border-radius: 999px; padding: 6px 11px; font-size: 12.5px; text-align: left;
    }
    .chip:hover { border-color: var(--brace-primary, #6d5ef8); color: var(--brace-primary, #6d5ef8); }

    .typing { display: flex; gap: 5px; padding: 6px 0; }
    .typing span { width: 7px; height: 7px; border-radius: 50%; background: #c6c6d4; animation: tbounce 1s infinite; }
    .typing span:nth-child(2) { animation-delay: 0.15s; }
    .typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes tbounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }

    .ask { display: flex; gap: 6px; padding: 10px 12px 12px; }
    .ask input {
      flex: 1; min-width: 0; border: 1px solid #b9b8cc; border-radius: 999px; padding: 9px 14px;
      font-size: 13.5px; outline: none; color: #14132b; background: #fff;
    }
    .ask input:focus { border-color: var(--brace-primary, #6d5ef8); box-shadow: 0 0 0 3px rgba(109,94,248,0.18); }
    .ask .send {
      background: var(--brace-primary, #6d5ef8); color: #fff; border: none;
      width: 36px; height: 36px; border-radius: 50%; cursor: pointer; flex-shrink: 0; font-size: 14px;
      transition: transform 0.15s ease;
    }
    .ask .send:hover:not(:disabled) { transform: scale(1.08); }
    .ask .send:disabled, .ask input:disabled { opacity: 0.5; cursor: default; }

    button:focus-visible, .chip:focus-visible, a:focus-visible { outline: 2px solid #14132b; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) {
      .bubble { transition: opacity 0.15s ease; transform: none; }
      .answer { animation: none; }
    }
  `;

  // --- markdown-ish rendering for bot answers (bold, lists, paragraphs) ---
  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }
  function inlineMd(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  }
  function mdToHtml(raw) {
    const escaped = escapeHtml(raw);
    return escaped
      .split(/\n{2,}/)
      .map((block) => {
        const lines = block.split("\n").filter((l) => l.length);
        if (!lines.length) return "";
        if (lines.every((l) => /^[-*•]\s+/.test(l))) {
          return `<ul>${lines.map((l) => `<li>${inlineMd(l.replace(/^[-*•]\s+/, ""))}</li>`).join("")}</ul>`;
        }
        if (lines.every((l) => /^\d+\.\s+/.test(l))) {
          return `<ol>${lines.map((l) => `<li>${inlineMd(l.replace(/^\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
        }
        return `<p>${lines.map(inlineMd).join("<br>")}</p>`;
      })
      .join("");
  }

  // --- lazy-load same-directory scripts; each is cached on `window` so multiple
  // widget instances on one page only fetch them once ---
  const SCRIPT_URL = document.currentScript ? document.currentScript.src : "";
  const BASE_URL = SCRIPT_URL.replace(/[^/]+$/, "");
  function loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
  }
  function loadGSAP() {
    if (window.gsap) return Promise.resolve(window.gsap);
    if (!window.__braceGsapLoad) {
      window.__braceGsapLoad = loadScript(BASE_URL + "vendor/gsap.min.js").then(() => window.gsap || null);
    }
    return window.__braceGsapLoad;
  }
  function loadMascotLib() {
    if (window.BraceMascot) return Promise.resolve(window.BraceMascot);
    if (!window.__braceMascotLoad) {
      window.__braceMascotLoad = loadScript(BASE_URL + "brace-mascot.js").then(() => window.BraceMascot || null);
    }
    return window.__braceMascotLoad;
  }

  function loadGuideLib() {
    if (window.BraceGuide) return Promise.resolve(window.BraceGuide);
    if (!window.__braceGuideLoad) {
      window.__braceGuideLoad = loadScript(BASE_URL + "brace-guide.js").then(() => window.BraceGuide || null);
    }
    return window.__braceGuideLoad;
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  class BraceWidget extends HTMLElement {
    async connectedCallback() {
      this.apiUrl = this.getAttribute("api-url") || "/api/brace/chat";
      this.position = this.getAttribute("position") || "bottom-right";
      this.greeting = this.getAttribute("greeting") || "Hi! Ask me anything about this site — I can find the right page for you.";
      this.siteName = this.getAttribute("site-name") || "this site";
      const primary = this.getAttribute("primary-color") || "#6d5ef8";
      const side = this.position.includes("left") ? "left" : "right";

      this.history = [];
      this._log = []; // every rendered message, so the chat survives a page change
      this._lastQuestion = "";
      this._open = false;

      const root = this.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = STYLES + this._positionCSS(side);
      root.appendChild(style);
      this.style.setProperty("--brace-primary", primary);
      this.style.setProperty("--brace-primary-dark", this._darken(primary));

      root.innerHTML += `
        <div class="bubble" role="dialog" aria-label="${escapeHtml(this.siteName)} assistant">
          <div class="top">
            <div class="who"><b>Brace</b> \u00b7 ask about ${escapeHtml(this.siteName)}</div>
            <button class="icon-btn hist-btn" type="button" hidden aria-expanded="false">Earlier</button>
            <button class="icon-btn close-btn" type="button" aria-label="Close">\u2715</button>
          </div>
          <div class="scroll">
            <div class="drawer"></div>
            <div class="current" aria-live="polite"></div>
          </div>
          <form class="ask">
            <input type="text" placeholder="Ask anything\u2026" aria-label="Your question" />
            <button class="send" type="submit" aria-label="Send">\u27a4</button>
          </form>
        </div>
      `;

      this.$bubble = root.querySelector(".bubble");
      this.$scroll = root.querySelector(".scroll");
      this.$drawer = root.querySelector(".drawer");
      this.$current = root.querySelector(".current");
      this.$histBtn = root.querySelector(".hist-btn");
      this.$input = root.querySelector(".ask input");
      this.$send = root.querySelector(".send");
      this._pending = null; // the question waiting on an answer

      root.querySelector(".close-btn").addEventListener("click", () => this.toggle(false));
      root.querySelector(".ask").addEventListener("submit", (e) => {
        e.preventDefault();
        this._submit();
      });
      this.$histBtn.addEventListener("click", () => {
        const open = this.$drawer.classList.toggle("open");
        this.$histBtn.setAttribute("aria-expanded", String(open));
        this.$histBtn.textContent = open ? "Hide" : `Earlier (${this.$drawer.children.length})`;
      });
      this.$bubble.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.toggle(false);
      });
      this.suggestions = this._suggestions();

      const [gsap, BraceMascot, Guide] = await Promise.all([loadGSAP(), loadMascotLib(), loadGuideLib()]);
      this._guide = Guide;

      if (BraceMascot) {
        this._mascot = BraceMascot.create(root, {
          gsap,
          side,
          label: `Open ${this.siteName} assistant`,
        });
        this.$launcher = this._mascot.el;
      } else {
        // brace-mascot.js failed to load (offline, blocked, etc.) — a plain button
        // beats leaving the site with no way to open the chat at all.
        console.error("Brace: could not load brace-mascot.js — using a plain fallback launcher.");
        const btn = document.createElement("button");
        btn.className = "fallback-launcher";
        btn.setAttribute("aria-label", `Open ${this.siteName} assistant`);
        btn.textContent = "💬";
        root.appendChild(btn);
        this.$launcher = btn;
        this._mascot = { open: () => Promise.resolve(), close: () => Promise.resolve(), thinking() {}, happy() {} };
      }
      this.$launcher.addEventListener("click", () => this.toggle());

      // Pick the conversation back up if the visitor just came from another page.
      const saved = Guide ? Guide.restore() : null;
      if (saved && saved.log && saved.log.length) {
        this.history = saved.history || [];
        this._log = saved.log;
        this._render();
        const q = [...saved.log].reverse().find((m) => m.role === "user");
        this._lastQuestion = q ? q.text : "";
      } else {
        this._addMessage("bot", this.greeting);
      }
      // …and if they got here via "Take me there", finish the trip.
      if (saved && saved.landing && Guide.samePage(saved.landing.url)) {
        Guide.clearLanding();
        if (document.readyState !== "complete") await new Promise((r) => window.addEventListener("load", r, { once: true }));
        await wait(250); // let late layout (fonts, images) settle before measuring
        this._land(saved.landing);
      }
    }

    _positionCSS(side) {
      const rule = side === "left" ? "left: 16px;" : "right: 16px;";
      // tail sits over the mascot's head: mascot is 96px wide, 24px in from the edge
      const tail = side === "left" ? "left: 62px;" : "right: 62px;";
      return `
        .bubble { ${rule} transform-origin: ${side === "left" ? "left" : "right"} bottom; }
        .bubble::after { ${tail} }
        .fallback-launcher { bottom: 22px; ${side === "left" ? "left: 24px;" : "right: 24px;"} }
      `;
    }

    // Chips: the installer's data-suggestions="Q1|Q2|Q3", else this page's own h2s.
    _suggestions() {
      const given = (this.getAttribute("suggestions") || "").split("|").map((q) => q.trim()).filter(Boolean);
      if (given.length) return given.slice(0, 4).map((q) => ({ label: q, q }));
      const seen = new Set();
      return [...document.querySelectorAll("main h2, h2")]
        .map((h) => h.textContent.replace(/\s+/g, " ").trim())
        .filter((t) => t && t.length <= 40 && !seen.has(t) && seen.add(t))
        .slice(0, 3)
        .map((t) => ({ label: t, q: `Tell me about ${t}` }));
    }

    _darken(hex) {
      const n = hex.replace("#", "");
      if (n.length !== 6) return hex;
      const num = parseInt(n, 16);
      const r = Math.max(0, (num >> 16) - 30);
      const g = Math.max(0, ((num >> 8) & 0xff) - 30);
      const b = Math.max(0, (num & 0xff) - 30);
      return `rgb(${r},${g},${b})`;
    }

    async toggle(force) {
      const opening = force !== undefined ? force : !this._open;
      if (opening === this._open) return;
      this._open = opening;
      if (opening) {
        await this._mascot.open();
        if (!this._open) return; // closed again mid-animation
        this.$bubble.classList.add("open");
        this.$input.focus();
      } else {
        this.$bubble.classList.remove("open");
        this._mascot.close();
        if (this.$launcher && this.$launcher.focus) this.$launcher.focus();
      }
    }

    _addMessage(role, text, sources) {
      this._log.push({ role, text, sources: sources || null });
      this._persist();
      this._render();
    }

    // Split the log into exchanges: [{ q, a }] where the greeting is { q: null, a }.
    _exchanges() {
      const out = [];
      this._log.forEach((m) => {
        if (m.role === "user") out.push({ q: m.text, a: null });
        else if (out.length && out[out.length - 1].a === null && out[out.length - 1].q !== null) out[out.length - 1].a = m;
        else out.push({ q: null, a: m });
      });
      if (this._pending) out.push({ q: this._pending, a: null, pending: true });
      return out;
    }

    // The bubble only ever shows the latest exchange; earlier ones fold into the drawer.
    _render() {
      const all = this._exchanges().filter((x, i) => x.q !== null || i === 0); // greeting only while it's first
      const cur = all[all.length - 1] || { q: null, a: { text: this.greeting } };
      const past = all.slice(0, -1).filter((x) => x.q !== null && x.a);

      this.$drawer.innerHTML = "";
      past.forEach((x) => {
        const d = document.createElement("div");
        d.className = "past";
        d.innerHTML = `<div class="q">${escapeHtml(x.q)}</div><div class="a">${mdToHtml(x.a.text)}</div>`;
        this.$drawer.appendChild(d);
      });
      this.$histBtn.hidden = past.length === 0;
      if (!this.$drawer.classList.contains("open")) this.$histBtn.textContent = `Earlier (${past.length})`;

      const c = this.$current;
      c.innerHTML = "";
      if (cur.q) {
        const asked = document.createElement("div");
        asked.className = "asked";
        asked.innerHTML = `You asked <b>${escapeHtml(cur.q)}</b>`;
        c.appendChild(asked);
      }
      if (cur.pending) {
        c.insertAdjacentHTML("beforeend", '<div class="typing" aria-label="Thinking"><span></span><span></span><span></span></div>');
      } else if (cur.a) {
        const ans = document.createElement("div");
        ans.className = "answer";
        ans.innerHTML = mdToHtml(cur.a.text);
        c.appendChild(ans);
        const sources = cur.a.sources;
        if (sources && sources.length) {
          const go = document.createElement("div");
          go.className = "go";
          const take = document.createElement("button");
          take.className = "take-btn";
          take.type = "button";
          take.textContent = "Take me there \u2192";
          take.addEventListener("click", () => this._goTo(sources[0]));
          go.appendChild(take);
          sources.forEach((s) => {
            const a = document.createElement("a");
            a.href = s.url;
            a.textContent = "\u2192 " + (s.title || s.url) + (s.heading ? " \u00b7 " + s.heading : "");
            a.addEventListener("click", (e) => {
              e.preventDefault();
              this._goTo(s);
            });
            go.appendChild(a);
          });
          c.appendChild(go);
        }
      }
      // chips: on the greeting, and after an answer (minus what was already asked)
      if (!cur.pending) {
        const asked = new Set(this._log.filter((m) => m.role === "user").map((m) => m.text));
        const chips = this.suggestions.filter((s) => !asked.has(s.q));
        if (chips.length) {
          const box = document.createElement("div");
          box.className = "chips";
          if (cur.q) box.innerHTML = '<div class="label">Also ask</div>';
          chips.forEach((s) => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "chip";
            b.textContent = s.label;
            b.addEventListener("click", () => this._submit(s.q));
            box.appendChild(b);
          });
          c.appendChild(box);
        }
      }
      this.$scroll.scrollTop = this.$drawer.classList.contains("open") ? this.$scroll.scrollHeight : 0;
    }

    _persist(landing) {
      if (this._guide) this._guide.save({ log: this._log, history: this.history, landing: landing || null });
    }

    // "Take me there": same page → close the chat and spotlight the spot;
    // same site → save the chat + where to land, mascot dives out of sight, navigate;
    // another site → new tab, as before.
    async _goTo(source) {
      let target;
      try {
        target = new URL(source.url, window.location.href);
      } catch (_) {
        return;
      }
      if (target.origin !== window.location.origin) {
        window.open(target.href, "_blank", "noopener");
        return;
      }
      const landing = {
        url: target.href,
        anchor: source.anchor || null,
        heading: source.heading || null,
        snippet: source.snippet || null,
        question: this._lastQuestion,
      };
      const Guide = this._guide;
      if (Guide && Guide.samePage(target.href)) {
        this.toggle(false);
        await wait(350);
        this._land(landing);
        return;
      }
      this._persist(landing);
      this._open = false;
      this.$bubble.classList.remove("open");
      // let the mascot's drop read as it "going there", but don't hold the trip for the whole close
      await Promise.race([this._mascot.close(), wait(450)]);
      if (source.anchor) target.hash = source.anchor; // native jump if the guide can't run on arrival
      window.location.href = target.href;
    }

    _land(landing) {
      const Guide = this._guide;
      const el = Guide && Guide.locate(landing);
      if (!el) {
        // index too old (no anchors) or the page changed since the crawl: they're on the right page, just not the exact spot
        console.info("Brace: couldn't find the exact section on this page; showing the top of the page.");
        return;
      }
      Guide.spotlight(this.shadowRoot, el, {
        label: landing.question ? `for \u201c${landing.question}\u201d` : landing.heading || "",
        onBack: () => this.toggle(true),
      });
    }

    async _submit(preset) {
      const text = (preset || this.$input.value).trim();
      if (!text || this._pending) return;
      this.$input.value = "";
      this.$input.disabled = true;
      this.$send.disabled = true;
      this._lastQuestion = text;
      this._pending = text;
      this._render();
      this._mascot.thinking(true);

      let answer, sources = null, ok = true;
      try {
        const res = await fetch(this.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history: this.history.slice(-8) }),
        });
        const data = await res.json();
        answer = data.answer || "Sorry, I couldn't find an answer to that.";
        sources = data.sources;
      } catch (err) {
        ok = false;
        answer = "I'm having trouble reaching the server right now \u2014 please try again in a moment.";
      }
      this._pending = null;
      this.history.push({ role: "user", content: text });
      this._log.push({ role: "user", text, sources: null });
      if (ok) this.history.push({ role: "assistant", content: answer });
      this._addMessage("bot", answer, sources);
      if (ok) this._mascot.happy();
      else this._mascot.thinking(false);
      this.$input.disabled = false;
      this.$send.disabled = false;
      this.$input.focus();
    }
  }

  customElements.define(TAG, BraceWidget);

  // Auto-mount from the including <script>'s data-* attributes, so a single
  // <script src="brace-widget.js" data-api-url="..."></script> is enough.
  const currentScript = document.currentScript;
  function mount() {
    if (document.querySelector(TAG)) return; // developer already placed one manually
    const el = document.createElement(TAG);
    if (currentScript) {
      [...currentScript.attributes].forEach((attr) => {
        if (attr.name.startsWith("data-")) {
          el.setAttribute(attr.name.replace(/^data-/, ""), attr.value);
        }
      });
    }
    document.body.appendChild(el);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
