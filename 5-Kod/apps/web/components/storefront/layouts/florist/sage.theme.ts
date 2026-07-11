import type { FloristTheme } from './types'

// Foto-id:n verifierade med curl -sI → 200 OCH öppnade som bild (2026-07-11) —
// bort-sorterade träffar under vägen: lökar, Spider-Man, en kameraväska, en
// laxrätt, tygtextur, en klädbutik och ett arkitektur-foto (samma Unsplash-slug
// betyder INTE samma motiv). Bara genuint blomster-/florist-relaterade foton
// användes nedan.
const u = (id: string, w = 1600) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

const IMG = {
  shopStall: u('1487070183336-b863922373d4'), // blomsterstånd, varma toner
  poppyField: u('1465146344425-f00d5f5c8f07'), // vallmo/vete, luftigt
  pastelBouquet: u('1591886960571-74d43a9d4166'), // rosa/creme bukett i vas
  bestsellers: u('1533616688419-b7a585564566'), // orange/röd bukett i glasburk
  birthday: u('1519378058457-4c29a0a2efac'), // klarröda blommor, festligt
  wedding: u('1519225421980-715cb0215aed'), // dukat bröllopsbord m. blombuketter
  whiteRose: u('1495231916356-a86217efff12'), // vit ros på trä, varmt ljus
  pinkLily: u('1502977249166-824b3a8a4d6d'), // rosa lilja i vas
  darkRoses: u('1494972308805-463bc619d34e'), // mörkröda rosor, mättat
  roseVase: u('1518895949257-7621c3c786d7', 900), // enstaka ros i vas, kvällsljus
  sunflower: u('1470509037663-253afd7f0f51', 1400), // solros
  p1: u('1494790108377-be9c29b29330', 700),
  p2: u('1438761681033-6461ffad8d80', 700),
  p3: u('1573497019940-1c28c88b4f3e', 700),
} as const

/**
 * SAGE — varmgrå/greige + mjuk salvia, luftig studio (goal-58). EGET
 * formspråk bland florist-sviten: transparent nav över en full-bleed hero med
 * spärrade versaler, en centrerad välkomstrad, en inramad kategori-trio som
 * länkar till butiken, och genomgående crisp galleri-kant (--sf-radius 6px)
 * — se SageLayout.tsx för sektionsordningen.
 */
export const sage: FloristTheme = {
  key: 'sage',
  name: 'Sage',
  desc: 'Greige & salvia · luftig studio',
  palette: {
    primary: '#7C7150',
    primaryD: '#5A5239',
    bg: '#F4F0E8',
    surface: '#FBF9F4',
    fg: '#2B2820',
    fg2: '#6E6656',
    line: '#DFD6C4',
    accentSoft: '#E9E2CF',
  },
  fonts: {
    display: 'var(--font-marcellus), Georgia, serif',
    body: 'var(--font-source-sans), system-ui, sans-serif',
  },
  radius: '6px',
  content: {
    heroEyebrow: 'Skön stämning',
    heroTitle: 'Blommor med\nomsorg',
    heroLede:
      'Handplockade snittblommor och personligt bundna buketter — för vardagen, festen och stunderna däremellan.',
    tagline: 'Blommor med omsorg, varje dag',
    utility: 'Beställ online · Hämta i butik eller få hem levererat',
    italic: 'Blommor är det vackraste sättet att säga något viktigt.',
    aboutCopy:
      'Vi är en blomsterbutik för dig som uppskattar hantverk och kvalitet. Varje bukett binds för hand, med blommor vi själva skulle vilja få. Välkommen in — vi hjälper dig gärna hitta rätt, oavsett anledning.',
    servicesEyebrow: '— Våra tjänster',
    servicesTitle: 'Det vi gör',
    aboutTitle: 'Hantverk, omtanke och friska blommor',
    teamEyebrow: '— Teamet',
    teamTitle: 'Människorna bakom buketterna',
    heroImages: [IMG.shopStall, IMG.poppyField, IMG.pastelBouquet],
    // [0..2] dubblar som kategori-trions bilder (Mest sålda/Födelsedag/Bröllop) —
    // samma återanvändningsmönster som Flora använder för sina pelare.
    galleryImages: [IMG.bestsellers, IMG.birthday, IMG.wedding, IMG.whiteRose, IMG.pinkLily, IMG.darkRoses],
    aboutImage: IMG.roseVase,
    closingImage: IMG.sunflower,
    team: [
      { name: 'Vårt team', role: 'Florister', img: IMG.p1 },
      { name: 'Bukett & design', role: 'Handbundna buketter', img: IMG.p3 },
      { name: 'Butik & rådgivning', role: 'Personlig service', img: IMG.p2 },
    ],
    stats: [
      ['100%', 'handbundet'],
      ['Säsong', 'i fokus'],
      ['Personlig', 'rådgivning'],
    ],
  },
  caps: { heroEyebrow: true, homeStats: true, homeGallery: true, homeAbout: true },
}
