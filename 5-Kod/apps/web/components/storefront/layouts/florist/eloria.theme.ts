import type { FloristTheme } from './types'

/** Unsplash photo manifest — every id below verified `curl -sI` → 200 (2026-07-11). */
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  heroL: u('1490750967868-88aa4486c946'),
  heroR: u('1462275646964-a0e3386b89fa'),
  heroSpare: u('1518895949257-7621c3c786d7'),
  g1: u('1502977249166-824b3a8a4d6d', 900),
  g2: u('1508610048659-a06b669e3321', 900),
  g3: u('1500382017468-9049fed747ef', 900),
  g4: u('1494972308805-463bc619d34e', 900),
  g5: u('1470509037663-253afd7f0f51', 900),
  g6: u('1466692476868-aef1dfb1e735', 900),
  about: u('1526047932273-341f2a7631f9'),
  closing: u('1487530811176-3780de880c2d'),
  p1: u('1494790108377-be9c29b29330', 700),
  p2: u('1500648767791-00dcc994a43e', 700),
  p3: u('1438761681033-6461ffad8d80', 700),
} as const

/**
 * ELORIA — blush, mörkgrön och guld i klassisk premium-stil (florist-sviten,
 * goal-58). Motsatsen till Mina: en mörkgrön guldramad "platta" mitt i heron,
 * tunna guld-löftesikoner, eleganta höga shop/blogg-kort (3:4), en klassisk
 * prislista med guld-dotterade linjer och en mörkgrön scrim-closing som ekar
 * heron. Se EloriaLayout.tsx för den fullständiga sektionssignaturen.
 *
 * primary (#8A6B27) är valfärgen: white-on-gold ≈ 4.98:1 (btn-accent-texten)
 * och gold-on-bg ≈ 4.55:1 (eyebrows/priser direkt mot blush) — båda ≥ AA,
 * kontrollerat mot design-skärpa-kravet (aldrig under 4.5:1).
 */
export const eloria: FloristTheme = {
  key: 'eloria',
  name: 'Eloria',
  desc: 'Blush · mörkgrön · guld — klassisk premium',
  palette: {
    primary: '#8A6B27',
    primaryD: '#6E551E',
    bg: '#FBF3EE',
    surface: '#FFFFFF',
    fg: '#241B15',
    fg2: '#6B5548',
    line: '#E8D9C9',
    accentSoft: '#F5E4DC',
  },
  fonts: {
    display: 'var(--font-playfair), Georgia, serif',
    body: 'var(--font-source-sans), system-ui, sans-serif',
  },
  radius: '3px',
  content: {
    heroEyebrow: '— Klassisk blomsterhandel',
    heroTitle: 'Blommor för\nlivets stora stunder.',
    heroLede:
      'Handbundna buketter i tidlös stil — snittade i säsong, komponerade med omsorg och levererade med värdighet.',
    tagline: 'Blomsterhandel i klassisk stil',
    utility: 'Leverans samma dag vid beställning innan kl 14 · Handbundet i butik',
    italic: 'Det bästa av säsongen, komponerat med omsorg.',
    aboutCopy:
      'Vi är en blomsterhandel som tror på det tidlösa — klassiska snitt, ärligt hantverk och buketter som håller vad de lovar. Varje beställning binds för hand av någon som kan sitt hantverk.',
    servicesEyebrow: '— Våra tjänster',
    servicesTitle: 'Tjänster',
    aboutTitle: 'Om oss',
    teamEyebrow: '— Teamet',
    teamTitle: 'Händerna bakom varje bukett',
    heroImages: [IMG.heroL, IMG.heroR, IMG.heroSpare],
    galleryImages: [IMG.g1, IMG.g2, IMG.g3, IMG.g4, IMG.g5, IMG.g6],
    aboutImage: IMG.about,
    closingImage: IMG.closing,
    team: [
      { name: 'Vårt team', role: 'Florister', img: IMG.p1 },
      { name: 'Beställning & bud', role: 'Butik & leverans', img: IMG.p2 },
      { name: 'Bindning', role: 'Buketter & binderi', img: IMG.p3 },
    ],
    stats: [
      ['100%', 'handbundet'],
      ['Samma dag', 'leverans'],
      ['Klassisk', 'stil'],
    ],
  },
  caps: {
    heroEyebrow: true,
    homeStats: true,
    homeGallery: true,
    homeAbout: true,
  },
}
