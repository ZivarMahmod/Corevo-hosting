#!/usr/bin/env node
/**
 * Corevo multi-bransch — Mall-importer (standalone, READ-ONLY)
 * ------------------------------------------------------------
 * Läser råmallarna i denna mapp och genererar IDEMPOTENT SQL för prod:
 *   - templates(key,name,tags{bransch,typ,stil,licens,scope},tokens{...},sections[],status='draft')
 *   - template_slots(template_key,section_key,slot_key,label,kind,asset_role,module_key,module_view,repeatable,sort_order,default_kind,default_text,default_asset_key)
 *
 * Körs på den SÄKRA delmängden: licens-`fri` (MIT) admin-mallar + de namngivna
 * frisör-mallarna (haircut, training-studio, studio). Rör ALDRIG `salvia` (active).
 *
 * Tokens lyfts EXAKT ur mallens CSS/HTML (CSS :root-variabler, dominant hex,
 * font-family, container-bredd, border-radius, nav-position). Saknas värde → null.
 * Re-härleder ALDRIG; det som inte går att läsa blir null.
 *
 * INGEN deploy, INGA betaltjänster, INGEN nätverkstrafik. Endast filläsning + stdout/skriv SQL.
 *
 * Användning:
 *   node _import_templates.js            # skriver templates-import.sql i denna mapp
 *   node _import_templates.js --stdout   # skriver SQL till stdout istället
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// 0) Rotresolvering (hanterar ö i mappnamnet via Desktop-scan)
// ---------------------------------------------------------------------------
const CATALOG_DIR = __dirname; // scriptet bor i 03-template-katalog
const OUT_SQL = path.join(CATALOG_DIR, 'templates-import.sql');

// ---------------------------------------------------------------------------
// 1) Säker delmängd: mappnamn (folder) -> { key, bransch, typ, licens, vendor }
//    Endast dessa importeras nu. salvia exkluderas (active, ej i staging).
//    brber-master (kräver-köp) + razor-master (okänd licens) UTESLUTNA medvetet.
// ---------------------------------------------------------------------------
const SUBSET = [
  // --- Frisör-storefronts (namngivna i uppdraget) ---
  { folder: '52 haircut-1.0.0',      key: 'haircut',         bransch: 'frisör',  typ: 'storefront', stil: 'bold',    licens: 'kräver-kredit', vendor: 'htmlcodex' },
  { folder: '09 training-studio-1.0.0', key: 'training-studio', bransch: 'frisör', typ: 'storefront', stil: 'modern', licens: 'kräver-kredit', vendor: 'themewagon' },
  { folder: '12 studio-master',      key: 'studio',          bransch: 'frisör',  typ: 'storefront', stil: 'minimal', licens: 'kräver-kredit', vendor: 'colorlib' },
  // --- Fria (MIT) admin-mallar — licens=fri ---
  { folder: '16 star-admin2-free-admin-template-1.0.0', key: 'star-admin2', bransch: 'generell', typ: 'admin', stil: 'clean',  licens: 'fri', vendor: null },
  { folder: '19 sneat-1.0.0',        key: 'sneat',           bransch: 'generell', typ: 'admin',     stil: 'clean',   licens: 'fri', vendor: 'themeselection' },
  { folder: '83 connect-plus-1.0.0', key: 'connect-plus',    bransch: 'generell', typ: 'storefront', stil: 'clean',  licens: 'fri', vendor: null },
  { folder: '85 celestialAdmin-free-admin-template-1.0.0', key: 'celestial-admin', bransch: 'generell', typ: 'admin', stil: 'dark', licens: 'fri', vendor: null },
  { folder: '90 Breeze-Free-Bootstrap-Admin-Template-1.0.0', key: 'breeze-admin', bransch: 'generell', typ: 'admin', stil: 'clean', licens: 'fri', vendor: null },
];

// ---------------------------------------------------------------------------
// 2) Filsystemshjälpare — rekursiv (mappar har ofta inre nivå, t.ex.
//    "52 haircut-1.0.0/haircut-1.0.0/index.html")
// ---------------------------------------------------------------------------
function walk(dir, maxDepth, depth = 0, acc = []) {
  if (depth > maxDepth) return acc;
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return acc; }
  for (const it of items) {
    const fp = path.join(dir, it.name);
    if (it.isDirectory()) {
      if (!/^(node_modules|\.git|__MACOSX)$/i.test(it.name)) walk(fp, maxDepth, depth + 1, acc);
    } else {
      acc.push(fp);
    }
  }
  return acc;
}

const VENDOR_CSS = /(bootstrap|vendor|owl|swiper|fontawesome|font-awesome|aos|magnific|animate|slick|nice-select|boxicons|tiny-slider|flaticon|all\.min|jquery|bootstrap-icons|line-?awesome|pe-icon|themify|elegant|ionicons)/i;

function readSafe(fp) { try { return fs.readFileSync(fp, 'utf8'); } catch (_) { return ''; } }

/** Hitta primär index.html (grundast först, störst vid lika djup) + custom-CSS + alla html. */
function locateAssets(folderAbs) {
  const all = walk(folderAbs, 5);
  const htmls = all.filter(f => /\.html?$/i.test(f) && !/documentation|^_|\/_/.test(path.basename(f)) && !/404|elements?\.html/i.test(path.basename(f)));
  const indexes = htmls.filter(f => /(^|[\\/])index\.html?$/i.test(f));
  const depthOf = f => f.slice(folderAbs.length).split(/[\\/]/).length;
  const pickFrom = (list) => list.slice().sort((a, b) => {
    const da = depthOf(a), db = depthOf(b);
    if (da !== db) return da - db;                 // grundast
    return readSafe(b).length - readSafe(a).length; // störst
  })[0];
  const primary = pickFrom(indexes.length ? indexes : htmls) || null;
  const cssFiles = all.filter(f => /\.css$/i.test(f) && !VENDOR_CSS.test(f));
  return { primary, htmls, cssFiles, rootDir: primary ? path.dirname(primary) : folderAbs };
}

