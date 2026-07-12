import type { FloristTheme } from './types'
import { OliviaThymeNav, OliviaThymeFooter } from './oliviathyme.chrome'
import { OliviaThymeOm, OliviaThymeTjanster, OliviaThymeKontakt } from './oliviathyme.pages'
import { OliviaThymeShop, OliviaThymeBlogg } from './oliviathyme.modules'

/**
 * OLIVIA & THYME — puderrosa + varm brun, butiks-charm (goal-58).
 * Signaturen: en fullbredds butiksfasad-hero utan rubrik-overlay (bara ett
 * hängande namnskylt-"wordmark"), en beige välkomst-remsa med den riktiga
 * rubriken, en "Ur butiken"-remsa som mynnar ut i två stora produktbilder där
 * den ena bär en stjärn-badge ("Bäst säljare") — det är kvarterbutikens
 * skyltfönster, inte en bohemisk mood board. Se OliviaThymeLayout.tsx för
 * sektionsordningen.
 */
export const oliviathyme: FloristTheme = {
  key: 'oliviathyme',
  name: 'Olivia & Thyme',
  desc: 'Puderrosa · varm brun · butikscharm',
  /* SKÄRPE-PASS: samma kulörer (varm brun 20–25°, puderrosa), MÖRKARE ljushet —
     hela paletten mätt med WCAG, inte ögonmått:
       fg   #1C1109  17.01:1 mot bg  (rubrik skär mot bakgrunden)
       fg2  #64513F   6.91:1 mot bg  ·  6.30:1 mot surface (var 4.42 = FAIL)
       primary #6B3E24 med creme text 8.24:1 (knapp/closing)
     Före låg brödtexten på 4.42:1 mot surface och 4.07:1 mot accentSoft — under
     AA. Det var den disiga "moroten": kanterna suddades ut.

     HEX-TAKET (8, zentums regel): paletten har åtta slots, och mallen lägger till
     puderrosan (--ot-rose) — nio. primaryD var en NIONDE brun (#4A2716) som bara
     användes till knapp-hover; den är nu ink-brunet (#1C1109 = fg), samma hue och
     ett mörkare register, så hovern fortfarande växlar hårt. Rent vitt är samtidigt
     struket ur CSS:en (papperet är --color-bg). Unika hex: 8. */
  palette: {
    primary: '#6B3E24',
    primaryD: '#1C1109',
    bg: '#FBF4EE',
    surface: '#F5E9DC',
    fg: '#1C1109',
    fg2: '#64513F',
    line: '#E4D3C0',
    accentSoft: '#F4DCE1',
  },
  fonts: {
    display: 'var(--font-dmserif), Georgia, serif',
    body: 'var(--font-source-sans), system-ui, sans-serif',
  },
  /* Binär radie: 0 på ALLT strukturellt (bilder, kort, kartan, knappar). Den enda
     runda formen i mallen är stjärn-badgen (999px) — ett medvetet undantag, inte
     ett 3px-kompromiss-hörn på varenda yta. */
  radius: '0px',
  content: {
    heroEyebrow: '— Blomsterhandel',
    heroTitle: 'Din blomsterbutik\nom hörnet',
    heroLede:
      'Handplockade snittblommor och nybundna buketter, varje dag. Kom in och känn doften — eller boka så ordnar vi resten.',
    tagline: 'Blommor från kvarterets egen butik',
    utility: 'Nybundna buketter dagligen · Välkommen in i butiken',
    italic: 'Det finns alltid en anledning att köpa blommor.',
    aboutCopy:
      'Vi är en liten blomsterbutik med stora buketter. Varje snitt, varje band och varje kort packas för hand — så att det känns som en gåva, inte bara ett köp.',
    servicesEyebrow: '— Våra tjänster',
    servicesTitle: 'Det vi hjälper till med',
    aboutTitle: 'En butik som gör det personligt',
    teamEyebrow: '— Bakom disken',
    teamTitle: 'Händerna som binder din bukett',
    heroImages: [
      'https://images.unsplash.com/photo-1754891955767-efe818cd68ca?w=1600&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1522748906645-95d8adfd52c7?w=1600&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1589244159943-460088ed5c92?w=1600&q=80&auto=format&fit=crop',
    ],
    galleryImages: [
      'https://images.unsplash.com/photo-1495231916356-a86217efff12?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1776799215256-c7bb5cfbcef4?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1780082723034-91b5dcdf4fca?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1777879760931-3a21a9bf42d6?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1770051669143-9e11b102a0f2?w=900&q=80&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1768180316485-2c7306ab38ff?w=900&q=80&auto=format&fit=crop',
    ],
    aboutImage:
      'https://images.unsplash.com/photo-1781242934964-3b19db3673a7?w=1600&q=80&auto=format&fit=crop',
    closingImage:
      'https://images.unsplash.com/photo-1763672087818-03257864c026?w=1600&q=80&auto=format&fit=crop',
    team: [
      { name: 'Vårt team', role: 'Florister', img: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=700&q=80&auto=format&fit=crop' },
      { name: 'Buketter', role: 'Handbundet', img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=700&q=80&auto=format&fit=crop' },
      { name: 'Butiken', role: 'Kundmottagning', img: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=700&q=80&auto=format&fit=crop' },
    ],
    stats: [
      ['100%', 'handbundet'],
      ['Färskt', 'varje dag'],
      ['Litet', 'kvarterbutik'],
    ],
  },
  caps: { heroEyebrow: true, homeStats: true, homeGallery: true, homeAbout: true },
  // goal-61 editor-paritet: mallens redigerbara element (Sida-editorn). Defaults =
  // layoutens inbyggda fallback-strängar VERBATIM (OliviaThymeLayout.tsx +
  // oliviathyme.modules.tsx + oliviathyme.pages.tsx). closing/contact/services/about-
  // nycklarna har redan egna redigeringskort och deklareras inte här.
  extraHome: [
    { name: 'shopEyebrow', label: 'Butiks-bandet: eyebrow', default: '— Ur butiken' },
    { name: 'shopTitle', label: 'Butiks-bandet: rubrik', default: 'Butikens favoriter' },
    { name: 'shopCta', label: 'Butiks-bandet: knapptext', default: 'Se hela sortimentet' },
    { name: 'blogEyebrow', label: 'Blogg-bandet: eyebrow', default: '— Från bloggen' },
    { name: 'blogTitle', label: 'Blogg-bandet: rubrik', default: 'Tips, säsong & inspiration' },
    { name: 'blogCta', label: 'Blogg-bandet: länktext', default: 'Läs hela bloggen' },
    { name: 'giftEyebrow', label: 'Presentkort-raden: eyebrow', default: '— Presentkort' },
    { name: 'giftLede', label: 'Presentkort-raden: text', rows: 2, default: 'Ge bort en blomstrande stund, när som helst på året.' },
    { name: 'giftCta', label: 'Presentkort-raden: länktext', default: 'Till presentkorten' },
    { name: 'galleryEyebrow', label: 'Galleri-bandet: eyebrow', default: '— Från butiken' },
    { name: 'findEyebrow', label: 'Hitta hit-sektionen: eyebrow', default: '— Hitta hit' },
  ],
  /* goal-59 TEMA-PAKET: mallen äger sitt SIDHUVUD (skylt: beige remsa → centrerat
     wordmark → menyrad), sin SIDFOT (mörkbrun platta i tre kolumner) och sina
     UNDERSIDOR (butiksberättelse med polaroider · menykort · "kom förbi"-kort).
     Funktionen är fortfarande plattformens — navens markup renderas i NavShell. */
  // ownsUtility: OliviaThymeNav ritar sin egen remsa ur utilityText (se ThemeChrome).
  chrome: { Nav: OliviaThymeNav, Footer: OliviaThymeFooter, ownsUtility: true },
  pages: { om: OliviaThymeOm, tjanster: OliviaThymeTjanster, kontakt: OliviaThymeKontakt },
  /* goal-59 VEKTOR-REGELN: modulen äger funktionen (AddToCart, livscykel, priser,
     leveranslöfte), mallen äger formen. Butiken = butikens skyltfönster (två stora
     kort per rad, stjärn-badge), bloggen = polaroid-väggen. Se oliviathyme.modules.tsx. */
  moduleViews: { shop: OliviaThymeShop, blogg: OliviaThymeBlogg },
}
