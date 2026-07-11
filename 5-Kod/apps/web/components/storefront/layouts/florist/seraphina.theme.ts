import type { FloristTheme } from './types'

/**
 * SERAPHINA — champagne/guld + varmgrå, bröllops-lyx (florist-sviten, goal-58).
 * SIGNATUR-ORDNING (ingen annan mall i sviten har den): (1) hero med FULLSKÄRMS-
 * bild och en centrerad "kort-ram" (tunn guldram runt rubriken), (2) BRÖLLOPS-
 * först: sektionen direkt efter heron är bröllop/offert (stor bild + text +
 * "Begär offert"-CTA, gatad på offertReachable), (3) tjänste-priser i en elegant
 * TVÅSPALT (ingen annan mall delar sina priser i två spalter), (4) shop-teasers,
 * (5) om med guld-statistik-trio, (6) galleri i tre kolumner, (7) blogg,
 * (8) presentkort, (9) plats, (10) closing. Se SeraphinaLayout.tsx.
 * Känsla: bröllopsflorist — offerten är hjälten, inte butiken.
 */
export const seraphina: FloristTheme = {
  key: 'seraphina',
  name: 'Seraphina',
  desc: 'Champagne · guld · bröllopslyx',
  /**
   * PALETT — EN hue-familj (30–41°, champagne/guld/varm ask). Skärpe-passet
   * (design-skarpa-zentum.md §2) mörkade guldet utan att byta kulör: samma hue
   * 40°, lägre ljushet. ÅTTA hex — och de åtta nedan är HELA mallens palett:
   * ren vit finns inte, för den hade varit en nionde färg OCH en kall kulör i en
   * champagne-palett. Papper (#FDFBF6 = bg) bär texten på guldbandet i stället.
   * Uppmätt WCAG-kontrast (node, inte ögonmått):
   *   rubrik-ink  #241F1A på #FDFBF6 …… 15.79:1  (krav ≥7, sikte 11)
   *   brödtext    #6B6259 på #FDFBF6 ……  5.77:1  (krav ≥4.5 — backar medvetet)
   *   knapptext   #FDFBF6 på #6B5320 ……  7.04:1  (krav ≥4.5; = closing-rubriken,
   *                                        som därmed också klarar rubrik-kravet ≥7)
   *   guld-mikro  #6B5320 på #FDFBF6 ……  7.04:1  ·  på #F3E7D2 … 5.96:1
   * FÖRE: primary #8A6B2A gav 4.98:1 mot vitt och 4.07:1 på accentSoft — under
   * kravet, dvs den disiga "mjuka moroten". Guldet är accent: knapp, eyebrow,
   * siffra, pris — aldrig stora ytor (undantag: closing-bandet, mallens ankare).
   */
  palette: {
    primary: '#6B5320',
    primaryD: '#4A3813',
    bg: '#FDFBF6',
    surface: '#F6EFE0',
    fg: '#241F1A',
    fg2: '#6B6259',
    line: '#E6DCC6',
    accentSoft: '#F3E7D2',
  },
  fonts: {
    display: 'var(--font-cormorant), Georgia, serif',
    body: 'var(--font-inter), system-ui, sans-serif',
  },
  /** BINÄR radie: 0 på ALL struktur (bild/kort/sektion/ram/karta). Knappar är
   *  full pill i mallens CSS. 1px var "nästan skarp" = ingendera. */
  radius: '0px',
  content: {
    heroEyebrow: '— Bröllop & finaste tillfällena',
    heroTitle: 'Blommor värdiga\ndin finaste dag',
    heroLede:
      'En florist för bröllop, fester och stora ögonblick. Handbundna arrangemang i champagne och guld, skräddarsydda efter er dag.',
    tagline: 'Bröllopsflorist i champagne och guld',
    utility: 'Boka konsultation eller beställ online · Välkommen in',
    italic: 'Den finaste dagen förtjänar de finaste blommorna.',
    aboutCopy:
      'Vi är floristen för dig som vill att varje detalj ska kännas genomtänkt. Från första skissen till sista knoppen i buketten arbetar vi i champagne, creme och guld — en palett som aldrig går ur tiden.',
    servicesEyebrow: '— Arrangemang & priser',
    servicesTitle: 'Våra tjänster',
    aboutTitle: 'Finess i varje detalj',
    teamEyebrow: '— Floristerna',
    teamTitle: 'Handen bakom varje bukett',
    heroImages: [
      'https://images.unsplash.com/photo-1523438885200-e635ba2c371e?w=1600&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1600&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1550005809-91ad75fb315f?w=1600&q=80&auto=format&fit=crop',
    ],
    galleryImages: [
      'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1520854221256-17451cc331bf?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1462275646964-a0e3386b89fa?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1494972308805-463bc619d34e?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1502977249166-824b3a8a4d6d?w=900&q=80&auto=format&fit=crop',
    ],
    aboutImage:
      'https://images.unsplash.com/photo-1596438459194-f275f413d6ff?w=1600&q=80&auto=format&fit=crop',
    closingImage:
      'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1600&q=80&auto=format&fit=crop',
    team: [],
    stats: [
      ['100%', 'handbundet'],
      ['Bröllop', 'vår specialitet'],
      ['Guld & creme', 'vår palett'],
    ],
  },
  caps: { heroEyebrow: true, homeStats: true, homeGallery: true, homeAbout: true },
}
