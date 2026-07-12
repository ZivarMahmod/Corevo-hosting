import type { FloristTheme } from './types'
import { AuroraNav, AuroraFooter } from './aurora.chrome'
import { AuroraOm, AuroraTjanster, AuroraKontakt } from './aurora.pages'
import { AuroraShop, AuroraBlogg } from './aurora.modules'

/**
 * AURORA — korall/laxrosa på varmvitt, lekfull (goal-58). Signatur: tunn
 * korall-annonsrad → bred landskaps-hero med en rund "Handla nu"-cirkelknapp
 * ovanpå bilden → korall-band med en fet mening + liten CTA → rosa panel med
 * ett förskjutet, asymmetriskt valv-collage → invävda butik/blogg/presentkort
 * → tjänster → om → plats → closing. Foton verifierade 200 OK (curl -sI) 2026-07-11.
 *
 * SKÄRPE-PASS (zentum-reglerna, 4-Dokument-Underlag/design-skarpa-zentum.md):
 * identiteten (korall-familjen, sektionsordningen, cirkel-CTA:n, valv-collaget)
 * är orörd — utförandet är skärpt. Paletten är MÄTT, inte gissad (WCAG):
 *
 *   fg  #2A1F18 på bg #FFF7F1 ....... 15.16:1  (rubrik-ink; krav ≥7 — AAA)
 *   fg2 #6E5B4E på bg #FFF7F1 ........ 6.06:1  (brödtext; krav ≥4.5 — backar medvetet)
 *   #fff på primary #C8412A .......... 4.95:1  (knapptext/annonsrad/cirkel-CTA — krav ≥4.5)
 *   #fff på primaryD #9E3018 ......... 7.27:1  (BÅDA de mörka banden + hover)
 *   primaryD på surface #fff ......... 7.27:1  (eyebrows, priser, band-CTA)
 *   primaryD på accentSoft #FFE1D3 ... 5.87:1  (rosa panelens eyebrows)
 *
 * RUBRIKER ligger ALDRIG på 4.95: både korall-bandet och closing-bandet körs på
 * primaryD (7.27:1). Den ljusa korallen #C8412A bär bara mikrotext och knappar,
 * där kravet är 4.5. Mallens 8 hex = paletten; scrimmen återanvänder fg (ingen 9:e).
 *
 * Före: primary #F2603F gav bara 3.22:1 mot vit knapptext (FAIL) och fg2 #8C7A6E
 * 3.87:1 (FAIL). Kulören är kvar (samma korall-hue ~12°), ljusheten är justerad.
 * radius 20px → 0: binärt system (0 på struktur, full pill/cirkel på knappar).
 */
