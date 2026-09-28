/**
 * Scout — self-contained, dependency-free chat widget.
 * Include via: <script src="scout-widget.js" data-api-url="/api/scout/chat" defer></script>
 * Auto-mounts a <scout-widget> element from the script tag's data-* attributes.
 * Ships as a Web Component with Shadow DOM so host-page CSS never leaks in or out.
 */
(function () {
  const TAG = "scout-widget";
  if (customElements.get(TAG)) return;

  const MASCOT_SVG = `
    <svg viewBox="0 0 100 100" class="scout-mascot" aria-hidden="true">
      <ellipse class="scout-body" cx="50" cy="55" rx="34" ry="30" />
      <circle class="scout-eye" cx="38" cy="52" r="5" />
      <circle class="scout-eye" cx="62" cy="52" r="5" />
      <path class="scout-mouth" d="M 40 66 Q 50 72 60 66" />
      <circle class="scout-cheek" cx="30" cy="60" r="4" />
      <circle class="scout-cheek" cx="70" cy="60" r="4" />
    </svg>`;

  const STYLES = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

    .launcher {
      position: fixed;
      width: 62px; height: 62px;
      border-radius: 50%;
      background: linear-gradient(160deg, var(--scout-primary, #6d5ef8), var(--scout-primary-dark, #4b3ff0));
      box-shadow: 0 6px 20px rgba(0,0,0,0.22);
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      z-index: 999999;
      transition: transform 0.2s ease;
      padding: 8px;
    }
    .launcher:hover { transform: scale(1.06); }
    .launcher:active { transform: scale(0.96); }

    .scout-mascot { width: 100%; height: 100%; }
    .scout-body { fill: #ffffff; }
    .scout-eye { fill: var(--scout-primary, #6d5ef8); transform-origin: center; }
    .scout-mouth { stroke: var(--scout-primary, #6d5ef8); stroke-width: 3; fill: none; stroke-linecap: round; }
    .scout-cheek { fill: var(--scout-primary, #6d5ef8); opacity: 0.25; }

    .launcher.idle .scout-mascot { animation: breathe 3.2s ease-in-out infinite; }
    @keyframes breathe {
      0%, 100% { transform: translateY(0) scale(1); }
      50% { transform: translateY(-3px) scale(1.03); }
    }

    .launcher.thinking .scout-eye { animation: blink 0.9s ease-in-out infinite; }
    @keyframes blink { 0%, 80%, 100% { transform: scaleY(1); } 90% { transform: scaleY(0.15); } }

    .launcher.happy .scout-mascot { animation: bounce 0.5s ease; }
    @keyframes bounce {
      0% { transform: scale(1); }
      35% { transform: scale(0.88, 1.15); }
      60% { transform: scale(1.1, 0.9); }
      100% { transform: scale(1); }
    }

    .badge {
      position: absolute; top: -2px; right: -2px;
      width: 14px; height: 14px; border-radius: 50%;
      background: #34d399; border: 2px solid white;
    }

    .panel {
      position: fixed;
      width: 360px; max-width: calc(100vw - 32px);
      height: 520px; max-height: calc(100vh - 120px);
      background: #fff;
      border-radius: 18px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.25);
      display: flex; flex-direction: column;
      overflow: hidden;
      z-index: 999999;
      opacity: 0; transform: translateY(16px) scale(0.98);
      pointer-events: none;
      transition: opacity 0.18s ease, transform 0.18s ease;
    }
    .panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

    .panel-header {
      background: linear-gradient(160deg, var(--scout-primary, #6d5ef8), var(--scout-primary-dark, #4b3ff0));
      color: #fff; padding: 14px 16px;
      display: flex; align-items: center; gap: 10px;
    }
    .panel-header .avatar { width: 34px; height: 34px; }
    .panel-header .title { font-weight: 600; font-size: 15px; }
    .panel-header .subtitle { font-size: 12px; opacity: 0.85; }
    .close-btn {
      margin-left: auto; background: rgba(255,255,255,0.18); border: none; color: #fff;
      width: 26px; height: 26px; border-radius: 50%; cursor: pointer; font-size: 14px;
    }

    .messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; background: #f7f7fb; }
    .msg { max-width: 82%; padding: 9px 13px; border-radius: 14px; font-size: 13.5px; line-height: 1.45; }
    .msg.bot { align-self: flex-start; background: #fff; border: 1px solid #ececf3; border-bottom-left-radius: 4px; }
    .msg.user { align-self: flex-end; background: var(--scout-primary, #6d5ef8); color: #fff; border-bottom-right-radius: 4px; }
    .msg a { color: var(--scout-primary, #6d5ef8); font-weight: 600; }
    .msg.bot a { color: var(--scout-primary, #6d5ef8); }
    .msg .sources { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
    .msg .sources a { font-size: 12px; text-decoration: none; }

    .typing { align-self: flex-start; display: flex; gap: 4px; padding: 10px 14px; }
    .typing span { width: 6px; height: 6px; border-radius: 50%; background: #c6c6d4; animation: tbounce 1s infinite; }
    .typing span:nth-child(2) { animation-delay: 0.15s; }
    .typing span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes tbounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-4px); } }

    .input-row { display: flex; gap: 8px; padding: 10px; border-top: 1px solid #ececf3; background: #fff; }
    .input-row input {
      flex: 1; border: 1px solid #e2e2ec; border-radius: 999px; padding: 10px 14px;
      font-size: 13.5px; outline: none;
    }
    .input-row input:focus { border-color: var(--scout-primary, #6d5ef8); }
    .input-row button {
      background: var(--scout-primary, #6d5ef8); color: #fff; border: none;
      width: 38px; height: 38px; border-radius: 50%; cursor: pointer;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .input-row button:disabled { opacity: 0.5; cursor: default; }
  `;

  class ScoutWidget extends HTMLElement {
    connectedCallback() {
      this.apiUrl = this.getAttribute("api-url") || "/api/scout/chat";
      this.position = this.getAttribute("position") || "bottom-right";
      this.greeting = this.getAttribute("greeting") || "Hi! Ask me anything about this site — I can find the right page for you.";
      this.siteName = this.getAttribute("site-name") || "this site";
      const primary = this.getAttribute("primary-color") || "#6d5ef8";

      this.history = [];
      this._open = false;

      const root = this.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = STYLES + this._positionCSS();
      root.appendChild(style);
      // Custom properties are set on the host element (not the ShadowRoot, which has
      // no .style of its own) — they inherit into the shadow tree from there.
      this.style.setProperty("--scout-primary", primary);
      this.style.setProperty("--scout-primary-dark", this._darken(primary));

      root.innerHTML += `
        <button class="launcher idle" part="launcher" aria-label="Open ${this.siteName} assistant">
          ${MASCOT_SVG}
          <span class="badge"></span>
        </button>
        <div class="panel">
          <div class="panel-header">
            <div class="avatar">${MASCOT_SVG}</div>
            <div>
              <div class="title">Scout</div>
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
        .panel { bottom: 96px; ${side} }
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

    toggle(force) {
      this._open = force !== undefined ? force : !this._open;
      this.$panel.classList.toggle("open", this._open);
      if (this._open) this.$input.focus();
    }

    _addMessage(role, text, sources) {
      const div = document.createElement("div");
      div.className = `msg ${role}`;
      div.innerHTML = this._escape(text);
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

    _escape(str) {
      const d = document.createElement("div");
      d.textContent = str;
      return d.innerHTML;
    }

    async _submit() {
      const text = this.$input.value.trim();
      if (!text) return;
      this.$input.value = "";
      this.$input.disabled = true;
      this.$send.disabled = true;
      this._addMessage("user", text);
      this.history.push({ role: "user", content: text });
      this.$launcher.classList.remove("idle", "happy");
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
        setTimeout(() => this.$launcher.classList.replace("happy", "idle"), 600);
      } catch (err) {
        typing.remove();
        this._addMessage("bot", "I'm having trouble reaching the server right now — please try again in a moment.");
        this.$launcher.classList.remove("thinking");
        this.$launcher.classList.add("idle");
      } finally {
        this.$input.disabled = false;
        this.$send.disabled = false;
        this.$input.focus();
      }
    }
  }

  customElements.define(TAG, ScoutWidget);

  // Auto-mount from the including <script>'s data-* attributes, so a single
  // <script src="scout-widget.js" data-api-url="..."></script> is enough.
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
