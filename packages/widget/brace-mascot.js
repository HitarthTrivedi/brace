/**
 * BraceMascot — the "ledge gremlin". A gummy blob that lives BELOW the viewport edge,
 * hooks its two floating hands over the edge and peeks out. Click it and it climbs out,
 * does a full flip in the air, lands with a squash + dust puff, waves, and hands off to
 * the chat panel.
 *
 * Plain classic script, no build step. Works inside Shadow DOM.
 *   const m = BraceMascot.create(shadowRoot, { gsap: window.gsap, side: "right", label: "Open assistant" });
 *   m.el                       // the <button> (already appended to the root you passed)
 *   await m.open()             // emerge sequence; resolve → show the panel
 *   await m.close()            // duck back below the edge, then peek again
 *   m.thinking(true|false)     // waiting on an answer
 *   m.happy()                  // answer delivered (one-shot)
 *   m.destroy()
 * State is readable as m.state: "idle" | "hover" | "opening" | "open" | "thinking" | "closing".
 *
 * Colour comes only from CSS custom properties on the host:
 *   --brace-primary (body), --brace-primary-dark (shade side), --brace-mascot-ink (pupils/mouth, default #14132b).
 * Without GSAP it degrades to CSS transitions (peek / hover / open positions only).
 */
(function (global) {
  "use strict";

  // Geometry. The SVG is 120×140 units drawn at 96×112 px → 1 unit = 0.8 px.
  var W = 96, H = 112, U = W / 120;
  var PEEK_Y = 42;   // px below rest: tuft + eyes + hands-on-ledge visible (~70px)
  var HOVER_Y = 24;  // px: pulls itself up, mouth shows, hands stay on the ledge
  var HIDE_Y = H + 8; // fully below the edge
  var LEDGE = 20;    // svg units the hands drop to stay on the edge while the body rises (≈16px)

  var SVG =
    '<svg class="bm-svg" viewBox="0 0 120 140" width="' + W + '" height="' + H + '" aria-hidden="true" focusable="false">' +
      '<g class="bm-dust">' +
        '<circle cx="30" cy="136" r="6"/><circle cx="18" cy="132" r="4"/>' +
        '<circle cx="90" cy="136" r="6"/><circle cx="102" cy="132" r="4"/>' +
      '</g>' +
      '<g class="bm-rig">' +
        '<g class="bm-breath">' +
          // tuft: a curly-brace "}" curl — the one nod to the name
          '<path class="bm-tuft" d="M60 32 C60 24 53 22 55 15 C57 8 66 9 65 15 C64.5 18 61 18.5 60.5 16"/>' +
          '<path class="bm-body" d="M60 30 C94 30 108 80 106 116 C105 133 88 140 60 140 C32 140 15 133 14 116 C12 80 26 30 60 30 Z"/>' +
          '<path class="bm-shade" d="M60 30 C86 38 97 82 94 118 C92 131 82 138 68 140 C90 139 105 132 106 116 C108 80 94 30 60 30 Z"/>' +
          '<ellipse class="bm-shine" cx="38" cy="46" rx="10" ry="5" transform="rotate(-32 38 46)"/>' +
          '<g class="bm-face">' +
            '<g class="bm-eye bm-eye-l"><circle class="bm-sclera" cx="45" cy="64" r="13"/>' +
              '<g class="bm-pupil"><circle class="bm-iris" cx="45" cy="64" r="6.5"/><circle class="bm-glint" cx="47.6" cy="61.4" r="2.2"/></g></g>' +
            '<g class="bm-eye bm-eye-r"><circle class="bm-sclera" cx="75" cy="64" r="13"/>' +
              '<g class="bm-pupil"><circle class="bm-iris" cx="75" cy="64" r="6.5"/><circle class="bm-glint" cx="77.6" cy="61.4" r="2.2"/></g></g>' +
            '<path class="bm-happy-eye" d="M35 67 Q45 54 55 67"/><path class="bm-happy-eye" d="M65 67 Q75 54 85 67"/>' +
            '<ellipse class="bm-cheek" cx="31" cy="83" rx="6" ry="3.5"/><ellipse class="bm-cheek" cx="89" cy="83" rx="6" ry="3.5"/>' +
            '<path class="bm-mouth bm-mouth-smile" d="M52 86 Q60 93 68 86"/>' +
            '<ellipse class="bm-mouth bm-mouth-o" cx="60" cy="89" rx="4.5" ry="5.5"/>' +
            '<path class="bm-mouth bm-mouth-grin" d="M47 84 Q60 104 73 84 Z"/>' +
            '<path class="bm-mouth bm-mouth-flat" d="M54 89 Q60 87 66 89"/>' +
          '</g>' +
        '</g>' +
        // floating Rayman-style hands, fingers hooked over the ledge
        '<g class="bm-hand bm-hand-l"><ellipse cx="12" cy="86" rx="11" ry="8.5"/>' +
          '<path class="bm-finger" d="M7 80 V86 M12 79 V86 M17 80 V86"/></g>' +
        '<g class="bm-hand bm-hand-r"><ellipse cx="108" cy="86" rx="11" ry="8.5"/>' +
          '<path class="bm-finger" d="M103 80 V86 M108 79 V86 M113 80 V86"/></g>' +
        '<g class="bm-sparks">' +
          '<path d="M10 20 L13 27 L20 30 L13 33 L10 40 L7 33 L0 30 L7 27 Z"/>' +
          '<path d="M104 8 L106 13 L111 15 L106 17 L104 22 L102 17 L97 15 L102 13 Z"/>' +
          '<path d="M112 46 L114 50 L118 52 L114 54 L112 58 L110 54 L106 52 L110 50 Z"/>' +
        '</g>' +
      '</g>' +
    '</svg>';

  var CSS = [
    ".bm-wrap{position:fixed;bottom:0;width:" + W + "px;height:" + H + "px;padding:0;margin:0;border:0;background:none;cursor:pointer;z-index:999999;",
    "  -webkit-tap-highlight-color:transparent;transform:translateY(" + PEEK_Y + "px);outline:none}",
    ".bm-wrap.bm-right{right:24px}.bm-wrap.bm-left{left:24px}",
    ".bm-wrap.bm-left .bm-svg{transform:scaleX(-1)}",
    ".bm-svg{display:block;overflow:visible}",
    ".bm-body,.bm-hand ellipse{fill:var(--brace-primary,#6d5ef8)}",
    ".bm-shade{fill:var(--brace-primary-dark,#4b3ff0)}",
    ".bm-tuft{fill:none;stroke:var(--brace-primary,#6d5ef8);stroke-width:5;stroke-linecap:round;stroke-linejoin:round}",
    ".bm-shine{fill:#fff;opacity:.35}",
    ".bm-sclera{fill:#fff}",
    ".bm-iris{fill:var(--brace-mascot-ink,#14132b)}.bm-glint{fill:#fff}",
    ".bm-happy-eye{fill:none;stroke:var(--brace-mascot-ink,#14132b);stroke-width:4;stroke-linecap:round;opacity:0}",
    ".bm-cheek{fill:#fff;opacity:.28}",
    ".bm-mouth{opacity:0}.bm-mouth-smile{opacity:1}",
    ".bm-mouth-smile,.bm-mouth-flat{fill:none;stroke:var(--brace-mascot-ink,#14132b);stroke-width:3.5;stroke-linecap:round}",
    ".bm-mouth-o,.bm-mouth-grin{fill:var(--brace-mascot-ink,#14132b)}",
    ".bm-hand ellipse{stroke:var(--brace-primary-dark,#4b3ff0);stroke-width:2}",
    ".bm-finger{fill:none;stroke:var(--brace-primary-dark,#4b3ff0);stroke-width:2;stroke-linecap:round}",
    ".bm-dust circle{fill:var(--brace-primary,#6d5ef8);opacity:0}",
    ".bm-sparks path{fill:var(--brace-primary,#6d5ef8);stroke:#fff;stroke-width:1.5;opacity:0}",
    /* keyboard focus: pull up so the ring is on-screen */
    ".bm-wrap:focus-visible{transform:translateY(" + HOVER_Y + "px)}",
    ".bm-wrap:focus-visible .bm-body{stroke:var(--brace-mascot-ink,#14132b);stroke-width:3}",
    /* no-GSAP fallback */
    ".bm-wrap.bm-css{transition:transform .45s cubic-bezier(.34,1.56,.64,1)}",
    ".bm-wrap.bm-css.bm-is-hover{transform:translateY(" + HOVER_Y + "px)}",
    ".bm-wrap.bm-css.bm-is-open{transform:translateY(0)}",
  ].join("\n");

  function create(root, opts) {
    opts = opts || {};
    var gsap = opts.gsap || global.gsap || null;
    var side = opts.side === "left" ? "left" : "right";
    var flip = side === "left" ? -1 : 1;
    var reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!root.querySelector("style[data-bm]")) {
      var st = document.createElement("style");
      st.setAttribute("data-bm", "");
      st.textContent = CSS;
      root.appendChild(st);
    }
    var el = document.createElement("button");
    el.type = "button";
    el.className = "bm-wrap bm-" + side + (gsap ? "" : " bm-css");
    el.setAttribute("aria-label", opts.label || "Open assistant");
    el.setAttribute("part", "launcher");
    el.innerHTML = SVG;
    root.appendChild(el);

    var q = function (s) { return el.querySelector(s); };
    var qa = function (s) { return Array.prototype.slice.call(el.querySelectorAll(s)); };
    var P = {
      rig: q(".bm-rig"), breath: q(".bm-breath"), tuft: q(".bm-tuft"),
      eyes: qa(".bm-eye"), pupils: qa(".bm-pupil"), sclera: qa(".bm-sclera"), happyEyes: qa(".bm-happy-eye"),
      handL: q(".bm-hand-l"), handR: q(".bm-hand-r"), hands: qa(".bm-hand"),
      dust: qa(".bm-dust circle"), sparks: qa(".bm-sparks path"),
      mouth: { smile: q(".bm-mouth-smile"), o: q(".bm-mouth-o"), grin: q(".bm-mouth-grin"), flat: q(".bm-mouth-flat") },
    };

    var api = { el: el, state: "idle" };
    var loops = [];      // idle ambient tweens
    var timers = [];
    var track = true;    // pupils follow the cursor
    var busy = null;     // current one-shot timeline

    function setMouth(name) {
      Object.keys(P.mouth).forEach(function (k) { P.mouth[k].style.opacity = k === name ? 1 : 0; });
    }
    function happyEyes(on) {
      P.eyes.forEach(function (e) { e.style.opacity = on ? 0 : 1; });
      P.happyEyes.forEach(function (e) { e.style.opacity = on ? 1 : 0; });
    }

    // ---------- no-GSAP fallback ----------
    if (!gsap) {
      el.addEventListener("pointerenter", function () { if (api.state === "idle") el.classList.add("bm-is-hover"); });
      el.addEventListener("pointerleave", function () { el.classList.remove("bm-is-hover"); });
      api.open = function () { api.state = "open"; el.classList.add("bm-is-open"); setMouth("grin"); return delay(450); };
      api.close = function () { api.state = "idle"; el.classList.remove("bm-is-open"); setMouth("smile"); return delay(450); };
      api.thinking = function (on) { api.state = on ? "thinking" : "open"; setMouth(on ? "flat" : "smile"); };
      api.happy = function () { happyEyes(true); setMouth("grin"); setTimeout(function () { happyEyes(false); setMouth("smile"); }, 1100); };
      api.destroy = function () { el.remove(); };
      return api;
    }

    gsap.set(el, { y: PEEK_Y });
    gsap.set(P.rig, { svgOrigin: "60 140" });
    gsap.set(P.breath, { svgOrigin: "60 140" });
    gsap.set(P.tuft, { svgOrigin: "60 32" });
    P.eyes.forEach(function (e) { gsap.set(e, { transformOrigin: "50% 50%" }); });

    // ---------- cursor tracking ----------
    var px = gsap.quickTo(P.pupils, "x", { duration: 0.35, ease: "power3" });
    var py = gsap.quickTo(P.pupils, "y", { duration: 0.35, ease: "power3" });
    function onMove(e) {
      if (!track) return;
      var r = el.getBoundingClientRect();
      var dx = (e.clientX - (r.left + r.width / 2)) * flip, dy = e.clientY - (r.top + r.height * 0.45);
      var d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 220) * 4.5;
      px((dx / d) * k); py((dy / d) * k);
    }
    global.addEventListener("pointermove", onMove, { passive: true });
    function lookAt(x, y, dur) { gsap.to(P.pupils, { x: x * flip, y: y, duration: dur || 0.3, ease: "power2.out", overwrite: "auto" }); }

    // ---------- ambient idle life ----------
    function blinkLoop() {
      var t = setTimeout(function () {
        var twice = Math.random() < 0.25;
        gsap.timeline()
          .to(P.eyes, { scaleY: 0.08, duration: 0.07, ease: "power1.in" })
          .to(P.eyes, { scaleY: 1, duration: 0.09, ease: "power1.out" })
          .to(P.eyes, twice ? { scaleY: 0.08, duration: 0.07, delay: 0.08 } : { duration: 0 })
          .to(P.eyes, { scaleY: 1, duration: 0.09 });
        blinkLoop();
      }, 2200 + Math.random() * 3200);
      timers.push(t);
    }
    function peekabooLoop() {
      var t = setTimeout(function () {
        if (api.state === "idle" && !reduce) peekaboo();
        peekabooLoop();
      }, 9000 + Math.random() * 7000);
      timers.push(t);
    }
    function startAmbient() {
      stopAmbient();
      if (reduce) return;
      loops.push(gsap.to(P.breath, { scaleY: 1.03, scaleX: 0.985, duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: -1 }));
      loops.push(gsap.fromTo(P.tuft, { rotation: -10 }, { rotation: 12, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1 }));
    }
    function stopAmbient() { loops.forEach(function (l) { l.kill(); }); loops = []; gsap.set(P.tuft, { rotation: 0, scaleX: 1 }); }
    blinkLoop(); peekabooLoop(); startAmbient();

    // Ducks fully under the edge, holds, then POPS back up somewhere a bit off — eyes huge.
    function peekaboo() {
      var shift = (Math.random() < 0.5 ? -1 : 1) * 10;
      busy = gsap.timeline({ onComplete: function () { busy = null; } })
        .to(el, { y: HIDE_Y, duration: 0.22, ease: "power2.in" })
        .set(el, { x: shift })
        .to({}, { duration: 0.55 })
        .add(function () { setMouth("o"); })
        .to(el, { y: PEEK_Y - 10, duration: 0.28, ease: "back.out(3)" })
        .to(P.eyes, { scale: 1.2, duration: 0.15 }, "<")
        .to(P.tuft, { rotation: 30, duration: 0.5, ease: "elastic.out(1,0.3)" }, "<")
        .to(el, { y: PEEK_Y, x: 0, duration: 0.5, ease: "power2.inOut" }, "+=0.35")
        .to(P.eyes, { scale: 1, duration: 0.3 }, "<")
        .add(function () { setMouth("smile"); });
    }

    // ---------- hover (idle only): pull up, hands stay hooked on the ledge ----------
    function hover(on) {
      if (api.state !== "idle" && api.state !== "hover") return;
      if (busy) { busy.progress(1); }
      api.state = on ? "hover" : "idle";
      gsap.to(el, { y: on ? HOVER_Y : PEEK_Y, x: 0, duration: on ? 0.4 : 0.35, ease: on ? "back.out(2.2)" : "power2.out", overwrite: "auto" });
      gsap.to(P.hands, { y: on ? LEDGE : 0, duration: on ? 0.4 : 0.35, ease: on ? "back.out(2.2)" : "power2.out", overwrite: "auto" });
      gsap.to(P.eyes, { scale: on ? 1.14 : 1, duration: 0.25, overwrite: "auto" });
      if (on) gsap.fromTo(P.tuft, { rotation: -25 }, { rotation: 0, duration: 0.9, ease: "elastic.out(1.2,0.25)" });
      setMouth(on ? "o" : "smile");
    }
    el.addEventListener("pointerenter", function () { hover(true); });
    el.addEventListener("pointerleave", function () { hover(false); });
    el.addEventListener("focus", function () { if (el.matches(":focus-visible")) hover(true); });
    el.addEventListener("blur", function () { hover(false); });

    // ---------- open: climb out → flip → land → wave ----------
    api.open = function () {
      if (api.state === "open" || api.state === "opening" || api.state === "thinking") return Promise.resolve();
      if (busy) busy.kill();
      api.state = "opening"; track = false;
      return new Promise(function (resolve) {
        if (reduce) {
          busy = gsap.timeline({ onComplete: done })
            .to(el, { y: 0, x: 0, duration: 0.3, ease: "power2.out" })
            .to(P.hands, { y: 30, x: function (i) { return i ? 4 : -4; }, duration: 0.3 }, "<");
          return;
        }
        setMouth("o");
        busy = gsap.timeline({ onComplete: done })
          // 1. anticipation: squash onto the ledge, eyes pop
          .to(P.rig, { scaleY: 0.78, scaleX: 1.16, duration: 0.16, ease: "power2.in" })
          .to(el, { y: "+=8", duration: 0.16, ease: "power2.in" }, "<")
          .to(P.eyes, { scale: 1.3, duration: 0.12 }, "<")
          .to(P.hands, { y: LEDGE + 6, duration: 0.16 }, "<")
          // 2. launch: stretch + shoot up past rest, full flip in the air
          .to(el, { y: -58, x: 0, duration: 0.36, ease: "power3.out" })
          .to(P.rig, { scaleY: 1.2, scaleX: 0.86, duration: 0.14, ease: "power2.out" }, "<")
          .to(P.rig, { scaleY: 1, scaleX: 1, duration: 0.2 }, ">")
          .to(P.rig, { rotation: 360 * flip, duration: 0.55, ease: "power2.inOut", svgOrigin: "60 84" }, "<-0.2")
          .to(P.handL, { y: -34, x: -10, rotation: -40, duration: 0.3, ease: "power2.out" }, "<")
          .to(P.handR, { y: -34, x: 10, rotation: 40, duration: 0.3, ease: "power2.out" }, "<")
          .to(P.tuft, { scaleX: -1, duration: 0.1, yoyo: true, repeat: 3 }, "<")
          // 3. fall onto the edge
          .to(el, { y: 0, duration: 0.26, ease: "power2.in" }, ">-0.12")
          .set(P.rig, { rotation: 0, svgOrigin: "60 140" })
          // 4. land: squash, dust puffs, jelly settle
          .to(P.rig, { scaleY: 0.74, scaleX: 1.2, duration: 0.08, ease: "power1.out" })
          .to(P.dust, { opacity: 0.55, scale: 1.5, x: function (i) { return (i < 2 ? -1 : 1) * (10 + (i % 2) * 8); }, y: -6, duration: 0.18, ease: "power2.out", transformOrigin: "50% 50%" }, "<")
          .to(P.dust, { opacity: 0, scale: 0.4, duration: 0.3 }, ">")
          .to(P.rig, { scaleY: 1, scaleX: 1, duration: 0.6, ease: "elastic.out(1.1,0.35)" }, "<-0.3")
          .add(function () { setMouth("grin"); }, "<")
          .to(P.eyes, { scale: 1, duration: 0.25 }, "<")
          .to(P.handL, { y: 30, x: -4, rotation: 0, duration: 0.35, ease: "back.out(2)" }, "<")
          // 5. wave with the free hand
          .to(P.handR, { y: -18, x: 4, rotation: 0, duration: 0.25, ease: "back.out(2)" }, "<")
          .to(P.handR, { rotation: 22, duration: 0.1, yoyo: true, repeat: 5, svgOrigin: "108 94" })
          .to(P.handR, { y: 30, x: 4, rotation: 0, duration: 0.3, ease: "power2.out" })
          .add(function () { setMouth("smile"); });
        // hand off to the panel right as it lands, not after the wave
        busy.add(function () { resolve(); }, 1.05);
        function done() { busy = null; api.state = "open"; track = true; lookAt(-3.5, -3.5); resolve(); }
      });
    };

    // ---------- close: squash, drop out of sight, hands grab the ledge, peek back ----------
    api.close = function () {
      if (api.state === "idle" || api.state === "closing") return Promise.resolve();
      if (busy) busy.kill();
      stopThinking();
      api.state = "closing"; track = false; happyEyes(false);
      return new Promise(function (resolve) {
        setMouth("o");
        busy = gsap.timeline({ onComplete: function () { busy = null; api.state = "idle"; track = true; setMouth("smile"); startAmbient(); resolve(); } })
          .to(P.rig, { scaleY: 0.85, scaleX: 1.1, duration: 0.12 })
          .to(el, { y: HIDE_Y, duration: reduce ? 0.2 : 0.3, ease: "power2.in" })
          .to(P.rig, { scaleY: 1.1, scaleX: 0.92, duration: 0.2 }, "<")
          .set(P.rig, { scaleX: 1, scaleY: 1 })
          .set(P.hands, { x: 0, y: 0, rotation: 0 })
          .to({}, { duration: reduce ? 0 : 0.35 })
          .to(el, { y: PEEK_Y, duration: 0.45, ease: "back.out(2)" });
      });
    };

    // ---------- thinking: propeller tuft, orbiting pupils, hand on chin ----------
    var thinkTl = null;
    function stopThinking() {
      var tap = gsap.getById && gsap.getById("bm-tap"); if (tap) tap.kill();
      if (!thinkTl) return;
      thinkTl.kill(); thinkTl = null;
      gsap.to(P.tuft, { scaleX: 1, rotation: 0, duration: 0.2 });
      gsap.to(P.handR, { x: 4, y: 30, rotation: 0, duration: 0.3 });
      gsap.to(P.rig, { rotation: 0, duration: 0.3, svgOrigin: "60 140" });
    }
    api.thinking = function (on) {
      if (!on) { stopThinking(); if (api.state === "thinking") { api.state = "open"; track = true; setMouth("smile"); } return; }
      if (api.state !== "open" && api.state !== "opening") return;
      api.state = "thinking"; track = false; setMouth("flat"); stopAmbient();
      if (reduce) return;
      thinkTl = gsap.timeline({ repeat: -1 })
        .to(P.pupils, { keyframes: [{ x: 3.5, y: -3.5 }, { x: 0, y: -4.5 }, { x: -3.5, y: -3.5 }, { x: -2, y: -1 }, { x: 3.5, y: -3.5 }], duration: 1.6, ease: "none" }, 0)
        .to(P.tuft, { scaleX: -1, duration: 0.13, yoyo: true, repeat: 11, ease: "sine.inOut" }, 0)
        .to(P.rig, { rotation: -4 * flip, duration: 0.8, yoyo: true, repeat: 1, ease: "sine.inOut", svgOrigin: "60 140" }, 0);
      gsap.to(P.handR, { x: -30, y: -2, rotation: -20, duration: 0.35, ease: "back.out(2)" });
      gsap.to(P.handR, { y: -6, duration: 0.3, yoyo: true, repeat: -1, delay: 0.35, ease: "sine.inOut", id: "bm-tap" });
    };

    // ---------- happy: jump, ^^ eyes, sparkles ----------
    api.happy = function () {
      stopThinking();
      api.state = "open"; happyEyes(true); setMouth("grin");
      if (reduce) { setTimeout(function () { happyEyes(false); setMouth("smile"); track = true; }, 1000); return; }
      gsap.timeline({ onComplete: function () { happyEyes(false); setMouth("smile"); track = true; startAmbient(); } })
        .to(P.rig, { scaleY: 0.82, scaleX: 1.12, duration: 0.1 })
        .to(el, { y: -26, duration: 0.24, ease: "power2.out" })
        .to(P.rig, { scaleY: 1.12, scaleX: 0.92, duration: 0.14 }, "<")
        .to(P.hands, { y: -26, rotation: function (i) { return i ? 35 : -35; }, duration: 0.2 }, "<")
        .fromTo(P.sparks, { opacity: 0, scale: 0.2, rotation: -40, transformOrigin: "50% 50%" },
          { opacity: 1, scale: 1.1, rotation: 0, duration: 0.3, stagger: 0.06, ease: "back.out(3)" }, "<")
        .to(el, { y: 0, duration: 0.22, ease: "power2.in" })
        .to(P.rig, { scaleY: 0.8, scaleX: 1.16, duration: 0.07 })
        .to(P.rig, { scaleY: 1, scaleX: 1, duration: 0.5, ease: "elastic.out(1.1,0.35)" })
        .to(P.hands, { y: 30, rotation: 0, duration: 0.35, ease: "back.out(2)" }, "<")
        .to(P.sparks, { opacity: 0, scale: 0.4, duration: 0.3, stagger: 0.05 }, "<")
        .to({}, { duration: 0.4 });
    };

    api.destroy = function () {
      timers.forEach(clearTimeout); stopAmbient(); stopThinking();
      if (busy) busy.kill();
      global.removeEventListener("pointermove", onMove);
      el.remove();
    };
    return api;
  }

  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  global.BraceMascot = { create: create, SVG: SVG, CSS: CSS, size: { width: W, height: H, peekY: PEEK_Y, hoverY: HOVER_Y } };
})(window);
