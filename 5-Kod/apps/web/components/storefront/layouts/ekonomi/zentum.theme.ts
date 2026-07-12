import type { FloristTheme } from '../florist/types'
import { ZentumNav, ZentumFooter } from './zentum.chrome'
import { ZentumOm, ZentumTjanster, ZentumKontakt } from './zentum.pages'

// Zentum-mallens fotomanifest — EXAKT Unsplash-URLerna ur den verifierade statiska
// kopian (public/mallar/zentum/index.html, HEAD-verifierade 2026-07-12). Beskärningen
// (w/h/fit) är del av designen (9:10-kort, 1920×950-hero) och får inte ändras.
const IMG = {
  hero: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1920&h=950&fit=crop&q=80&auto=format',
  split: 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80&auto=format&fit=crop',
  s1: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900&h=1000&fit=crop&q=80&auto=format',
  s2: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900&h=1000&fit=crop&q=80&auto=format',
  s3: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=900&h=1000&fit=crop&q=80&auto=format',
  s4: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=900&h=1000&fit=crop&q=80&auto=format',
  s5: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=900&h=1000&fit=crop&q=80&auto=format',
  s6: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=900&h=1000&fit=crop&q=80&auto=format',
} as const

/**
 * ZENTUM — redovisningsbyrå (EKONOMI-sviten, första mallen). Pixel-kopia av den
 * verifierade statiska sidan i public/mallar/zentum/ (index.html + style.css = LAG,
 * spec: 4-Dokument-Underlag/zentum-mall-spec.md). Overlay-header över 950px-hero,
 * Merriweather-intro, 6 tjänstekort 9:10, full-bleed navy-split, referens-slider,
 * partner-logotyper, blackish footer.
 *
 * MODUL-REGELN: zentum v1 väver INTE moduler (ekonomi-sajt utan webshop) — inga
 * moduleViews, INTE med i THEME_OWNS_MODULES. Layouten får aldrig rendera
 * /shop//blogg//presentkort//offert-länkar (ekonomi-suite.test.tsx bevakar).
 *
 * Paletten = de exakta 8 hexen ur style.css :root, mappade på FloristPalette:
 *   primary   #212c40  (--c-global, navy — knappar/rubriker)
 *   primaryD  #111926  (--c-blackish — hover/footer-bg)
 *   bg        #ffffff  (--c-surface — sidans bakgrund)
 *   surface   #f2f4f8  (--c-surface2 — ljus tonad yta)
 *   fg        #0c3c60  (--c-display — hero-H1-navyn)
 *   fg2       #666666  (--c-body — brödtext)
 *   line      #9da5b5  (--c-muted — dämpad/border)
 *   accentSoft#a5cbe3  (--c-accent — ljusblå accent)
 */
export const zentum: FloristTheme = {
  key: 'zentum',
  name: 'Zentum',
  desc: 'Redovisning & ekonomi — skarp navy, pixelklass',
  palette: {
    primary: '#212c40',
    primaryD: '#111926',
    bg: '#ffffff',
    surface: '#f2f4f8',
    fg: '#0c3c60',
    fg2: '#666666',
    line: '#9da5b5',
    accentSoft: '#a5cbe3',
  },
  fonts: {
    // Laddas i app/layout.tsx (next/font): Wix Madefor Display 500/600 + DM Sans 400.
    // Merriweather 400 laddas också (intro-statementet) och läses direkt i
    // zentum.module.css via var(--font-merriweather).
    display: 'var(--font-wixmadefor), sans-serif',
    body: 'var(--font-dmsans), sans-serif',
  },
  // Radie binär (spec §Färger): 0 på all struktur, pill på knappar (mallens CSS).
  radius: '0px',
  // COPY = den statiska kopians egna strängar (evergreen, generisk byrå-röst).
  // heroEyebrow är prefixet i hero-pillen — layouten renderar
  // "{heroEyebrow} {tenant.name}" ("Välkommen till Balans" i kopian).
  content: {
    heroEyebrow: 'Välkommen till',
    heroTitle: 'Ditt ekonomiska verktyg',
    heroLede: 'Vi skapar lösningar som hjälper dig driva ditt bolag framåt.',
    tagline: 'En personlig redovisningsbyrå',
    utility: 'Kontakta oss — vi hjälper ditt bolag framåt',
    italic:
      'En modern redovisningsbyrå där digital effektivitet möter personlig rådgivning — så att du kan lägga din tid på det du gör bäst: din verksamhet.',
    aboutCopy:
      'Som din lokala redovisningsbyrå tar vi hand om siffrorna så att du kan fokusera på verksamheten. Vi erbjuder både helhetsåtaganden och skräddarsydda punktinsatser — en stabil grund för ditt bolag att växa ifrån.',
    servicesEyebrow: '— Våra tjänster',
    servicesTitle: 'Våra tjänster',
    aboutTitle: 'Din trygga partner inom\nredovisning och bokföring.',
    teamEyebrow: '— Referenser',
    teamTitle: 'Så säger våra kunder',
    heroImages: [IMG.hero, IMG.split, IMG.s1],
    galleryImages: [IMG.s1, IMG.s2, IMG.s3, IMG.s4, IMG.s5, IMG.s6],
    aboutImage: IMG.split,
    closingImage: IMG.hero,
    // Team är OWNER-ONLY (theme-content-regeln) och zentum har ingen team-sektion.
    team: [],
    // Ingen statistik-grid i designen → tomt + caps.homeStats:false.
    stats: [],
  },
  caps: { heroEyebrow: false, homeStats: false, homeGallery: false, homeAbout: true },
  // TEMA-PAKET: mallen äger sitt overlay-sidhuvud, sin blackish sidfot och alla tre
  // undersidorna. ownsUtility: designen har INGEN utility-remsa alls — flaggan
  // stänger plattformens UtilityBar (naven konsumerar medvetet inte utilityText).
  chrome: { Nav: ZentumNav, Footer: ZentumFooter, ownsUtility: true },
  pages: { om: ZentumOm, tjanster: ZentumTjanster, kontakt: ZentumKontakt },
  // moduleViews: MEDVETET utelämnat — zentum v1 väver inga moduler.
}
