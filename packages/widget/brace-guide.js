/**
 * BraceGuide — "take me there". Remembers the conversation across a page change,
 * then on the destination page finds the exact spot an answer came from, scrolls to it
 * and spotlights it.
 *
 * Loaded lazily by brace-widget.js (same directory). Plain classic script, no deps.
 *   BraceGuide.save(state)        // before navigating: { log, history, landing }
 *   BraceGuide.restore()          // on load: the saved state, or null (expired / none)
 *   BraceGuide.clearLanding()
 *   BraceGuide.locate(target)     // → Element | null   target: { anchor, heading, snippet }
 *   BraceGuide.spotlight(root, el, { label, onBack })  // draws into the widget's shadow root
 *   BraceGuide.samePage(url)      // true when url is this page (ignoring hash/query order)
 *
 * Finding the spot, most to least reliable:
 *   1. anchor  — element with that id (or <a name>)
 *   2. heading — an h1–h6 whose text matches
 *   3. snippet — the smallest block element whose text contains the snippet
 * Matching ignores case and ALL whitespace, because the crawler joins block elements
 * with spaces that a browser's textContent does not have.
 */
(function (global) {
  "use strict";

  var KEY = "brace:session:v1";
  var MAX_AGE_MS = 30 * 60 * 1000; // a conversation older than this starts fresh
  var reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function storage() {
    try { return global.sessionStorage; } catch (_) { return null; } // blocked in some privacy modes
  }

  function save(state) {
    var s = storage();
    if (!s) return false;
    try {
      s.setItem(KEY, JSON.stringify({ at: Date.now(), log: state.log || [], history: state.history || [], landing: state.landing || null }));
      return true;
    } catch (_) { return false; }
  }

  function restore() {
    var s = storage();
    if (!s) return null;
    try {
      var data = JSON.parse(s.getItem(KEY) || "null");
      if (!data || Date.now() - data.at > MAX_AGE_MS) { s.removeItem(KEY); return null; }
      return data;
    } catch (_) { return null; }
  }

  function clearLanding() {
    var data = restore();
    if (!data) return;
    data.landing = null;
    save(data);
  }

  function norm(t) { return (t || "").toLowerCase().replace(/\s+/g, ""); }

  function samePage(url) {
    try {
      var a = new URL(url, global.location.href), b = global.location;
      return a.origin === b.origin && a.pathname.replace(/\/$/, "") === b.pathname.replace(/\/$/, "");
    } catch (_) { return false; }
  }

  function visible(el) {
    if (!el || !el.getClientRects().length) return false;
    var st = global.getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none";
  }

  function byAnchor(anchor) {
    if (!anchor) return null;
    var el = document.getElementById(anchor) || document.getElementsByName(anchor)[0] || null;
    return visible(el) ? el : null;
  }

  function byHeading(heading) {
    if (!heading) return null;
    var want = norm(heading);
    var hs = document.querySelectorAll("h1,h2,h3,h4,h5,h6");
    for (var i = 0; i < hs.length; i++) if (norm(hs[i].textContent) === want && visible(hs[i])) return hs[i];
    return null;
  }

  function bySnippet(snippet) {
    if (!snippet) return null;
    // try the whole snippet, then its first 6 words (chunk edges can straddle elements)
    var tries = [snippet, snippet.split(/\s+/).slice(0, 6).join(" ")];
    var blocks = document.body.querySelectorAll("p,li,td,th,dd,dt,blockquote,pre,figcaption,h1,h2,h3,h4,h5,h6,section,article,div");
    for (var t = 0; t < tries.length; t++) {
      var want = norm(tries[t]);
      if (want.length < 12) continue;
      var best = null, bestLen = Infinity;
      for (var i = 0; i < blocks.length; i++) {
        var txt = norm(blocks[i].textContent);
        if (txt.length < bestLen && txt.indexOf(want) !== -1 && visible(blocks[i])) { best = blocks[i]; bestLen = txt.length; }
      }
      if (best) return best;
    }
    return null;
  }

  function locate(target) {
    target = target || {};
    return byAnchor(target.anchor) || byHeading(target.heading) || bySnippet(target.snippet);
  }

  // A heading alone is a thin target: spotlight it together with the content that
  // follows it, up to the next heading of the same or higher level (max 6 siblings).
  function region(el) {
    var m = /^H([1-6])$/.exec(el.tagName);
    if (!m) return [el];
    var level = +m[1], out = [el], n = el.nextElementSibling;
    while (n && out.length < 7) {
      var hm = /^H([1-6])$/.exec(n.tagName);
      if (hm && +hm[1] <= level) break;
      out.push(n);
      n = n.nextElementSibling;
    }
    return out;
  }

  function unionRect(els) {
    var r = null;
    els.forEach(function (e) {
      var b = e.getBoundingClientRect();
      if (!b.width && !b.height) return;
      r = r ? { top: Math.min(r.top, b.top), left: Math.min(r.left, b.left), bottom: Math.max(r.bottom, b.bottom), right: Math.max(r.right, b.right) }
            : { top: b.top, left: b.left, bottom: b.bottom, right: b.right };
    });
    return r;
  }

  var CSS = [
    ".bg-spot{position:fixed;z-index:999998;pointer-events:none;border-radius:14px;",
    "  box-shadow:0 0 0 3px var(--brace-primary,#6d5ef8),0 0 0 9999px rgba(20,19,43,0);",
    "  transition:box-shadow .5s ease,opacity .4s ease;opacity:0}",
    ".bg-spot.on{opacity:1;box-shadow:0 0 0 3px var(--brace-primary,#6d5ef8),0 0 0 9999px rgba(20,19,43,.38)}",
    ".bg-spot.on.settled{box-shadow:0 0 0 3px var(--brace-primary,#6d5ef8),0 0 0 9999px rgba(20,19,43,0)}",
    ".bg-spot.pulse{animation:bgPulse 1.2s ease-out 2}",
    "@keyframes bgPulse{0%{outline:0 solid var(--brace-primary,#6d5ef8);outline-offset:0}100%{outline:10px solid transparent;outline-offset:6px}}",
    ".bg-tag{position:fixed;z-index:999999;display:flex;align-items:center;gap:8px;max-width:min(420px,calc(100vw - 24px));",
    "  background:#fff;color:#14132b;border-radius:12px;padding:8px 8px 8px 12px;box-shadow:0 10px 30px rgba(20,19,43,.25);",
    "  font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;opacity:0;transform:translateY(6px);",
    "  transition:opacity .3s ease,transform .3s cubic-bezier(.34,1.56,.64,1)}",
    ".bg-tag.on{opacity:1;transform:none}",
    ".bg-tag .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".bg-tag .t b{font-weight:700}",
    ".bg-tag button{border:0;cursor:pointer;border-radius:999px;font-family:inherit;font-weight:600;font-size:12px;line-height:1;padding:7px 10px}",
    ".bg-tag .back{background:var(--brace-primary,#6d5ef8);color:#fff}",
    ".bg-tag .x{background:#f0f0f6;color:#14132b;width:26px;height:26px;padding:0}",
    ".bg-tag button:focus-visible{outline:2px solid #14132b;outline-offset:2px}",
  ].join("\n");

  var active = null;

  /** Scroll to `el`, dim the page around it for a moment, keep a ring + label on it. */
  function spotlight(root, el, opts) {
    opts = opts || {};
    if (active) active.dismiss();
    if (!root.querySelector("style[data-bg]")) {
      var st = document.createElement("style");
      st.setAttribute("data-bg", "");
      st.textContent = CSS;
      root.appendChild(st);
    }
    var els = region(el);
    var spot = document.createElement("div");
    spot.className = "bg-spot";
    var tag = document.createElement("div");
    tag.className = "bg-tag";
    tag.setAttribute("role", "status");
    tag.innerHTML = '<span class="t"></span><button class="back" type="button">Back to chat</button><button class="x" type="button" aria-label="Dismiss">\u2715</button>';
    tag.querySelector(".t").innerHTML = "<b>Here it is</b> \u2014 " + escapeHtml(opts.label || "");
    root.appendChild(spot);
    root.appendChild(tag);

    var raf = 0, alive = true;
    function place() {
      if (!alive) return;
      var r = unionRect(els);
      if (r) {
        var pad = 8;
        spot.style.top = r.top - pad + "px";
        spot.style.left = r.left - pad + "px";
        spot.style.width = r.right - r.left + pad * 2 + "px";
        spot.style.height = r.bottom - r.top + pad * 2 + "px";
        var th = tag.offsetHeight || 42;
        var top = r.top - pad - th - 10;
        if (top < 8) top = r.bottom + pad + 10; // no room above: sit below
        tag.style.top = top + "px";
        tag.style.left = Math.max(12, Math.min(r.left - pad, global.innerWidth - tag.offsetWidth - 12)) + "px";
      }
      raf = global.requestAnimationFrame(place); // follows scrolling, sticky headers, reflow
    }

    function dismiss() {
      if (!alive) return;
      alive = false;
      global.cancelAnimationFrame(raf);
      spot.classList.remove("on");
      tag.classList.remove("on");
      global.removeEventListener("keydown", onKey);
      setTimeout(function () { spot.remove(); tag.remove(); }, 400);
      if (active && active.dismiss === dismiss) active = null;
    }
    function onKey(e) { if (e.key === "Escape") dismiss(); }

    tag.querySelector(".x").addEventListener("click", dismiss);
    tag.querySelector(".back").addEventListener("click", function () { dismiss(); if (opts.onBack) opts.onBack(); });
    global.addEventListener("keydown", onKey);

    // scroll so the target sits in the upper third, not glued to the top edge
    var r0 = unionRect(els) || el.getBoundingClientRect();
    var y = global.scrollY + r0.top - Math.max(80, global.innerHeight * 0.28);
    global.scrollTo({ top: Math.max(0, y), behavior: reduce ? "auto" : "smooth" });

    place();
    setTimeout(function () {
      if (!alive) return;
      spot.classList.add("on");
      tag.classList.add("on");
      if (!reduce) spot.classList.add("pulse");
    }, reduce ? 0 : 450);
    // the dim is a moment of focus, not a modal: lift it and leave the ring
    setTimeout(function () { if (alive) spot.classList.add("settled"); }, reduce ? 1200 : 2600);
    // and the ring itself goes after a while, unless the visitor dismissed it first
    setTimeout(dismiss, 15000);

    active = { dismiss: dismiss };
    return active;
  }

  function escapeHtml(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  global.BraceGuide = { save: save, restore: restore, clearLanding: clearLanding, locate: locate, spotlight: spotlight, samePage: samePage };
})(window);
