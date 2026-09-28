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
 * brace-guide.js (optional) powers "Take me there": it keeps the conversation across
 * page changes and spotlights the exact section an answer came from.
 */
(function () {
  const TAG = "brace-widget";
  if (customElements.get(TAG)) return;

  const PANEL_STYLES = `
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

    .panel {
      position: fixed;
      width: 368px; max-width: calc(100vw - 32px);
      height: 528px; max-height: calc(100vh - 120px);
      background: #fff;
      border-radius: 22px;
      box-shadow: 0 20px 50px rgba(20,19,43,0.28);
      display: flex; flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      opacity: 0; transform: translateY(20px) scale(0.96);
      pointer-events: none;
      transition: opacity 0.25s cubic-bezier(0.34,1.56,0.64,1), transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
    }
    .panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

    .panel-header {
      background: linear-gradient(160deg, var(--brace-primary, #6d5ef8), var(--brace-primary-dark, #4b3ff0));
      color: #fff; padding: 16px 18px;
      display: flex; align-items: center; gap: 10px;
    }
    .panel-header .avatar { width: 34px; height: 34px; flex-shrink: 0; }
    .panel-header .avatar svg { width: 100%; height: 100%; display: block; overflow: visible; }
    .panel-header .title { font-weight: 700; font-size: 15px; }
    .panel-header .subtitle { font-size: 12px; opacity: 0.85; }
    .close-btn {
      margin-left: auto; background: rgba(255,255,255,0.18); border: none; color: #fff;
      width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 14px;
    }
    .close-btn:hover { background: rgba(255,255,255,0.3); }

    .messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; background: #f7f7fb; }
    .msg { max-width: 85%; padding: 10px 14px; border-radius: 16px; font-size: 13.5px; line-height: 1.5; }
    .msg.bot { align-self: flex-start; background: #fff; border: 1px solid #ececf3; border-bottom-left-radius: 4px; }
    .msg.user { align-self: flex-end; background: var(--brace-primary, #6d5ef8); color: #fff; border-bottom-right-radius: 4px; }
    .msg p { margin: 0 0 6px; }
    .msg p:last-child { margin-bottom: 0; }
    .msg ul, .msg ol { margin: 2px 0 6px; padding-left: 18px; }
    .msg ul:last-child, .msg ol:last-child { margin-bottom: 0; }
    .msg li { margin-bottom: 3px; }
    .msg strong { font-weight: 700; }
    .msg a { color: var(--brace-primary, #6d5ef8); font-weight: 600; }
    .msg.bot a { color: var(--brace-primary, #6d5ef8); }
    .msg .sources { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
    .msg .sources a { font-size: 12px; text-decoration: none; }
    .msg .take-btn {
      align-self: flex-start; margin-top: 2px;
      background: var(--brace-primary, #6d5ef8); color: #fff; border: none; cursor: pointer;
      border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 600;
      transition: transform 0.15s ease;
    }
    .msg .take-btn:hover { transform: translateX(2px); }
    .msg .take-btn:focus-visible { outline: 2px solid #14132b; outline-offset: 2px; }

    .typing { align-self: flex-start; display: flex; gap: 4px; padding: 12px 16px; background: #fff; border: 1px solid #ececf3; border-radius: 16px; border-bottom-left-radius: 4px; }
    .typing span { width: 6px; height: 6px; border-radius: 50%; background: #c6c6d4; animation: tbounce 1s infinite; }
    .typing span:nth-child(2) { animation-delay: 0.15s; }
    .typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes tbounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }

    .input-row { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #ececf3; background: #fff; }
    .input-row input {
      flex: 1; border: 1px solid #e2e2ec; border-radius: 999px; padding: 10px 14px;
      font-size: 13.5px; outline: none;
    }
    .input-row input:focus { border-color: var(--brace-primary, #6d5ef8); }
    .input-row button {
      background: var(--brace-primary, #6d5ef8); color: #fff; border: none;
      width: 38px; height: 38px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: transform 0.15s ease;
    }
    .input-row button:hover:not(:disabled) { transform: scale(1.08); }
    .input-row button:disabled { opacity: 0.5; cursor: default; }
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
      style.textContent = PANEL_STYLES + this._positionCSS(side);
      root.appendChild(style);
      this.style.setProperty("--brace-primary", primary);
      this.style.setProperty("--brace-primary-dark", this._darken(primary));

      root.innerHTML += `
        <div class="panel">
          <div class="panel-header">
            <div class="avatar"></div>
            <div>
              <div class="title">Brace</div>
              <div class="subtitle">Ask about ${this.siteName}</div>
            </div>
            <button class="close-btn" aria-label="Close">✕</button>
          </div>
          <div class="messages"></div>
          <div class="input-row">
            <input type="text" placeholder="Type your question…" />
            <button class="send-btn" aria-label="Send">➤</button>
          </div>
        </div>
      `;

      this.$panel = root.querySelector(".panel");
      this.$messages = root.querySelector(".messages");
      this.$input = root.querySelector("input");
      this.$send = root.querySelector(".send-btn");

      root.querySelector(".close-btn").addEventListener("click", () => this.toggle(false));
      this.$send.addEventListener("click", () => this._submit());
      this.$input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this._submit();
      });

      const [gsap, BraceMascot, Guide] = await Promise.all([loadGSAP(), loadMascotLib(), loadGuideLib()]);
      this._guide = Guide;

      if (BraceMascot) {
        this._mascot = BraceMascot.create(root, {
          gsap,
          side,
          label: `Open ${this.siteName} assistant`,
        });
        this.$launcher = this._mascot.el;
        root.querySelector(".avatar").innerHTML = BraceMascot.SVG;
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
        saved.log.forEach((m) => this._addMessage(m.role, m.text, m.sources));
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
      const rule = side === "left" ? "left: 24px;" : "right: 24px;";
      return `
        .panel { bottom: 130px; ${rule} }
        .fallback-launcher { bottom: 22px; ${rule} }
      `;
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
      this._open = opening;
      if (opening) {
        await this._mascot.open();
        this.$panel.classList.add("open");
        this.$input.focus();
      } else {
        this.$panel.classList.remove("open");
        this._mascot.close();
      }
    }

    _addMessage(role, text, sources) {
      this._log.push({ role, text, sources: sources || null });
      this._persist();
      const div = document.createElement("div");
      div.className = `msg ${role}`;
      div.innerHTML = role === "bot" ? mdToHtml(text) : escapeHtml(text);
      if (sources && sources.length) {
        const box = document.createElement("div");
        box.className = "sources";
        // the best match gets the big button; every source link takes the same guided route
        const take = document.createElement("button");
        take.className = "take-btn";
        take.type = "button";
        take.textContent = "Take me there \u2192";
        take.addEventListener("click", () => this._goTo(sources[0]));
        box.appendChild(take);
        sources.forEach((s) => {
          const a = document.createElement("a");
          a.href = s.url;
          a.textContent = "\u2192 " + (s.title || s.url) + (s.heading ? " \u00b7 " + s.heading : "");
          a.addEventListener("click", (e) => {
            e.preventDefault();
            this._goTo(s);
          });
          box.appendChild(a);
        });
        div.appendChild(box);
      }
      this.$messages.appendChild(div);
      this.$messages.scrollTop = this.$messages.scrollHeight;
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
      this.$panel.classList.remove("open");
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

    async _submit() {
      const text = this.$input.value.trim();
      if (!text) return;
      this.$input.value = "";
      this.$input.disabled = true;
      this.$send.disabled = true;
      this._lastQuestion = text;
      this.history.push({ role: "user", content: text });
      this._addMessage("user", text);
      this._mascot.thinking(true);

      const typing = document.createElement("div");
      typing.className = "typing";
      typing.innerHTML = "<span></span><span></span><span></span>";
      this.$messages.appendChild(typing);
      this.$messages.scrollTop = this.$messages.scrollHeight;

      try {
        const res = await fetch(this.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history: this.history.slice(-8) }),
        });
        const data = await res.json();
        typing.remove();
        const answer = data.answer || "Sorry, I couldn't find an answer to that.";
        this.history.push({ role: "assistant", content: answer });
        this._addMessage("bot", answer, data.sources);
        this._mascot.happy();
      } catch (err) {
        typing.remove();
        this._addMessage("bot", "I'm having trouble reaching the server right now — please try again in a moment.");
        this._mascot.thinking(false);
      } finally {
        this.$input.disabled = false;
        this.$send.disabled = false;
        this.$input.focus();
      }
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
