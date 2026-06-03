/* Corevo M6 Build Spec — renderer. Reads window.SPEC, builds the DOM. */
(function () {
  const S = window.SPEC;
  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

  const I = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    repeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
    msg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8 8 0 0 1-11.6 7.2L3 21l2.3-6.4A8 8 0 1 1 21 11.5Z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5Z"/><path d="m9 12 2 2 4-4"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
  };
  const calloutIcon = { principle: I.spark, do: I.check, dont: I.alert, note: I.info };

  /* ---------- callout ---------- */
  function callout(kind, html) {
    const c = el('div', 'callout ' + kind);
    c.innerHTML = '<span class="ic">' + (calloutIcon[kind] || I.info) + '</span><div>' + html + '</div>';
    return c;
  }

  /* ---------- PRINCIPLES ---------- */
  const pg = $('#principles-grid');
  S.principles.forEach((p, i) => {
    const c = el('div', 'card');
    c.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span style="width:30px;height:30px;border-radius:8px;background:var(--gold-100);color:var(--gold-600);display:grid;place-items:center;font-family:var(--mono);font-weight:700;font-size:13px">' + (i + 1) + '</span><b style="font-size:15.5px">' + p[0] + '</b></div><div style="font-size:13.5px;color:var(--ink-2);line-height:1.55">' + p[1] + '</div>';
    pg.appendChild(c);
  });

  /* ---------- SWATCHES ---------- */
  function swatches(arr, mount) {
    const m = $(mount);
    arr.forEach(([v, hex, desc, fg]) => {
      const s = el('div', 'swatch');
      s.innerHTML = '<div class="chipc" style="background:' + hex + ';color:' + fg + ';display:flex;align-items:flex-end;padding:7px 9px;font-family:var(--mono);font-size:10.5px;font-weight:600">' + hex + '</div><div class="lab"><b>' + v + '</b><code>' + desc + '</code></div>';
      m.appendChild(s);
    });
  }
  swatches(S.swBrand, '#sw-brand');
  swatches(S.swInk, '#sw-ink');
  swatches(S.swStatus, '#sw-status');

  /* ---------- TYPE SCALE ---------- */
  const ts = $('#type-scale');
  S.typeScale.forEach((t, i) => {
    const [name, meta, size, fam, wt, col, use] = t;
    const row = el('div');
    row.style.cssText = 'padding:13px 0;border-bottom:' + (i < S.typeScale.length - 1 ? '1px solid var(--line)' : 'none');
    const sample = name === 'eyebrow' ? 'STUDIO SALVIA' : 'Studio Salvia';
    row.innerHTML = '<div style="font-family:' + fam + ';font-weight:' + wt + ';font-size:' + Math.min(size, 30) + 'px;color:' + col + ';line-height:1.1;' + (name === 'eyebrow' ? 'letter-spacing:.16em;text-transform:uppercase;' : '') + '">' + sample + '</div><div style="display:flex;justify-content:space-between;margin-top:6px"><code style="font-size:11px;background:none;padding:0;color:var(--ink)">.' + name + '</code><span style="font-size:11.5px;color:var(--ink-3)">' + meta + '</span></div>';
    ts.appendChild(row);
  });

  /* ---------- RADII ---------- */
  const rad = $('#radii');
  rad.style.cssText = 'display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap';
  S.radii.forEach(([n, px]) => {
    const b = el('div');
    b.style.cssText = 'text-align:center';
    b.innerHTML = '<div style="width:54px;height:40px;background:var(--paper-2);border:1px solid var(--line-strong);border-radius:' + px + 'px"></div><div style="font-size:11px;color:var(--ink-3);margin-top:6px"><code style="font-size:10.5px;background:none;padding:0">' + n + '</code> ' + (px === 999 ? '∞' : px) + '</div>';
    rad.appendChild(b);
  });

  /* ---------- SPACING ---------- */
  const sp = $('#spacing');
  sp.style.cssText = 'display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap';
  S.spacing.forEach(px => {
    const b = el('div');
    b.innerHTML = '<div style="width:' + px + 'px;height:' + px + 'px;background:var(--gold);border-radius:3px"></div><div style="font-size:10px;color:var(--ink-3);margin-top:4px;text-align:center">' + px + '</div>';
    sp.appendChild(b);
  });

  /* ---------- BUTTONS ---------- */
  const bm = $('#btns');
  S.buttons.forEach(([v, label, ic]) => {
    const b = el('span', 'btn ' + v);
    b.innerHTML = (I[ic] ? '<span style="width:16px;height:16px;display:inline-flex">' + I[ic] + '</span>' : '') + label;
    bm.appendChild(b);
  });

  /* ---------- BADGES ---------- */
  const accent = { neutral: '#A7AC9E', success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)', info: 'var(--info)', gold: 'var(--gold-600)' };
  const bgmap = { neutral: '#EFEBE3', success: 'var(--success-bg)', warning: 'var(--warning-bg)', danger: 'var(--danger-bg)', info: 'var(--info-bg)', gold: 'var(--gold-100)' };
  const bdm = $('#badges');
  S.badges.forEach(([tone, label]) => {
    const b = el('span', 'badge');
    b.style.background = bgmap[tone];
    b.innerHTML = '<span class="d" style="background:' + accent[tone] + '"></span>' + label;
    bdm.appendChild(b);
  });
  const sep = el('span'); sep.style.cssText = 'width:1px;align-self:stretch;background:var(--line);margin:0 4px'; bdm.appendChild(sep);
  S.statusBadges.forEach(([tone, label, raw]) => {
    const wrap = el('span'); wrap.style.cssText = 'display:inline-flex;flex-direction:column;align-items:center;gap:5px';
    const b = el('span', 'badge'); b.style.background = bgmap[tone];
    b.innerHTML = '<span class="d" style="background:' + accent[tone] + '"></span>' + label;
    wrap.appendChild(b);
    const code = el('code'); code.style.cssText = 'font-size:10px'; code.textContent = 'status: ' + raw; wrap.appendChild(code);
    bdm.appendChild(wrap);
  });

  /* ---------- TOGGLES ---------- */
  const tm = $('#toggles');
  [['På', true], ['Av', false]].forEach(([lab, on]) => {
    const wrap = el('span'); wrap.style.cssText = 'display:inline-flex;align-items:center;gap:10px';
    const t = el('span', 'tog'); t.style.background = on ? 'var(--forest)' : 'var(--line-strong)';
    t.innerHTML = '<i style="left:' + (on ? '23px' : '3px') + '"></i>';
    wrap.appendChild(t);
    const s = el('span'); s.style.cssText = 'font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:' + (on ? 'var(--success)' : 'var(--ink-3)') + ';background:' + (on ? 'var(--success-bg)' : 'var(--paper-2)') + ';padding:3px 9px;border-radius:999px';
    s.textContent = on ? 'Aktiv' : 'Av';
    wrap.appendChild(s);
    tm.appendChild(wrap);
  });

  /* ---------- DRAWER SPEC (anatomy) ---------- */
  $('#drawer-spec').appendChild((function () {
    const d = el('div');
    d.style.cssText = 'border:1px solid var(--line-strong);border-radius:13px;overflow:hidden;box-shadow:var(--shadow-md);background:var(--cream);max-width:340px';
    d.innerHTML =
      '<div style="background:var(--paper);border-bottom:1px solid var(--line);padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start">' +
        '<div><span class="badge" style="background:var(--gold-100)"><span class="d" style="background:var(--gold-600)"></span>Bokad</span>' +
        '<div style="font-family:var(--display);font-size:18px;font-weight:700;margin-top:6px">Anna Bergström</div>' +
        '<div style="font-size:12px;color:var(--ink-3)">Klippning dam · 09:00–10:00</div></div>' +
        '<span style="width:30px;height:30px;border-radius:8px;border:1px solid var(--line);display:grid;place-items:center;color:var(--ink-3)"><span style="width:15px;height:15px;display:inline-flex">' + I.x + '</span></span>' +
      '</div>' +
      '<div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px">' +
        '<div style="background:var(--paper-2);border-radius:10px;padding:11px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:12px;color:var(--ink-2);display:flex;align-items:center;gap:6px"><span style="width:14px;height:14px;display:inline-flex;color:var(--ink-3)">' + I.shield + '</span>070- •• •• ••</span><span style="font-size:11.5px;font-weight:600;color:var(--forest);border:1px solid var(--line-strong);padding:4px 9px;border-radius:7px;display:inline-flex;gap:5px;align-items:center"><span style="width:13px;height:13px;display:inline-flex">' + I.eye + '</span>Visa</span></div>' +
        '<div style="background:var(--gold-100);border-radius:10px;padding:10px;display:flex;gap:8px"><span style="width:14px;height:14px;display:inline-flex;color:var(--gold-600);flex:none">' + I.msg + '</span><span style="font-size:12px;color:var(--ink)">\u201cKan ni ta lite extra på sidorna?\u201d</span></div>' +
      '</div>' +
      '<div style="border-top:1px solid var(--line);background:var(--paper);padding:12px 16px;display:flex;gap:8px">' +
        '<span class="btn danger" style="flex:1;justify-content:center;font-size:13px;padding:9px"><span style="width:15px;height:15px;display:inline-flex">' + I.x + '</span>Avboka</span>' +
        '<span class="btn primary" style="flex:1;justify-content:center;font-size:13px;padding:9px"><span style="width:15px;height:15px;display:inline-flex">' + I.check + '</span>Klar</span>' +
      '</div>';
    return d;
  })());

  /* ---------- TOAST SPEC ---------- */
  $('#toast-spec').appendChild((function () {
    const wrap = el('div'); wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    const toasts = [['repeat', 'var(--success)', 'Tid 17:00 frigjord — åter bokningsbar'], ['check', 'var(--success)', '14:30 markerad som klar'], ['eye', 'var(--warning)', 'Kontaktuppgift synlig i 15 min (loggas)']];
    toasts.forEach(([ic, tone, msg]) => {
      const t = el('div');
      t.style.cssText = 'display:flex;align-items:center;gap:11px;background:var(--forest);color:#fff;padding:11px 16px;border-radius:11px;box-shadow:var(--shadow-md);font-size:13px;font-weight:500';
      t.innerHTML = '<span style="width:24px;height:24px;border-radius:999px;background:' + tone + ';display:grid;place-items:center;flex:none"><span style="width:14px;height:14px;display:inline-flex">' + (I[ic] || I.check) + '</span></span>' + msg;
      wrap.appendChild(t);
    });
    return wrap;
  })());

  /* ---------- RÖD TRÅD FLOW ---------- */
  const rt = $('#redtrad-flow');
  rt.style.cssText = 'display:flex;flex-direction:column;gap:0';
  const toneMap = { kund: 'var(--info)', system: 'var(--ink-3)', m3: 'var(--gold-600)', all: 'var(--forest)', toast: 'var(--success)' };
  S.redtrad.forEach((step, i) => {
    const row = el('div');
    row.style.cssText = 'display:flex;gap:16px;align-items:flex-start;padding:4px 0';
    const last = i === S.redtrad.length - 1;
    row.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;flex:none">' +
        '<div style="width:34px;height:34px;border-radius:999px;background:' + toneMap[step[2]] + ';color:#fff;display:grid;place-items:center;font-family:var(--mono);font-weight:700;font-size:13px">' + (i + 1) + '</div>' +
        (last ? '' : '<div style="width:2px;height:30px;background:var(--line-strong)"></div>') +
      '</div>' +
      '<div style="padding-top:5px;padding-bottom:' + (last ? '0' : '12px') + '"><div style="font-weight:600;font-size:14.5px;color:var(--ink)">' + step[0] + '</div><div style="font-size:13px;color:var(--ink-2);margin-top:2px">' + step[1] + '</div></div>';
    rt.appendChild(row);
  });

  /* ---------- NODES ---------- */
  const nm = $('#nodes');
  S.nodes.forEach(node => {
    const sec = el('section', 'block');
    sec.id = 'node-' + node.num;

    let h = '<div class="node-head"><span class="node-num">' + node.num + '</span>' +
      '<h3 class="node-h">' + node.title + '</h3></div>' +
      '<div class="pills" style="margin-bottom:14px"><span class="pill" style="background:var(--forest);color:#fff;border-color:var(--forest)">' + node.role + '</span>' +
      '<span class="route">' + node.route + '</span><span class="m6ref">M6 ' + node.m6 + '</span></div>' +
      '<p style="font-size:15px;color:var(--ink-2)">' + node.intent + '</p>';

    if (node.img) {
      h += '<figure class="fig"><img src="' + node.img + '" alt="' + node.title + '"/><figcaption><b>' + node.title + '.</b> ' + node.cap + '</figcaption></figure>';
    }
    sec.innerHTML = h;

    // specimen drawers (rendered, since fixed overlays don't screenshot)
    if (node.specimen === 'drawerBooking' || node.specimen === 'drawerCustomer') {
      const note = callout('note', '<b>Renderat specimen.</b>&nbsp; Slide-overs är <code>position:fixed</code> och fångas inte av skärmdumpar — så här ser panelens uppbyggnad ut. Se primitiv-sektionen för Drawer-mekaniken.');
      sec.appendChild(note);
    }
    if (node.altImg) {
      const f = el('figure', 'fig');
      f.innerHTML = '<img src="' + node.altImg + '"/><figcaption>Samma bokningsdata speglad i frisörportalen (nod 11).</figcaption>';
      sec.appendChild(f);
    }

    // extra figures (booking views)
    if (node.extraFigs) {
      node.extraFigs.forEach(([img, cap]) => {
        const f = el('figure', 'fig');
        f.style.marginTop = '14px';
        f.innerHTML = '<img src="' + img + '"/><figcaption>' + cap + '</figcaption>';
        sec.appendChild(f);
      });
    }

    // Delar
    sec.appendChild(el('h4', 'sub', 'Delar'));
    const ol = el('ol', 'parts');
    node.parts.forEach(p => ol.appendChild(el('li', null, p)));
    sec.appendChild(ol);

    // two-col: data + state/behavior
    const tc = el('div', 'twocol'); tc.style.marginTop = '8px';
    const left = el('div');
    left.appendChild(el('h4', 'sub', 'Data noden rör'));
    let dt = '<table class="spec"><thead><tr><th>Fält</th><th>Källa</th><th>Not</th></tr></thead><tbody>';
    node.data.forEach(([f, src, note]) => { dt += '<tr><td>' + f + '</td><td><code>' + src + '</code></td><td>' + note + '</td></tr>'; });
    dt += '</tbody></table>';
    left.innerHTML += dt;
    tc.appendChild(left);

    const right = el('div');
    right.appendChild(el('h4', 'sub', 'Tillstånd & beteende'));
    const ul = el('ul'); ul.style.cssText = 'margin:0;padding-left:18px;font-size:13.5px;color:var(--ink-2)';
    node.behavior.forEach(b => { const li = el('li'); li.style.marginBottom = '6px'; li.innerHTML = b; ul.appendChild(li); });
    right.appendChild(ul);
    tc.appendChild(right);
    sec.appendChild(tc);

    // accept
    sec.appendChild(el('h4', 'sub', 'Klart när'));
    const cl = el('ul', 'check');
    node.accept.forEach(a => { const li = el('li'); li.innerHTML = a; cl.appendChild(li); });
    sec.appendChild(cl);

    // pitfalls
    if (node.pitfalls) {
      sec.appendChild(el('h4', 'sub', 'Fällor'));
      node.pitfalls.forEach(([kind, txt]) => sec.appendChild(callout(kind, txt)));
    }

    nm.appendChild(sec);
  });

  /* ---------- DATA MODEL ---------- */
  const dr = $('#dm-rename');
  dr.innerHTML = '<thead><tr><th>Gammal spec</th><th>Riktigt namn</th><th>Not</th></tr></thead><tbody>' +
    S.dmRename.map(([o, n, note]) => '<tr><td style="color:var(--ink-3);text-decoration:line-through">' + o + '</td><td><code>' + n + '</code></td><td>' + note + '</td></tr>').join('') + '</tbody>';

  const dc = $('#dm-cust');
  S.dmCust.forEach(([title, items, tone]) => {
    const c = el('div', 'card');
    const head = tone === 'do' ? 'var(--success)' : 'var(--danger)';
    c.innerHTML = '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:' + head + ';margin-bottom:12px">' + title + '</div>' +
      '<ul style="margin:0;padding-left:18px;font-size:13.5px;color:var(--ink-2);line-height:1.5">' + items.map(i => '<li style="margin-bottom:6px">' + i + '</li>').join('') + '</ul>';
    dc.appendChild(c);
  });

  /* ---------- PITFALLS ---------- */
  const pl = $('#pitfall-list');
  S.pitfalls.forEach(([title, was, fix], i) => {
    const c = el('div', 'card');
    c.style.cssText = 'margin-bottom:12px;display:flex;gap:16px;align-items:flex-start';
    c.innerHTML = '<span style="width:30px;height:30px;border-radius:8px;background:var(--danger-bg);color:var(--danger);display:grid;place-items:center;flex:none"><span style="width:17px;height:17px;display:inline-flex">' + I.alert + '</span></span>' +
      '<div style="flex:1"><div style="font-weight:600;font-size:15px;color:var(--ink)">' + title + '</div>' +
      '<div style="font-size:13px;color:var(--ink-3);margin-top:3px"><b style="color:var(--danger)">Blev fel:</b> ' + was + '</div>' +
      '<div style="font-size:13px;color:var(--ink-2);margin-top:5px"><b style="color:var(--success)">Rätt:</b> ' + fix + '</div></div>';
    pl.appendChild(c);
  });

  /* ---------- TOC ---------- */
  const toc = $('#toc');
  toc.innerHTML = '<div class="toc-brand"><div class="toc-logo">C</div><div><b>M6 Build Spec</b><span>Corevo · Code-referens</span></div></div>';
  const groups = [
    ['Grund', [['read-first', 'Så här läser du', 1], ['principles', 'Principer & världar', 1], ['tokens', 'Design-tokens', 1], ['primitives', 'Primitiver', 1], ['rodtrad', 'Röd tråd', 1]]],
    ['Noder', S.nodes.map(n => ['node-' + n.num, n.num + ' · ' + n.title, 0])],
    ['Appendix', [['datamodel', 'A · Datamodell', 1], ['pitfalls', 'B · Fäll-register', 1]]],
  ];
  groups.forEach(([label, items]) => {
    toc.appendChild(el('h4', null, label));
    items.forEach(([id, txt, lead]) => {
      const a = el('a', lead ? 'lead' : null, txt);
      a.href = '#' + id;
      toc.appendChild(a);
    });
  });

  // scroll-spy
  const links = [...toc.querySelectorAll('a')];
  const byId = {}; links.forEach(a => byId[a.getAttribute('href').slice(1)] = a);
  const obs = new IntersectionObserver(es => {
    es.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.style.background = '');
        const a = byId[e.target.id];
        if (a) { a.style.background = 'var(--paper-2)'; a.style.color = 'var(--ink)'; a.style.borderLeftColor = 'var(--gold)'; }
      }
    });
  }, { rootMargin: '-10% 0px -80% 0px' });
  document.querySelectorAll('section.block[id], section.block[id^="node-"]').forEach(s => obs.observe(s));
})();
