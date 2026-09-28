/**
 * Brace — self-contained chat widget. The mascot hides below the bottom edge of the
 * page and peeks over it; clicking pops it fully into view.
 * Include via: <script src="brace-widget.js" data-api-url="/api/brace/chat" defer></script>
 * Auto-mounts a <brace-widget> element from the script tag's data-* attributes.
 * Ships as a Web Component with Shadow DOM so host-page CSS never leaks in or out.
 * Uses the vendored GSAP (packages/widget/vendor/gsap.min.js, loaded lazily, same
 * directory as this file) for the pop animation, with a pure-CSS fallback if that
 * fails to load for any reason — the widget never depends on it to function.
 */
(function () {
  const TAG = "brace-widget";
  if (customElements.get(TAG)) return;

  // The launcher sits `bottom: 22px` clear of the page edge, so hiding it requires
  // translating past that gap *plus* however much of the button should go off-screen —
  // not just the hidden amount on its own.
  const HIDE_Y = 56; // rest: closes the 22px gap + pushes ~34px of the button off-screen (shows top ~50px: eyes + head)
  const TEASE_Y = 42; // idle tease: peeks up further, revealing the smile too
  const OPEN_Y = 0; // fully popped up, back at its natural bottom:22px position

  const MASCOT_SVG = `
    <svg viewBox="0 0 100 100" class="brace-mascot" aria-hidden="true">
      <ellipse class="brace-body" cx="50" cy="55" rx="34" ry="30" />
      <circle class="brace-eye" cx="38" cy="52" r="5" />
      <circle class="brace-eye" cx="62" cy="52" r="5" />
      <path class="brace-mouth" d="M 40 66 Q 50 72 60 66" />
      <circle class="brace-cheek" cx="30" cy="60" r="4" />
      <circle class="brace-cheek" cx="70" cy="60" r="4" />
    </svg>`;

  const STYLES = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

    .launcher {
      position: fixed;
      width: 84px; height: 84px;
      border-radius: 50%;
      background: linear-gradient(160deg, var(--brace-primary, #6d5ef8), var(--brace-primary-dark, #4b3ff0));
      box-shadow: 0 10px 26px rgba(0,0,0,0.28);
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      z-index: 999999;
      padding: 10px;
      transform: translateY(${HIDE_Y}px);
    }
    .launcher:hover { filter: brightness(1.05); }

    .launcher.peeking { animation: peekTease 4.5s ease-in-out infinite; }
    @keyframes peekTease {
      0%, 60%, 100% { transform: translateY(${HIDE_Y}px); }
      80% { transform: translateY(${TEASE_Y}px); }
    }

    .launcher::before {
      content: ""; position: absolute; inset: -8px; border-radius: 50%;
      background: var(--brace-primary, #6d5ef8); opacity: 0.3; z-index: -1;
      animation: pulseRing 2.6s ease-out infinite;
    }
    .launcher.chat-open::before { display: none; }
    @keyframes pulseRing {
      0% { transform: scale(0.82); opacity: 0.4; }
      100% { transform: scale(1.4); opacity: 0; }
    }

    .brace-mascot { width: 100%; height: 100%; overflow: visible; }
    .brace-body { fill: #ffffff; }
    .brace-eye { fill: var(--brace-primary, #6d5ef8); transform-origin: center; }
    .brace-mouth { stroke: var(--brace-primary, #6d5ef8); stroke-width: 3; fill: none; stroke-linecap: round; }
    .brace-cheek { fill: var(--brace-primary, #6d5ef8); opacity: 0.25; }

    .launcher.thinking .brace-eye { animation: blink 0.9s ease-in-out infinite; }
    @keyframes blink { 0%, 80%, 100% { transform: scaleY(1); } 90% { transform: scaleY(0.15); } }

    .launcher.happy .brace-mascot { animation: happyBounce 0.5s ease; }
    @keyframes happyBounce {
      0% { transform: scale(1); }
      35% { transform: scale(0.88, 1.15); }
      60% { transform: scale(1.1, 0.9); }
      100% { transform: scale(1); }
    }

    .badge {
      position: absolute; top: 6px; right: 6px;
      width: 14px; height: 14px; border-radius: 50%;
      background: #34d399; border: 2px solid white;
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
    .panel-header .avatar { width: 34px; height: 34px; }
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

  // --- lazy-load the vendored animation library; the widget works fine without it ---
  const SCRIPT_URL = document.currentScript ? document.currentScript.src : "";
  const BASE_URL = SCRIPT_URL.replace(/[^/]+$/, "");
  function loadGSAP() {
    if (window.gsap) return Promise.resolve(window.gsap);
    if (!window.__braceGsapLoad) {
      window.__braceGsapLoad = new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = BASE_URL + "vendor/gsap.min.js";
        s.onload = () => resolve(window.gsap || null);
        s.onerror = () => resolve(null);
        document.head.appendChild(s);
      });
    }
    return window.__braceGsapLoad;
  }

  class BraceWidget extends HTMLElement {
    connectedCallback() {
      this.apiUrl = this.getAttribute("api-url") || "/api/brace/chat";
      this.position = this.getAttribute("position") || "bottom-right";
      this.greeting = this.getAttribute("greeting") || "Hi! Ask me anything about this site — I can find the right page for you.";
      this.siteName = this.getAttribute("site-name") || "this site";
      const primary = this.getAttribute("primary-color") || "#6d5ef8";

      this.history = [];
      this._open = false;
      loadGSAP(); // kick off in the background; never block on it

      const root = this.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = STYLES + this._positionCSS();
      root.appendChild(style);
      this.style.setProperty("--brace-primary", primary);
      this.style.setProperty("--brace-primary-dark", this._darken(primary));

      root.innerHTML += `
        <button class="launcher peeking" part="launcher" aria-label="Open ${this.siteName} assistant">
          ${MASCOT_SVG}
          <span class="badge"></span>
        </button>
        <div class="panel">
          <div class="panel-header">
            <div class="avatar">${MASCOT_SVG}</div>
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

      this.$launcher = root.querySelector(".launcher");
      this.$panel = root.querySelector(".panel");
      this.$messages = root.querySelector(".messages");
      this.$input = root.querySelector("input");
      this.$send = root.querySelector(".send-btn");

      this.$launcher.addEventListener("click", () => this.toggle());
      root.querySelector(".close-btn").addEventListener("click", () => this.toggle(false));
      this.$send.addEventListener("click", () => this._submit());
      this.$input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this._submit();
      });

      this._addMessage("bot", this.greeting);
    }

    _positionCSS() {
      const isRight = this.position.includes("right");
      const side = isRight ? "right: 22px;" : "left: 22px;";
      return `
        .launcher { bottom: 22px; ${side} }
        .panel { bottom: 116px; ${side} }
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

    // Pops the mascot fully into view (or lets it duck back down to peeking), via
    // GSAP if it loaded in time, falling back to a plain CSS transition otherwise.
    _animateLauncher(open) {
      const el = this.$launcher;
      const gsap = window.gsap;
      if (open) {
        el.classList.remove("peeking");
        el.classList.add("chat-open");
      }
      if (gsap) {
        gsap.killTweensOf(el);
        gsap.to(el, {
          y: open ? OPEN_Y : HIDE_Y,
          duration: open ? 0.6 : 0.4,
          ease: open ? "back.out(1.7)" : "power2.in",
          onComplete: () => {
            if (!open) {
              gsap.set(el, { clearProps: "transform" });
              el.classList.remove("chat-open");
              el.classList.add("peeking");
            }
          },
        });
      } else {
        el.style.transition = `transform ${open ? "0.55s" : "0.4s"} cubic-bezier(0.34,1.56,0.64,1)`;
        el.style.transform = `translateY(${open ? OPEN_Y : HIDE_Y}px)`;
        if (!open) {
          setTimeout(() => {
            el.style.transition = "";
            el.style.transform = "";
            el.classList.remove("chat-open");
            el.classList.add("peeking");
          }, 420);
        }
      }
    }

    toggle(force) {
      this._open = force !== undefined ? force : !this._open;
      this.$panel.classList.toggle("open", this._open);
      this._animateLauncher(this._open);
      if (this._open) this.$input.focus();
    }

    _addMessage(role, text, sources) {
      const div = document.createElement("div");
      div.className = `msg ${role}`;
      div.innerHTML = role === "bot" ? mdToHtml(text) : escapeHtml(text);
      if (sources && sources.length) {
        const box = document.createElement("div");
        box.className = "sources";
        sources.forEach((s) => {
          const a = document.createElement("a");
          a.href = s.url;
          a.textContent = "→ " + (s.title || s.url);
          a.addEventListener("click", (e) => {
            e.preventDefault();
            this._navigate(s.url);
          });
          box.appendChild(a);
        });
        div.appendChild(box);
      }
      this.$messages.appendChild(div);
      this.$messages.scrollTop = this.$messages.scrollHeight;
    }

    _navigate(url) {
      try {
        const target = new URL(url, window.location.href);
        if (target.origin === window.location.origin) {
          window.location.href = target.href;
        } else {
          window.open(target.href, "_blank", "noopener");
        }
      } catch (_) {
        window.open(url, "_blank", "noopener");
      }
    }

    async _submit() {
      const text = this.$input.value.trim();
      if (!text) return;
      this.$input.value = "";
      this.$input.disabled = true;
      this.$send.disabled = true;
      this._addMessage("user", text);
      this.history.push({ role: "user", content: text });
      this.$launcher.classList.remove("happy");
      this.$launcher.classList.add("thinking");

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
        this._addMessage("bot", answer, data.sources);
        this.history.push({ role: "assistant", content: answer });
        this.$launcher.classList.remove("thinking");
        this.$launcher.classList.add("happy");
        setTimeout(() => this.$launcher.classList.remove("happy"), 600);
      } catch (err) {
        typing.remove();
        this._addMessage("bot", "I'm having trouble reaching the server right now — please try again in a moment.");
        this.$launcher.classList.remove("thinking");
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
