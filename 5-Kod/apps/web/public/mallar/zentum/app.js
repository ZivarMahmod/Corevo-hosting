/* Balans — sidbeteenden:
   1. hero-lagerintro vid load  2. sticky header efter scroll (tröskel = headerhöjden)
   3. split-line rubrik-reveal  4. testimonial-slider (autoplay 4000ms)
   5. logo-carousel (4 synliga, sömlös loop)  6. scroll-progress-knapp
   7. off-canvas mobilmeny  8. sök-overlay */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. Hero-lagerintro ---------- */
  var hero = document.querySelector('.hero');
  var heroImg = hero && hero.querySelector('.hero-bg img');
  function heroStart() { if (hero) hero.classList.add('is-loaded'); }
  if (hero) {
    if (reduceMotion) {
      heroStart();
    } else if (heroImg && !heroImg.complete) {
      heroImg.addEventListener('load', heroStart);
      heroImg.addEventListener('error', heroStart);
      setTimeout(heroStart, 1500); /* fallback: starta ändå */
    } else {
      requestAnimationFrame(heroStart);
    }
  }

  /* ---------- 2. Sticky header ---------- */
  var sticky = document.querySelector('.header-sticky');
  var stickyAt = 90; /* = overlay-headerns höjd */
  function onScrollHeader() {
    if (!sticky) return;
    var y = window.scrollY || document.documentElement.scrollTop;
    sticky.classList.toggle('is-visible', y > stickyAt);
    sticky.setAttribute('aria-hidden', y > stickyAt ? 'false' : 'true');
  }

  /* ---------- 3. Split-line reveal ---------- */
  /* Rubriker med .reveal-lines splittas i rader (explicita <br> = radbryt);
     raderna glider upp med cubic-bezier(.22,.61,.36,1) vid inscroll.
     Rubriker med annan inline-markup än <br> lämnas hela (förstör inget). */
  document.querySelectorAll('.reveal-lines').forEach(function (el) {
    var safe = Array.prototype.every.call(el.childNodes, function (node) {
      return node.nodeType === 3 || (node.nodeType === 1 && node.tagName === 'BR');
    });
    if (!safe) { el.classList.remove('reveal-lines'); el.classList.add('reveal-fade'); return; }
    var parts = [];
    el.childNodes.forEach(function (node) {
      if (node.nodeType === 3) {
        node.textContent.trim().split(/\s+/).forEach(function (w) { if (w) parts.push(w); });
      } else {
        parts.push('\n');
      }
    });
    var lines = parts.join(' ').split(/\s*\n\s*/);
    el.textContent = '';
    lines.forEach(function (line) {
      var outer = document.createElement('span'); outer.className = 'line';
      var inner = document.createElement('span'); inner.textContent = line;
      outer.appendChild(inner); el.appendChild(outer);
    });
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('is-inview');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal-lines, .reveal-fade').forEach(function (el) { io.observe(el); });

  /* ---------- 4. Testimonial-slider (autoplay 4000ms, rå-tempo) ---------- */
  var track = document.querySelector('.testi-track');
  var dotsWrap = document.querySelector('.testi-dots');
  if (track && dotsWrap) {
    var slides = track.children.length;
    var idx = 0;
    var dots = [];
    for (var i = 0; i < slides; i++) {
      var d = document.createElement('button');
      d.className = 'testi-dot' + (i === 0 ? ' is-active' : '');
      d.setAttribute('aria-label', 'Referens ' + (i + 1));
      (function (n, btn) { btn.addEventListener('click', function () { go(n); }); })(i, d);
      dotsWrap.appendChild(d);
      dots.push(d);
    }
    var timer = reduceMotion ? null : setInterval(next, 4000);
    function go(n) {
      idx = (n + slides) % slides;
      track.style.transform = 'translateX(-' + idx * 100 + '%)';
      dots.forEach(function (btn, i) { btn.classList.toggle('is-active', i === idx); });
      if (timer) { clearInterval(timer); timer = setInterval(next, 4000); }
    }
    function next() { go(idx + 1); }
  }

  /* ---------- 5. Logo-carousel: 4 synliga, sömlös loop, resize-medveten ---------- */
  var logoTrack = document.querySelector('.logos-track');
  if (logoTrack && !reduceMotion) {
    var originals = logoTrack.children.length;
    /* klona setet en gång → loopen kan glida förbi kanten och snäppa om osynligt */
    Array.prototype.slice.call(logoTrack.children).forEach(function (item) {
      logoTrack.appendChild(item.cloneNode(true));
    });
    var pos = 0;
    function visibleCount() {
      return window.matchMedia('(max-width: 767px)').matches ? 2 : 4;
    }
    setInterval(function () {
      pos++;
      var step = 100 / visibleCount();
      if (pos > originals) {
        /* snäpp tillbaka utan animation, fortsätt sömlöst */
        logoTrack.style.transition = 'none';
        pos = 1;
        logoTrack.style.transform = 'translateX(0)';
        void logoTrack.offsetWidth; /* reflow */
        logoTrack.style.transition = '';
      }
      logoTrack.style.transform = 'translateX(-' + pos * step + '%)';
    }, 3000);
  }

  /* ---------- 6. Scroll-progress-knapp ---------- */
  var wrap = document.querySelector('.progress-wrap');
  var path = wrap && wrap.querySelector('.progress-circle path');
  var len = path ? path.getTotalLength() : 0;
  if (path) {
    path.style.strokeDasharray = len + ' ' + len;
    path.style.strokeDashoffset = len;
  }
  function onScrollProgress() {
    if (!wrap) return;
    var y = window.scrollY || document.documentElement.scrollTop;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (path && h > 0) path.style.strokeDashoffset = len - (len * y / h);
    wrap.classList.toggle('is-visible', y > 200);
  }
  if (wrap) wrap.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });

  window.addEventListener('scroll', function () { onScrollHeader(); onScrollProgress(); }, { passive: true });
  onScrollHeader(); onScrollProgress();

  /* ---------- 7. Off-canvas mobilmeny ---------- */
  var offcanvas = document.querySelector('.offcanvas');
  var backdrop = document.querySelector('.offcanvas-backdrop');
  function setMenu(open) {
    if (!offcanvas || !backdrop) return;
    offcanvas.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
    document.querySelectorAll('.burger').forEach(function (b) { b.setAttribute('aria-expanded', String(open)); });
  }
  if (offcanvas && backdrop) {
    document.querySelectorAll('.burger').forEach(function (b) {
      b.addEventListener('click', function () { setMenu(!offcanvas.classList.contains('is-open')); });
    });
    backdrop.addEventListener('click', function () { setMenu(false); });
    var closeBtn = document.querySelector('.offcanvas-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { setMenu(false); });
    offcanvas.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
  }

  /* ---------- 8. Sök-overlay ---------- */
  var search = document.querySelector('.search-overlay');
  function setSearch(open) {
    if (!search) return;
    search.classList.toggle('is-open', open);
    search.setAttribute('aria-hidden', String(!open));
    if (open) {
      var input = search.querySelector('input');
      if (input) setTimeout(function () { input.focus(); }, 100);
    }
  }
  document.querySelectorAll('.header-search').forEach(function (b) {
    b.addEventListener('click', function () { setSearch(true); });
  });
  var searchClose = document.querySelector('.search-close');
  if (searchClose) searchClose.addEventListener('click', function () { setSearch(false); });

  /* Escape stänger overlay + meny */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { setSearch(false); setMenu(false); }
  });
}());