// ---------------------------------------------------------------------------
// 3) Token-extraktion (EXAKTA värden, annars null)
// ---------------------------------------------------------------------------
const HEX = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

function normHex(h) {
  h = h.toLowerCase();
  if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return h;
}
function lum(hex) { // relativ ljushet 0..1 (snabb approx)
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}
function isGreyish(hex) {
  const n = hex.replace('#', '');
  const r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return (max - min) <= 12; // nära gråskala
}

/** Läs CSS :root-variabler → { name: value } */
function parseRootVars(css) {
  const out = {};
  const m = css.match(/:root\s*\{([\s\S]*?)\}/i);
  if (!m) return out;
  const body = m[1];
  const re = /(--[A-Za-z0-9_-]+)\s*:\s*([^;]+);/g;
  let r;
  while ((r = re.exec(body))) out[r[1].trim()] = r[2].trim();
  return out;
}

/** Plocka en hex ur ett CSS-värde (kan vara "var(--x)" → null här) */
function hexInValue(v) {
  if (!v) return null;
  const m = v.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
  return m ? normHex(m[0]) : null;
}

/** Hitta primär brand-färg från :root-var-namn (accent/primary/brand/main/theme) */
function rootColorByName(vars, names) {
  for (const want of names) {
    for (const k of Object.keys(vars)) {
      if (new RegExp(want, 'i').test(k)) {
        const hx = hexInValue(vars[k]);
        if (hx) return hx;
      }
    }
  }
  return null;
}

/** Frekvensrankad dominant hex (för accent/primary fallback) */
function rankHex(text) {
  const counts = new Map();
  let m;
  HEX.lastIndex = 0;
  while ((m = HEX.exec(text))) {
    const h = normHex(m[0]);
    counts.set(h, (counts.get(h) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h, c]) => ({ hex: h, n: c }));
}