export const aurora: FloristTheme = {
  key: 'aurora',
  name: 'Aurora',
  desc: 'Korall & laxrosa · lekfull',
  palette: {
    primary: '#C8412A',
    primaryD: '#9E3018',
    bg: '#FFF7F1',
    surface: '#FFFFFF',
    fg: '#2A1F18',
    fg2: '#6E5B4E',
    line: '#F0DFD2',
    accentSoft: '#FFE1D3',
  },
  fonts: {
    display: 'var(--font-fraunces), Georgia, serif',
    body: 'var(--font-jost), system-ui, sans-serif',
  },
  // goal-59: LEKFULL BOUTIQUE → mjuk radie. Fortfarande BINÄRT: 24px på ALL struktur
  // (hero, kort, prisrader, kontakt-kortet), full pill/cirkel på knappar, badgar och
  // valv-bågar. Ingenting däremellan.
  radius: '24px',
  content: {
    heroEyebrow: '— Blomsterbutik',
    heroTitle: 'Blommor som\ngör dagen bättre.',
    heroLede:
      'Handknutna buketter i glada färger — beställ hem, hämta i butiken eller skicka en go överraskning till någon du gillar.',
    tagline: 'Vi binder blommor med känsla och lite för mycket kärlek.',
    utility: 'Handbundet varje dag · Hämta i butiken eller få hemskickat',
    italic: 'En bukett säger mer än de flesta ord.',
    aboutCopy:
      'Vi är en blomsterbutik med känsla för säsongens bästa snitt och handbundna buketter. Varje beställning packas med omsorg, för att glädjen ska hålla hela vägen fram.',
    servicesEyebrow: '— Beställ hos oss',
    servicesTitle: 'Buketter & binderier',
    aboutTitle: 'Blommor, bundna med omsorg',
    teamEyebrow: '— Vårt team',
    teamTitle: 'Händerna bakom varje bukett',
    heroImages: [
      'https://images.unsplash.com/photo-1709983967470-f6c72b61cc62?w=1600&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1628456676381-cf822e3c3f9f?w=1600&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1711638241167-796a782bd3f4?w=1600&q=80&auto=format&fit=crop',
    ],
    galleryImages: [
      'https://images.unsplash.com/photo-1455659817273-f96807779a8a?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1519378058457-4c29a0a2efac?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1747226757800-6d8f87cfc0fe?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1533038590840-1cde6e668a91?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1457089328109-e5d9bd499191?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1747226757815-d827b3aa4c5a?w=900&q=80&auto=format&fit=crop',
    ],
    aboutImage:
      'https://images.unsplash.com/photo-1746929015083-b313a9cb7dff?w=1600&q=80&auto=format&fit=crop',
    closingImage:
      'https://images.unsplash.com/photo-1711638753941-3a7128aa759f?w=1600&q=80&auto=format&fit=crop',
    team: [
      { name: 'Vårt team', role: 'Florister & rådgivare', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=700&q=80&auto=format&fit=crop' },
      { name: 'Buketter', role: 'Handbundet, dagligen', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=700&q=80&auto=format&fit=crop' },
      { name: 'Rådgivning', role: 'Hjälper dig välja rätt', img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=700&q=80&auto=format&fit=crop' },
    ],
    stats: [
      ['Färskt', 'varje leverans'],
      ['Handbundet', 'med omsorg'],
      ['Glatt', 'bemötande'],
    ],
  },
  caps: { heroEyebrow: true, homeStats: true, homeGallery: true, homeAbout: true },
  // goal-61 editor-paritet: Auroras REDIGERBARA element (Sida-editorns fält).
  // defaults = layoutens inbyggda fallback-strängar VERBATIM (AuroraLayout, hem-banden).
  // OBS: modulvyerna (aurora.modules.tsx) har EGNA fallbacks för shop-/blog-nycklarna
  // (t.ex. '— Journalen', 'Visa hela butiken →') — hem-bandens strängar valdes som
  // default enligt flora-förlagan i theme-capabilities.ts.
  extraHome: [
    { name: 'galleryEyebrow', label: 'Galleri-bandet: eyebrow', default: '— Från studion' },
    { name: 'shopEyebrow', label: 'Butiksbandet: eyebrow', default: '— Ur butiken' },
    { name: 'shopTitle', label: 'Butiksbandet: rubrik', default: 'Handla något fint' },
    { name: 'shopCta', label: 'Butiksbandet: knapptext', default: 'Se hela butiken' },
    { name: 'giftEyebrow', label: 'Presentkort-bandet: eyebrow', default: '— Presentkort' },
    { name: 'giftLede', label: 'Presentkort-bandet: text', rows: 2, default: 'Ge bort blomsterglädje, när som helst.' },
    { name: 'giftCta', label: 'Presentkort-bandet: knapptext', default: 'Köp presentkort' },
    { name: 'blogEyebrow', label: 'Bloggbandet: eyebrow', default: '— Bloggen' },
    { name: 'blogTitle', label: 'Bloggbandet: rubrik', default: 'Nyheter & inspiration' },
    { name: 'blogCta', label: 'Bloggbandet: knapptext', default: 'Läs fler inlägg' },
    { name: 'findEyebrow', label: 'Plats-sektionen: eyebrow', default: '— Hitta hit' },
  ],
  // TEMA-PAKET (goal-59): Aurora äger sitt sidhuvud (script-wordmark + rund CTA-cirkel),
  // sin sidfot (stort centrerat script-wordmark på rosa platta) och sina undersidor.
  chrome: { Nav: AuroraNav, Footer: AuroraFooter },
  pages: { om: AuroraOm, tjanster: AuroraTjanster, kontakt: AuroraKontakt },
  // MODUL-VYER (goal-59, vektor-regeln): butiken och bloggen renderas i Auroras form
  // (förskjuten grid av höga valv-kort, cirkel-CTA, korall-piller) — men FUNKTIONEN är
  // fortfarande modulens: AddToCart, formatShopPrice, fulfilmentPromise, paused-gaten.
  moduleViews: { shop: AuroraShop, blogg: AuroraBlogg },
}
