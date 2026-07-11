import type { FloristTheme } from './types'
import { OnyxNav, OnyxFooter } from './onyx.chrome'
import { OnyxOm, OnyxTjanster, OnyxKontakt } from './onyx.pages'

/** Unsplash photo manifest — every id below verified `curl -sI` → 200 (2026-07-11). */
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  hero1: u('1465146344425-f00d5f5c8f07'),
  hero2: u('1487070183336-b863922373d4'),
  hero3: u('1560717845-968823efbee1'),
  g1: u('1553531384-cc64ac80f931', 900),
  g2: u('1502741126161-b048400d085d', 900),
  g3: u('1509587584298-0f3b3a3a1797', 900),
  g4: u('1487958449943-2429e8be8625', 900),
  g5: u('1531058020387-3be344556be6', 900),
  g6: u('1520763185298-1b434c919102', 900),
  about: u('1518895949257-7621c3c786d7'),
  closing: u('1490750967868-88aa4486c946'),
  p1: u('1494790108377-be9c29b29330', 700),
  p2: u('1500648767791-00dcc994a43e', 700),
  p3: u('1438761681033-6461ffad8d80', 700),
} as const

/**
 * ONYX — nästan svart + EN korall, dramatisk. Zivar: "ska kännas som ett svärd,
 * inte en mjuk morot". Skärpe-passet (design-skarpa-zentum.md, regel 5–8):
 *
 * • 8 hex, EN hue-familj. Mint (#3fe7b0) och det gröna accentSoft (#1E3630) är
 *   BORTA — de var en andra och tredje kulör som slogs med koralen om
 *   hierarkin (= moroten). accentSoft är nu en korall-tonad ink.
 * • Korallen är LYFT i ljushet (#E8442D → #FF6A4A, samma kulör) så att alla tre
 *   kraven håller samtidigt — de gick inte ihop förut:
 *      korall som text på svart  6.67:1  (var 4.76:1)
 *      korall som text på surface 6.14:1 (var 4.39:1 = UNDER 4.5 → underkänt)
 *      ink på korall (knapptext)  6.67:1 (vit på korall var 3.97:1 = underkänt)
 *   Knapptexten är därför INK på korall, aldrig vit — vit text på en mättad
 *   korall kan aldrig nå 4.5:1.
 * • primaryD (#E0563B) är hover-fyllningen: ink på den ger 5.01:1.
 * • Rubrik-ink (#F5F1E8) på svart = 16.76:1, brödtext (#A19C90) = 6.90:1.
 *
 * Skarpa hörn (radius 0) hela vägen — konsekvent, bestämt, aldrig mjukt; pill
 * BARA på knappar (se onyx.module.css).
 */
export const onyx: FloristTheme = {
  key: 'onyx',
  name: 'Onyx',
  desc: 'Svart · korall · dramatisk',
  palette: {
    primary: '#FF6A4A',
    primaryD: '#E0563B',
    bg: '#111110',
    surface: '#1B1A18',
    fg: '#F5F1E8',
    fg2: '#A19C90',
    line: '#2E2C27',
    accentSoft: '#231512',
  },
  fonts: {
    display: 'var(--font-dmserif), Georgia, serif',
    body: 'var(--font-jost), system-ui, sans-serif',
  },
  radius: '0px',
  content: {
    heroEyebrow: '— Blomsterhandel & bud',
    heroTitle: 'Blommor med\nkaraktär.',
    heroLede:
      'Handplockade snitt i djupa toner, bundna för hand och levererade samma dag — för dig som vill ge något som sticker ut.',
    tagline: 'Blommor med skärpa',
    utility: 'Bud samma dag vid beställning innan kl 14 · Hämtning i butik',
    italic: 'Vackert behöver inte vara försiktigt.',
    aboutCopy:
      'Vi är en blomsterhandel som tror på starka färger, ärligt hantverk och blommor som får ta plats. Varje bukett binds för hand, samma dag som den lämnar butiken.',
    servicesEyebrow: '— Det vi gör',
    servicesTitle: 'Tjänster',
    aboutTitle: 'Om oss',
    teamEyebrow: '— Teamet',
    teamTitle: 'Händerna bakom buketterna',
    heroImages: [IMG.hero1, IMG.hero2, IMG.hero3],
    galleryImages: [IMG.g1, IMG.g2, IMG.g3, IMG.g4, IMG.g5, IMG.g6],
    aboutImage: IMG.about,
    closingImage: IMG.closing,
    team: [
      { name: 'Vårt team', role: 'Florister', img: IMG.p1 },
      { name: 'Butik & bud', role: 'Butik & leverans', img: IMG.p2 },
      { name: 'Bindning', role: 'Buketter & binderi', img: IMG.p3 },
    ],
    stats: [
      ['100%', 'handbundet'],
      ['Djärvt', 'urval'],
      ['Samma dag', 'bud'],
    ],
  },
  caps: {
    heroEyebrow: true,
    homeStats: true,
    homeGallery: true,
    homeAbout: true,
  },
  // goal-59 TEMA-PAKET: Onyx äger sitt sidhuvud (krön + rad), sin helsvarta sidfot
  // och sina tre undersidor. FUNKTIONEN är fortfarande plattformens (NavShell +
  // modul-gatade länkar/CTA) — bara FORMEN är mallens.
  chrome: { Nav: OnyxNav, Footer: OnyxFooter },
  pages: { om: OnyxOm, tjanster: OnyxTjanster, kontakt: OnyxKontakt },
}