/** font-family: plocka första rimliga namnet (utan generiska) */
function firstFontFamily(decl) {
  if (!decl) return null;
  // ta värdet efter font-family:
  const m = decl.match(/font-family\s*:\s*([^;}{]+)/i);
  const raw = m ? m[1] : decl;
  const first = raw.split(',')[0].trim().replace(/^["']|["']$/g, '');
  if (!first) return null;
  if (/^(inherit|initial|unset|sans-serif|serif|monospace|cursive|system-ui|-apple-system)$/i.test(first)) return null;
  return first;
}

/** Google Fonts-länkar → lista [primary, ...] i länkordning */
function googleFonts(html) {
  const fams = [];
  const re = /fonts\.googleapis\.com\/css2?\?([^"'>]+)/gi;
  let m;
  while ((m = re.exec(html))) {
    const q = m[1].replace(/&amp;/g, '&');
    const famRe = /family=([^&:]+)/g;
    let f;
    while ((f = famRe.exec(q))) fams.push(decodeURIComponent(f[1].replace(/\+/g, ' ')).trim());
  }
  return [...new Set(fams)];
}

/** font-family för en selektor-grupp (body/heading) ur CSS */
function fontForSelector(css, selectorRe) {
  // hitta första regel vars selektor matchar och som har font-family
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(css))) {
    const sel = m[1].trim();
    const body = m[2];
    if (selectorRe.test(sel) && /font-family/i.test(body)) {
      const ff = firstFontFamily(body);
      if (ff) return ff;
    }
  }
  return null;
}

/** container max-width (px) */
function containerMaxWidth(css) {
  const re = /\.(container|wrapper|site-wrapper|main-wrapper|content-wrapper)[^{]*\{([^}]*)\}/gi;
  let m;
  const found = [];
  while ((m = re.exec(css))) {
    const w = m[2].match(/max-width\s*:\s*(\d+)\s*px/i);
    if (w) found.push(parseInt(w[1], 10));
  }
  if (found.length) return Math.max(...found) + 'px';
  // generell jakt på vanliga bootstrap-container-bredder
  const any = css.match(/max-width\s*:\s*(1[12]\d{2})px/i);
  return any ? any[1] + 'px' : null;
}

/** border-radius — vanligaste icke-noll px/rem på knappar/kort */
function dominantBorderRadius(css) {
  const counts = new Map();
  const re = /border-radius\s*:\s*([0-9.]+)\s*(px|rem|em)/gi;
  let m;
  while ((m = re.exec(css))) {
    const v = parseFloat(m[1]);
    if (v <= 0) continue;
    const key = m[1].replace(/\.0$/, '') + m[2];
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : null;
}

/** nav-position: 'fixed-top' | 'sticky' | 'top' | 'side' (admin) */
function navPosition(html, css, typ) {
  if (typ === 'admin') {
    if (/class=["'][^"']*(sidebar|side-nav|layout-menu)/i.test(html)) return 'side';
  }
  if (/navbar-fixed-top|fixed-top/i.test(html)) return 'fixed-top';
  if (/position\s*:\s*sticky/i.test(css) && /\b(nav|header)\b/i.test(css)) return 'sticky';
  if (/class=["'][^"']*(sticky-top|is-sticky|header-sticky)/i.test(html)) return 'sticky';
  if (/<(header|nav)\b/i.test(html)) return 'top';
  return null;
}

function extractTokens(html, allCss, typ) {
  const vars = parseRootVars(allCss);

  // Färger — först :root-var via namn, sen dominant hex som fallback
  const ranked = rankHex(allCss + '\n' + html).filter(x => x.hex !== '#ffffff' && x.hex !== '#fff' && x.hex !== '#000000');
  const vivid = ranked.filter(x => !isGreyish(x.hex));
  const topVivid = vivid[0] ? vivid[0].hex : null;
  const secondVivid = vivid[1] ? vivid[1].hex : null;

  const primary = rootColorByName(vars, ['primary', 'brand', 'main', 'theme', 'accent', 'color-1']) || topVivid;
  const accent = rootColorByName(vars, ['accent', 'secondary', 'highlight', 'color-2']) || (secondVivid && secondVivid !== primary ? secondVivid : null);
  const secondary = rootColorByName(vars, ['secondary', 'dark', 'color-2']) || (secondVivid && secondVivid !== primary ? secondVivid : null);

  // bg / surface / text / muted — via var-namn (lyft exakt, annars null)
  const bg = rootColorByName(vars, ['^--bg', 'background', 'body-bg', 'color-bg']) || null;
  const surface = rootColorByName(vars, ['surface', 'card', 'panel', 'white']) || null;
  const textC = rootColorByName(vars, ['^--text', 'text-color', 'body-color', 'heading', 'dark', 'black']) || null;
  const muted = rootColorByName(vars, ['muted', 'gray', 'grey', 'secondary-text', 'light-text']) || null;

  // Typografi
  const gf = googleFonts(html);
  const heading = fontForSelector(allCss, /(h1|h2|h3|\.heading|\.title|\.section-title)/i) || gf[0] || rootColorByNameFont(vars, ['heading', 'font-heading', 'title-font', 'font-primary']);
  const body = fontForSelector(allCss, /(^|,)\s*body\b/i) || firstFontFamily((allCss.match(/body\s*\{[^}]*\}/i) || [''])[0]) || gf[1] || gf[0] || rootColorByNameFont(vars, ['body', 'font-body', 'font-base', 'font-secondary']);

  return {
    color: {
      primary: primary || null,
      secondary: secondary || null,
      accent: accent || null,
      bg: bg,
      surface: surface,
      text: textC,
      muted: muted,
    },
    font: { heading: heading || null, body: body || null },
    layout: {
      max_width: containerMaxWidth(allCss),
      border_radius: dominantBorderRadius(allCss),
      nav_position: navPosition(html, allCss, typ),
    },
  };
}
/** font-family ur :root-var via namn */
function rootColorByNameFont(vars, names) {
  for (const want of names) {
    for (const k of Object.keys(vars)) {
      if (new RegExp(want, 'i').test(k)) {
        const ff = firstFontFamily('font-family:' + vars[k]);
        if (ff) return ff;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 4) Sektioner + slots
// ---------------------------------------------------------------------------
// Kanoniska sektioner vi känner igen och deras synonymer (regex på id/class/anchor)
const SECTION_MAP = [
  { key: 'hero',        re: /\b(hero|banner|masthead|jumbotron|intro|slider|home|header-?slider|main-?banner|welcome)\b/i },
  { key: 'about',       re: /\b(about|who-?we-?are|story|intro-?text|presentation)\b/i },
  { key: 'services',    re: /\b(service|services|what-?we-?do|features?|offer|treatments?)\b/i },
  { key: 'pricing',     re: /\b(pricing|price|prices|price-?list|plans?|rates?)\b/i },
  { key: 'team',        re: /\b(team|staff|barbers?|stylists?|crew|members?|our-?team|experts?)\b/i },
  { key: 'gallery',     re: /\b(gallery|portfolio|work|works|projects?|showcase|lookbook)\b/i },
  { key: 'testimonials',re: /\b(testimonial|reviews?|feedback|clients?-?say|quotes?)\b/i },
  { key: 'booking',     re: /\b(book|booking|appointment|reservation|boka|tidsbokning|schedule)\b/i },
  { key: 'contact',     re: /\b(contact|get-?in-?touch|reach-?us|kontakt|find-?us|location)\b/i },
  { key: 'blog',        re: /\b(blog|news|articles?|posts?|journal)\b/i },
  { key: 'cta',         re: /\b(cta|call-?to-?action|subscribe|newsletter|signup|get-?started)\b/i },
  { key: 'footer',      re: /\b(footer|site-?footer|colophon)\b/i },
];
// admin-only sektionsigenkänning (hålls UTANFÖR SECTION_MAP så storefronts ej tripp:as)
const ADMIN_SECTION = { key: 'dashboard', re: /\b(dashboard|main-?panel|app-?content|layout-?page|content-?wrapper)\b/i };

function canonSection(token, typ) {
  if (typ === 'admin' && ADMIN_SECTION.re.test(token)) return 'dashboard';
  for (const s of SECTION_MAP) if (s.re.test(token)) return s.key;
  return null;
}

/** Modul-hint för en sektion (booking / shop / null) */
function moduleHintFor(sectionKey, html) {
  if (sectionKey === 'booking') return 'booking';
  if (sectionKey === 'pricing' || sectionKey === 'services') {
    // tjänstelista i frisörsammanhang kopplas mot booking
    if (/\b(boka|book|appointment|price list|prislista)\b/i.test(html)) return 'booking';
  }
  if (/\b(cart|shop|store|checkout|add-?to-?cart|webshop|butik|produkt)\b/i.test(html)) return 'shop';
  return null;
}

/**
 * Bryt HTML i sektioner: scanna <section>/<header>/<footer>/<div class=...section...>
 * och kollapsa till kanoniska nycklar i dokumentordning (unika, behåller första träff).
 */
function extractSections(html, typ) {
  const ordered = [];
  const seen = new Set();
  const push = (key) => { if (key && !seen.has(key)) { seen.add(key); ordered.push(key); } };

  // 1) explicita section/header/footer-taggar med id/class
  const tagRe = /<(section|header|footer|div|nav)\b([^>]*)>/gi;
  let m;
  while ((m = tagRe.exec(html))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    if (tag === 'footer') { push('footer'); continue; }
    if (tag === 'nav') continue;
    const idm = attrs.match(/\bid=["']([^"']+)["']/i);
    const clm = attrs.match(/\bclass=["']([^"']+)["']/i);
    const token = [(idm ? idm[1] : ''), (clm ? clm[1] : '')].join(' ');
    if (!token.trim()) continue;
    // bara intressanta sektionsbärande element (section/header alltid; div endast om "section"-aktig klass)
    if (tag === 'div' && !/\b(section|block|area|wrapper-section|py-|sec-)\b/i.test(token) && !canonSection(token, typ)) continue;
    const c = canonSection(token, typ);
    if (c) push(c);
  }

  // 2) nav-ankare (#about, #services …) fångar sektioner utan tydlig class
  const navRe = /href=["']#([a-zA-Z][\w-]*)["']/g;
  while ((m = navRe.exec(html))) push(canonSection(m[1], typ));

  // 3) admin = enkel panel: alltid exakt ['dashboard'] (inga storefront-sektioner som läcker in)
  if (typ === 'admin') return ['dashboard'];

  // 4) säkerställ hero/footer för storefronts
  if (typ === 'storefront') {
    if (!seen.has('hero')) ordered.unshift('hero'), seen.add('hero');
    if (!seen.has('footer')) { ordered.push('footer'); seen.add('footer'); }
  }
  return ordered;
}

/** Räkna upprepade kort i en sektionstyp (team/gallery/services) för repeatable default_count-seed. */
function countCards(html, sectionKey) {
  // grov heuristik: leta efter den vanligaste upprepade kort-klassen nära sektionsnyckeln
  const tokenRe = sectionKey === 'team' ? /(team-?member|barber|stylist|member-?card|our-?team-?item)/i
    : sectionKey === 'gallery' ? /(gallery-?item|portfolio-?item|work-?item|gallery-?box)/i
      : sectionKey === 'services' ? /(service-?item|service-?box|feature-?box|treatment)/i
        : sectionKey === 'testimonials' ? /(testimonial-?item|review-?item|testi-?box)/i
          : null;
  if (!tokenRe) return null;
  const cls = html.match(new RegExp('class=["\\\']([^"\\\']*' + tokenRe.source.replace(/^\(|\)$/g, '') + '[^"\\\']*)["\\\']', 'i'));
  if (!cls) return null;
  // räkna förekomster av den exakta klass-token
  const tok = cls[1].split(/\s+/).find(t => tokenRe.test(t));
  if (!tok) return null;
  const re = new RegExp('class=["\\\'][^"\\\']*\\b' + tok.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'gi');
  const n = (html.match(re) || []).length;
  return n > 1 ? Math.min(n, 12) : null;
}

/**
 * Deklarera slots per sektion. Returnerar array av slot-objekt redo för SQL.
 * Konvention: slot_key = `${section}.${role}` ; repeatable = `${section}.item.{i}.${role}`.
 */
function slotsForSection(sectionKey, sortBase, html) {
  const slots = [];
  let order = sortBase;
  const add = (o) => { slots.push(Object.assign({ section_key: sectionKey, sort_order: order++ }, o)); };

  const moduleHint = moduleHintFor(sectionKey, html);

  switch (sectionKey) {
    case 'hero':
      add({ slot_key: 'hero.bg', label: 'Hero – bakgrundsbild', kind: 'asset', asset_role: 'image', aspect_hint: '16:9', repeatable: false, default_kind: 'asset' });
      add({ slot_key: 'hero.heading', label: 'Hero – rubrik', kind: 'text', repeatable: false, default_kind: 'text', default_text: 'Välkommen' });
      add({ slot_key: 'hero.subheading', label: 'Hero – underrubrik', kind: 'text', repeatable: false, default_kind: 'text', default_text: '' });
      if (moduleHint === 'booking') add({ slot_key: 'hero.cta', label: 'Hero – boka-knapp', kind: 'module', module_key: 'booking', module_view: 'booking_cta', repeatable: false });
      break;
    case 'about':
      add({ slot_key: 'about.image', label: 'Om oss – bild', kind: 'asset', asset_role: 'image', aspect_hint: '4:5', repeatable: false, default_kind: 'asset' });
      add({ slot_key: 'about.heading', label: 'Om oss – rubrik', kind: 'text', repeatable: false, default_kind: 'text', default_text: 'Om oss' });
      add({ slot_key: 'about.body', label: 'Om oss – brödtext', kind: 'text', repeatable: false, default_kind: 'text', default_text: '' });
      break;
    case 'services': {
      add({ slot_key: 'services.heading', label: 'Tjänster – rubrik', kind: 'text', repeatable: false, default_kind: 'text', default_text: 'Våra tjänster' });
      if (moduleHint === 'booking') {
        add({ slot_key: 'services.list', label: 'Tjänster – tjänstelista (boknings-modul)', kind: 'module', module_key: 'booking', module_view: 'service_list', repeatable: false });
      } else {
        add({ slot_key: 'services.item.{i}.icon', label: 'Tjänst – ikon/bild', kind: 'asset', asset_role: 'image', aspect_hint: '1:1', repeatable: true, default_kind: 'asset' });
        add({ slot_key: 'services.item.{i}.title', label: 'Tjänst – titel', kind: 'text', repeatable: true, default_kind: 'text' });
        add({ slot_key: 'services.item.{i}.text', label: 'Tjänst – beskrivning', kind: 'text', repeatable: true, default_kind: 'text' });
      }
      break;
    }
    case 'pricing':
      add({ slot_key: 'pricing.heading', label: 'Priser – rubrik', kind: 'text', repeatable: false, default_kind: 'text', default_text: 'Priser' });
      if (moduleHint === 'booking') add({ slot_key: 'pricing.list', label: 'Priser – prislista (boknings-modul)', kind: 'module', module_key: 'booking', module_view: 'service_list', repeatable: false });
      else add({ slot_key: 'pricing.item.{i}.text', label: 'Pris – rad', kind: 'text', repeatable: true, default_kind: 'text' });
      break;
    case 'team': {
      add({ slot_key: 'team.heading', label: 'Team – rubrik', kind: 'text', repeatable: false, default_kind: 'text', default_text: 'Vårt team' });
      add({ slot_key: 'team.member.{i}.photo', label: 'Medarbetare – bild', kind: 'asset', asset_role: 'image', aspect_hint: '1:1', repeatable: true, default_kind: 'asset' });
      add({ slot_key: 'team.member.{i}.name', label: 'Medarbetare – namn', kind: 'text', repeatable: true, default_kind: 'text' });
      add({ slot_key: 'team.member.{i}.role', label: 'Medarbetare – titel', kind: 'text', repeatable: true, default_kind: 'text' });
      break;
    }
    case 'gallery':
      add({ slot_key: 'gallery.heading', label: 'Galleri – rubrik', kind: 'text', repeatable: false, default_kind: 'text', default_text: 'Galleri' });
      add({ slot_key: 'gallery.item.{i}.image', label: 'Galleribild', kind: 'asset', asset_role: 'gallery', aspect_hint: '1:1', repeatable: true, default_kind: 'asset' });
      break;
    case 'testimonials':
      add({ slot_key: 'testimonials.heading', label: 'Omdömen – rubrik', kind: 'text', repeatable: false, default_kind: 'text', default_text: 'Vad våra kunder säger' });
      add({ slot_key: 'testimonials.item.{i}.quote', label: 'Omdöme – citat', kind: 'text', repeatable: true, default_kind: 'text' });
      add({ slot_key: 'testimonials.item.{i}.author', label: 'Omdöme – person', kind: 'text', repeatable: true, default_kind: 'text' });
      add({ slot_key: 'testimonials.item.{i}.photo', label: 'Omdöme – porträtt', kind: 'asset', asset_role: 'image', aspect_hint: '1:1', repeatable: true, default_kind: 'asset' });
      break;
    case 'booking':
      add({ slot_key: 'booking.heading', label: 'Boka – rubrik', kind: 'text', repeatable: false, default_kind: 'text', default_text: 'Boka tid' });
      add({ slot_key: 'booking.widget', label: 'Boka – boknings-modul', kind: 'module', module_key: 'booking', module_view: 'booking_cta', repeatable: false });
      break;
    case 'cta':
      add({ slot_key: 'cta.heading', label: 'CTA – rubrik', kind: 'text', repeatable: false, default_kind: 'text', default_text: '' });
      add({ slot_key: 'cta.text', label: 'CTA – text', kind: 'text', repeatable: false, default_kind: 'text', default_text: '' });
      if (moduleHint === 'booking') add({ slot_key: 'cta.button', label: 'CTA – boka-knapp', kind: 'module', module_key: 'booking', module_view: 'booking_cta', repeatable: false });
      break;
    case 'blog':
      add({ slot_key: 'blog.heading', label: 'Blogg – rubrik', kind: 'text', repeatable: false, default_kind: 'text', default_text: 'Nyheter' });
      add({ slot_key: 'blog.item.{i}.image', label: 'Blogginlägg – bild', kind: 'asset', asset_role: 'image', aspect_hint: '16:9', repeatable: true, default_kind: 'asset' });
      add({ slot_key: 'blog.item.{i}.title', label: 'Blogginlägg – titel', kind: 'text', repeatable: true, default_kind: 'text' });
      break;
    case 'contact':
      add({ slot_key: 'contact.heading', label: 'Kontakt – rubrik', kind: 'text', repeatable: false, default_kind: 'text', default_text: 'Kontakt' });
      add({ slot_key: 'contact.address', label: 'Kontakt – adress/text', kind: 'text', repeatable: false, default_kind: 'text', default_text: '' });
      add({ slot_key: 'contact.map', label: 'Kontakt – karta/bild', kind: 'asset', asset_role: 'image', aspect_hint: '16:9', repeatable: false, default_kind: 'asset' });
      break;
    case 'footer':
      add({ slot_key: 'footer.logo', label: 'Sidfot – logotyp', kind: 'asset', asset_role: 'logo', aspect_hint: null, repeatable: false, default_kind: 'asset' });
      add({ slot_key: 'footer.text', label: 'Sidfot – text', kind: 'text', repeatable: false, default_kind: 'text', default_text: '' });
      break;
    case 'dashboard':
      add({ slot_key: 'dashboard.logo', label: 'Logotyp', kind: 'asset', asset_role: 'logo', aspect_hint: null, repeatable: false, default_kind: 'asset' });
      add({ slot_key: 'dashboard.title', label: 'Panel – titel', kind: 'text', repeatable: false, default_kind: 'text', default_text: 'Översikt' });
      break;
    default:
      add({ slot_key: sectionKey + '.heading', label: sectionKey + ' – rubrik', kind: 'text', repeatable: false, default_kind: 'text', default_text: '' });
  }

  // global logo-slot fångas av header → lägg en logo-slot under hero/dashboard om header finns
  return slots;
}

// ---------------------------------------------------------------------------
// 5) SQL-generering (idempotent)
// ---------------------------------------------------------------------------
function sqlStr(v) {
  if (v === null || v === undefined) return 'null';
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlJson(obj) {
  if (obj === null || obj === undefined) return 'null';
  return "'" + JSON.stringify(obj).replace(/'/g, "''") + "'::jsonb";
}
function sqlTextArray(arr) {
  if (!arr || !arr.length) return "'{}'::text[]";
  return "array[" + arr.map(sqlStr).join(',') + "]::text[]";
}

function buildSQL(rows) {
  const L = [];
  L.push('-- Corevo multi-bransch — mall-import (genererad av _import_templates.js, READ-ONLY)');
  L.push('-- IDEMPOTENT: on conflict do update. status=draft. Rör EJ salvia (active).');
  L.push('-- Granska innan apply. Applicera via Supabase MCP mot prod (clylvowtowbtotrahuad).');
  L.push('begin;');
  L.push('');

  for (const r of rows) {
    const t = r.template;
    L.push(`-- ===== ${t.key}  (${t.tags.bransch}/${t.tags.typ}, licens=${t.tags.licens}) =====`);
    L.push('insert into templates (key, name, tags, tokens, sections, status) values (');
    L.push(`  ${sqlStr(t.key)}, ${sqlStr(t.name)}, ${sqlJson(t.tags)}, ${sqlJson(t.tokens)}, ${sqlTextArray(t.sections)}, 'draft'`);
    L.push(')');
    L.push('on conflict (key) do update set');
    L.push('  name = excluded.name,');
    L.push('  tags = excluded.tags,');
    L.push('  tokens = excluded.tokens,');
    L.push('  sections = excluded.sections,');
    L.push("  status = case when templates.status = 'active' then templates.status else 'draft' end");
    L.push(`where templates.key <> 'salvia';`);
    L.push('');

    // template_slots — idempotent per (template_key, slot_key)
    for (const s of r.slots) {
      L.push('insert into template_slots (template_key, section_key, slot_key, label, kind, asset_role, aspect_hint, module_key, module_view, repeatable, sort_order, default_kind, default_text, default_asset_key) values (');
      L.push('  ' + [
        sqlStr(t.key), sqlStr(s.section_key), sqlStr(s.slot_key), sqlStr(s.label), sqlStr(s.kind),
        sqlStr(s.asset_role || null), sqlStr(s.aspect_hint || null), sqlStr(s.module_key || null), sqlStr(s.module_view || null),
        (s.repeatable ? 'true' : 'false'), String(s.sort_order),
        sqlStr(s.default_kind || null), sqlStr(s.default_text || null), sqlStr(s.default_asset_key || null),
      ].join(', '));
      L.push(')');
      L.push('on conflict (template_key, slot_key) do update set');
      L.push('  section_key = excluded.section_key, label = excluded.label, kind = excluded.kind,');
      L.push('  asset_role = excluded.asset_role, aspect_hint = excluded.aspect_hint,');
      L.push('  module_key = excluded.module_key, module_view = excluded.module_view,');
      L.push('  repeatable = excluded.repeatable, sort_order = excluded.sort_order,');
      L.push('  default_kind = excluded.default_kind, default_text = excluded.default_text, default_asset_key = excluded.default_asset_key;');
    }
    L.push('');
  }

  L.push('commit;');
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// 6) Main
// ---------------------------------------------------------------------------
function main() {
  const toStdout = process.argv.includes('--stdout');
  const rows = [];
  const report = [];

  for (const def of SUBSET) {
    const folderAbs = path.join(CATALOG_DIR, def.folder);
    if (!fs.existsSync(folderAbs)) { report.push(`SKIP (saknas): ${def.folder}`); continue; }
    const { primary, cssFiles, htmls } = locateAssets(folderAbs);
    if (!primary) { report.push(`SKIP (ingen html): ${def.folder}`); continue; }

    const html = readSafe(primary);
    const allCss = cssFiles.map(readSafe).join('\n') +
      // ta även med inline <style> ur primär-html (vissa mallar har all CSS inline)
      '\n' + ([...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n'));

    const tokens = extractTokens(html, allCss, def.typ);
    const sections = extractSections(html, def.typ);

    // bygg slots
    const slots = [];
    let base = 0;
    for (const sec of sections) {
      const ss = slotsForSection(sec, base, html);
      // seed repeatable default_count via kort-räkning (lägg i label-suffix? nej — håll schema rent;
      // count seedas vid materialisering. Vi noterar i rapporten.)
      base += 100; // gott om utrymme mellan sektioner
      slots.push(...ss);
    }

    const tags = { bransch: def.bransch, typ: def.typ, stil: def.stil, licens: def.licens, scope: (def.licens === 'fri' ? 'public' : 'internal') };
    const name = 'Corevo ' + def.key.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

    rows.push({ template: { key: def.key, name, tags, tokens, sections }, slots });

    const moduleSlots = slots.filter(s => s.kind === 'module').length;
    const repeatSlots = slots.filter(s => s.repeatable).length;
    report.push(`OK  ${def.key.padEnd(16)} | sektioner=${sections.length} [${sections.join(',')}] | slots=${slots.length} (module=${moduleSlots}, repeat=${repeatSlots}) | primary=${path.relative(folderAbs, primary)} | css=${cssFiles.length} | tokens.primary=${tokens.color.primary} font.head=${tokens.font.heading}`);
  }

  const sql = buildSQL(rows);
  if (toStdout) {
    process.stdout.write(sql);
  } else {
    fs.writeFileSync(OUT_SQL, sql, 'utf8');
  }

  // Rapport till stderr (stör ej SQL på stdout)
  const totalSlots = rows.reduce((a, r) => a + r.slots.length, 0);
  console.error('============ MALL-IMPORT RAPPORT ============');
  report.forEach(l => console.error(l));
  console.error('---------------------------------------------');
  console.error(`Importerade mallar: ${rows.length}`);
  console.error(`Slots totalt: ${totalSlots}`);
  console.error(`SQL skriven: ${toStdout ? '(stdout)' : OUT_SQL}`);
  console.error('=============================================');
}

main();
