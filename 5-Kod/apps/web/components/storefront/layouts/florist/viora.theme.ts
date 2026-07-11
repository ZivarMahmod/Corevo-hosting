import type { FloristTheme } from './types'

/** Unsplash photo manifest — every id below verified `curl -sI` → 200 (2026-07-11). */
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  hero1: u('1519378058457-4c29a0a2efac'),
  hero2: u('1611486212557-88be5ff6f941'),
  hero3: u('1533616688419-b7a585564566'),
  g1: u('1591886960571-74d43a9d4166', 900),
  g2: u('1587049352846-4a222e784d38', 900),
  g3: u('1509587584298-0f3b3a3a1797', 900),
  g4: u('1487958449943-2429e8be8625', 900),
  g5: u('1531058020387-3be344556be6', 900),
  g6: u('1512428813834-c702c7702b78', 900),
  about: u('1560806887-1e4cd0b6cbd6'),
  closing: u('1465146633011-14f8e0781093'),
  p1: u('1573496359142-b8d87734a5a2', 700),
  p2: u('1560250097-0b93528c311a', 700),
  p3: u('1541823709867-1b206113eafd', 700),
} as const

/**
 * VIORA — djup lila/violett + krämvit, modern boutique. Zivar: "ska kännas som
 * ett svärd, inte en mjuk morot". Signaturen är kompositionen, inte färgytan:
 * en 50/50 SPLIT-hero (färgad platta + bild, aldrig text ovanpå bilden), en rad
 * med fyra funktionella ikonlänkar, ett citat-band, och ett STORT 2-kolumners
 * butikskort-grid med markant större bilder än resten av sviten (se
 * VioraLayout/viora.module.css). Skarp binär radie (4px) hela vägen — aldrig
 * mjuka arch-former. EN driven accentfärg (den djupa violetten); krämvit gör
 * allt tunga lyftarbete i kontrast, inte flera kulörer.
 */
export const viora: FloristTheme = {
  key: 'viora',
  name: 'Viora',
  desc: 'Djup violett · krämvit · modern boutique',
  palette: {
    primary: '#402463',
    primaryD: '#2C1846',
    bg: '#FBF7F1',
    surface: '#FFFFFF',
    fg: '#241536',
    fg2: '#6E6178',
    line: '#E5DEE9',
    accentSoft: '#EFE7F3',
  },
  fonts: {
    display: 'var(--font-playfair), Georgia, serif',
    body: 'var(--font-inter), system-ui, sans-serif',
  },
  radius: '4px',
  content: {
    heroEyebrow: '— Blomsterbutik',
    heroTitle: 'Blommor.\nRakt på sak.',
    heroLede:
      'Handbundna buketter och blomsterarrangemang med en modern, säsongsnära känsla — beställ online eller stick in i butiken.',
    tagline: 'Modernt blomsterhantverk',
    utility: 'Leverans samma dag vid beställning innan kl 14 · Hämtning i butik',
    italic: 'Vackert ska aldrig kännas krångligt.',
    aboutCopy:
      'Vi är en blomsterbutik med ett modernt, rakt förhållningssätt: säsongens bästa snitt, handbundna med omsorg och levererade utan krångel. Inget onödigt — bara vackra blommor gjorda rätt.',
    servicesEyebrow: '— Beställningar & tjänster',
    servicesTitle: 'Tjänster',
    aboutTitle: 'Enkelt, ärligt hantverk',
    teamEyebrow: '— Teamet',
    teamTitle: 'Händerna bakom varje bukett',
    heroImages: [IMG.hero1, IMG.hero2, IMG.hero3],
    galleryImages: [IMG.g1, IMG.g2, IMG.g3, IMG.g4, IMG.g5, IMG.g6],
    aboutImage: IMG.about,
    closingImage: IMG.closing,
    team: [
      { name: 'Vårt team', role: 'Florister', img: IMG.p1 },
      { name: 'Butik', role: 'Butik & rådgivning', img: IMG.p2 },
      { name: 'Bindning', role: 'Buketter & binderi', img: IMG.p3 },
    ],
    stats: [
      ['100%', 'handbundet'],
      ['Modern', 'design'],
      ['Samma dag', 'leverans'],
    ],
  },
  caps: {
    heroEyebrow: true,
    homeStats: true,
    homeGallery: true,
    homeAbout: true,
  },
}
