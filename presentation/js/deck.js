/* ============================================================================
   KoʻzNur deck — navigation + per-slide reveal engine
   - Scales the 1280x720 stage to fit any window (16:9, letterboxed)
   - Keyboard nav (arrows / space / Home / End), on-screen prev/next
   - Progress bar, slide counter
   - Per-slide GSAP enter timeline: staggered fades, SVG path draw-on,
     number count-ups, and (on the architecture slide) a traveling packet
   - Fully honors prefers-reduced-motion
   Borrows motion vocabulary from hyperframes-animation: power3.out hero
   deceleration, sine.inOut calm flow, ~0.08s stagger, draw-on, count-up.
   ============================================================================ */
(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var stage    = document.getElementById("stage");
  var slides   = Array.prototype.slice.call(document.querySelectorAll("[data-slide]"));
  var total    = slides.length;
  var current  = 0;
  var animating = false;

  var elBar     = document.getElementById("deckProgressBar");
  var elCurrent = document.getElementById("deckCurrent");
  var elTotal   = document.getElementById("deckTotal");
  var btnPrev   = document.getElementById("deckPrev");
  var btnNext   = document.getElementById("deckNext");

  /* --------------------------------------------------- stage scaling */
  function fitStage() {
    var sw = 1280, sh = 720;
    var pad = 48; // breathing room around the slide
    var scale = Math.min(
      (window.innerWidth  - pad * 2) / sw,
      (window.innerHeight - pad * 2) / sh
    );
    scale = Math.max(0.2, scale);
    stage.style.transform = "scale(" + scale + ")";
  }
  window.addEventListener("resize", fitStage);

  /* ----------------------------------------------- reveal: per slide */
  // Each slide gets a fresh enter timeline on activation. We tag the slide
  // with [data-revealing] so CSS hides [data-reveal] children before the
  // timeline runs (prevents a flash of laid-out content). Reduced motion
  // skips the timeline entirely and shows everything.

  function playReveal(slide) {
    var revealEls = slide.querySelectorAll("[data-reveal]");
    var counters  = slide.querySelectorAll("[data-count]");
    var flowLines = slide.querySelectorAll(".flow-line");
    var flowLabels = slide.querySelectorAll(".flow-label, .flow-label *");
    var nodes     = slide.querySelectorAll(".arch-node, .arch-out");
    var packet    = slide.querySelector(".flow-packet");
    var requestPath = slide.querySelector('.flow-line[data-flow="1"]');

    if (REDUCED || !window.gsap) {
      // Show everything, run count-ups instantly, no motion.
      revealEls.forEach(function (el) { el.style.opacity = ""; });
      counters.forEach(function (c) {
        c.textContent = formatCount(num(c.getAttribute("data-count")), c);
      });
      slide.removeAttribute("data-revealing");
      return;
    }

    slide.setAttribute("data-revealing", "");

    var tl = gsap.timeline({
      defaults: { ease: "power3.out" },
      onComplete: function () { slide.removeAttribute("data-revealing"); }
    });

    // 1. Headline + body blocks — staggered rise + fade (hero deceleration)
    if (revealEls.length) {
      tl.fromTo(revealEls,
        { opacity: 0, y: 22 },
        { opacity: 1, y: 0, duration: 0.62, stagger: 0.08 },
        0);
    }

    // 2. Architecture nodes — settle in with a gentle scale (back.out, subtle)
    if (nodes.length) {
      tl.fromTo(nodes,
        { opacity: 0, y: 14, scale: 0.97, transformOrigin: "center center" },
        { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: "back.out(1.4)", stagger: 0.1 },
        0.15);
    }

    // 3. Data-flow connectors draw on, in request->return order
    if (flowLines.length) {
      flowLines.forEach(function (line, i) {
        var len = line.getTotalLength();
        gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
        // keep the dashed return arrows visually dashed AFTER draw-on
        var isDashed = line.getAttribute("stroke-dasharray") &&
                       line.getAttribute("data-flow") > 2;
        tl.to(line, {
          strokeDashoffset: 0,
          duration: 0.5,
          ease: "power2.inOut",
          onComplete: isDashed ? function () {
            // restore the intended dash pattern for return paths
            line.style.strokeDasharray = "6 5";
            line.style.strokeDashoffset = "0";
          } : null
        }, 0.45 + i * 0.18);
      });
    }

    // 4. Flow labels fade in just behind their lines
    if (flowLabels.length) {
      tl.fromTo(slide.querySelectorAll(".flow-label"),
        { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.9);
    }

    // 5. The fundus-image packet travels the request path, then fades
    if (packet && requestPath && window.MotionPathPlugin === undefined) {
      // No MotionPathPlugin on CDN core build — animate along path manually
      var rp = requestPath;
      var plen = rp.getTotalLength();
      var prox = { d: 0 };
      tl.set(packet, { opacity: 1 }, 1.0)
        .to(prox, {
          d: 1, duration: 0.7, ease: "sine.inOut",
          onUpdate: function () {
            var pt = rp.getPointAtLength(prox.d * plen);
            packet.setAttribute("cx", pt.x);
            packet.setAttribute("cy", pt.y);
          }
        }, 1.0)
        .to(packet, { opacity: 0, duration: 0.25 }, ">-0.05");
    }

    // 6. Number count-ups — tabular, eased, formatted
    counters.forEach(function (c) {
      var target = num(c.getAttribute("data-count"));
      var proxy  = { v: 0 };
      tl.to(proxy, {
        v: target, duration: 0.9, ease: "power2.out",
        onUpdate: function () { c.textContent = formatCount(proxy.v, c); }
      }, 0.5);
    });

    return tl;
  }

  function num(s) { var n = parseFloat(s); return isNaN(n) ? 0 : n; }
  function formatCount(v, el) {
    var decimals = parseInt(el.getAttribute("data-count-decimals") || "0", 10);
    var suffix   = el.getAttribute("data-count-suffix") || "";
    var prefix   = el.getAttribute("data-count-prefix") || "";
    return prefix + v.toFixed(decimals) + suffix;
  }

  /* ----------------------------------------------------- navigation */
  function show(index, dir) {
    if (animating && !REDUCED) return;
    index = Math.max(0, Math.min(total - 1, index));
    if (index === current && slides[index].classList.contains("is-active")) {
      // first paint still needs reveal
    }

    var prev = slides[current];
    var next = slides[index];

    // Slide-out of the outgoing slide (subtle), slide-in of incoming
    if (!REDUCED && window.gsap && prev !== next) {
      animating = true;
      gsap.to(prev, {
        opacity: 0, duration: 0.18, ease: "power1.in",
        onComplete: function () {
          prev.classList.remove("is-active");
          prev.style.opacity = "";
          activate(next, index, dir);
          animating = false;
        }
      });
    } else {
      if (prev !== next) prev.classList.remove("is-active");
      activate(next, index, dir);
    }
  }

  function activate(next, index, dir) {
    current = index;
    next.classList.add("is-active");
    next.scrollTop = 0;
    updateChrome();
    // Defer reveal one frame so layout/getTotalLength is valid
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { playReveal(next); });
    });
  }

  function updateChrome() {
    elCurrent.textContent = current + 1;
    elTotal.textContent = total;
    elBar.style.width = ((current + 1) / total * 100) + "%";
    btnPrev.disabled = current === 0;
    btnNext.disabled = current === total - 1;
  }

  function go(delta) { show(current + delta, delta > 0 ? 1 : -1); }

  /* --------------------------------------------------------- inputs */
  document.addEventListener("keydown", function (e) {
    switch (e.key) {
      case "ArrowRight": case "PageDown":
        e.preventDefault(); go(1); break;
      case " ": case "Spacebar":
        e.preventDefault(); go(e.shiftKey ? -1 : 1); break;
      case "ArrowLeft": case "PageUp":
        e.preventDefault(); go(-1); break;
      case "Home": e.preventDefault(); show(0, -1); break;
      case "End":  e.preventDefault(); show(total - 1, 1); break;
    }
  });
  btnPrev.addEventListener("click", function () { go(-1); });
  btnNext.addEventListener("click", function () { go(1); });

  // Click right/left half of the stage to advance/retreat (presenter habit)
  stage.addEventListener("click", function (e) {
    if (e.target.closest("a, button")) return;
    var r = stage.getBoundingClientRect();
    if (e.clientX > r.left + r.width / 2) go(1); else go(-1);
  });

  /* ------------------------------------------------------------ boot */
  fitStage();
  // Ensure exactly one slide is active at start
  slides.forEach(function (s, i) { s.classList.toggle("is-active", i === 0); });
  current = 0;
  updateChrome();
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { playReveal(slides[0]); });
  });

  // Expose a tiny API for the build agent / debugging
  window.KozNurDeck = {
    next: function () { go(1); },
    prev: function () { go(-1); },
    goto: function (i) { show(i, 1); },
    replay: function () { playReveal(slides[current]); },
    get index() { return current; },
    get total() { return total; }
  };
})();
