/**
 * Per-mall-kapabiliteter för Sida-flikens redigering (Zivar: "om en grej man kan
 * ändra inte berör en mall ska den inte synas som ändringsalternativ"). Kartlagt ur
 * layouternas FAKTISKA content-användning (grep i components/storefront/layouts/*):
 *
 *   heroEyebrow  — alla HEM-layouter utom FreshCut renderar den lilla eyebrow-raden.
 *   homeStats    — fakta/statistik-griden renderas på HEM i alla mallar utom FreshCut.
 *   homeGallery  — galleri-sektionen på HEM finns bara i FreshCut/Salvia/Leander.
 *
 * Fält som INTE listas här gäller ALLA mallar via de DELADE undersidorna: /om
 * renderar AboutSplit (aboutCopy + aboutImage), AccentPhrase (italic),
 * StylistSpotlights (team) och ClosingCta (closingImage) för varje mall; /kontakt
 * ClosingCta. Byter man mall försvinner/dyker kontrollerna upp — sparade värden
 * ligger kvar i tenant_settings och återanvänds när mallen väljs igen.
 */
export type ThemeCaps = {
  heroEyebrow: boolean
  homeStats: boolean
  homeGallery: boolean
  /** HEM-layouten har en egen om-sektion (aboutCopyHome kan avvika från Om oss-sidan). */
  homeAbout: boolean
}

const DEFAULT_CAPS: ThemeCaps = { heroEyebrow: true, homeStats: true, homeGallery: false, homeAbout: false }

export const THEME_CAPS: Record<string, ThemeCaps> = {
  freshcut: { heroEyebrow: false, homeStats: false, homeGallery: true, homeAbout: true },
  salvia: { heroEyebrow: true, homeStats: true, homeGallery: true, homeAbout: true },
  leander: { heroEyebrow: true, homeStats: true, homeGallery: true, homeAbout: false },
  zigge: { heroEyebrow: true, homeStats: true, homeGallery: false, homeAbout: false },
  linnea: { heroEyebrow: true, homeStats: true, homeGallery: false, homeAbout: false },
  edit: { heroEyebrow: true, homeStats: true, homeGallery: false, homeAbout: true },
  // goal-57 körning 13: flora saknade egen rad (fick DEFAULT_CAPS med gallery av)
  // trots att layouten renderar galleri-band + pelar-bilder ur galleryImages[0..2]
  // och om-sektion ur aboutCopyHome — bilderna gick inte att byta i editorn (D3).
  flora: { heroEyebrow: true, homeStats: true, homeGallery: true, homeAbout: true },
}

export function themeCaps(key: string): ThemeCaps {
  return THEME_CAPS[key] ?? DEFAULT_CAPS
}

/** Mall-EGNA extrafält på HEM (utöver de generella hero-fälten): fält + mallens
 *  inbyggda standardtext (layoutens fasta prosa). Redigeras i Sida-flikens Hem-flik;
 *  tomt = layoutens inbyggda text fortsätter gälla. */
export type ExtraField = { name: string; label: string; hint?: string; rows?: number; default: string }

export const THEME_EXTRA_HOME: Record<string, ExtraField[]> = {
  // goal-57 körning 13 (D1/D4): floras pelare + invävda modul-band — varje synlig
  // text på hemmet redigerbar. Defaults = layoutens inbyggda strängar (FloraLayout).
  flora: [
    { name: 'pillar1Title', label: 'Pelare 1: rubrik', default: 'Beställ blommor' },
    { name: 'pillar1Body', label: 'Pelare 1: text', rows: 2, default: 'Buketter i säsong — floristen väljer det finaste. Hämta i butik eller skicka bud.' },
    { name: 'pillar1Link', label: 'Pelare 1: länktext', default: 'Till butiken' },
    { name: 'pillar2Title', label: 'Pelare 2: rubrik', default: 'Bröllop & avsked' },
    { name: 'pillar2Body', label: 'Pelare 2: text', rows: 2, default: 'Handbundna brudbuketter, corsage och binderier — eller ett personligt, vackert farväl.' },
    { name: 'pillar2Link', label: 'Pelare 2: länktext', default: 'Begär offert' },
    { name: 'pillar3Title', label: 'Pelare 3: rubrik', default: 'Kurser & kvällar' },
    { name: 'pillar3Body', label: 'Pelare 3: text', rows: 2, default: 'Bukett & bubbel för ert sällskap — en kreativ stund med blommor i säsong.' },
    { name: 'pillar3Link', label: 'Pelare 3: länktext', default: 'Boka kurs' },
    { name: 'shopEyebrow', label: 'Butiks-bandet: eyebrow', default: '— Ur butiken' },
    { name: 'shopTitle', label: 'Butiks-bandet: rubrik', default: 'Beställ något vackert' },
    { name: 'shopCta', label: 'Butiks-bandet: knapptext', default: 'Visa hela butiken' },
    { name: 'blogEyebrow', label: 'Blogg-bandet: eyebrow', default: '— Från bloggen' },
    { name: 'blogTitle', label: 'Blogg-bandet: rubrik', default: 'Säsong, tips & inspiration' },
    { name: 'blogCta', label: 'Blogg-bandet: knapptext', default: 'Läs hela bloggen' },
    { name: 'giftEyebrow', label: 'Presentkort-raden: eyebrow', default: '— Presentkort' },
    { name: 'giftLede', label: 'Presentkort-raden: text', default: 'Ge bort en blomstrande stund.' },
    { name: 'giftCta', label: 'Presentkort-raden: länktext', default: 'Till presentkorten' },
    { name: 'galleryEyebrow', label: 'Galleri: eyebrow', default: '— Galleri' },
    { name: 'findEyebrow', label: 'Plats-sektionen: eyebrow', default: '— Hitta till butiken' },
    // closingTitle/closingLede redigeras i Om oss-fliken (delade avslutnings-fälten)
    // — flora-defaults hanteras i SidaStudio (FLORA_CLOSING) så de inte dubbleras här.
  ],
  freshcut: [
    {
      name: 'homeSecondTitle',
      label: 'Rubrik, mittensektionen',
      hint: 'Den stora rubriken över gallerisektionen.',
      default: 'Mer än bara en frisörsalong.',
    },
    {
      name: 'whyTitle',
      label: '"Varför oss"-rubrik',
      hint: 'Rubriken i den mörka avslutningssektionen.',
      default: 'Varför Oss?',
    },
    {
      name: 'whySub',
      label: '"Varför oss"-underrad',
      default: 'Välj den bästa. Såklart.',
    },
    {
      name: 'whyBody',
      label: '"Varför oss"-text',
      rows: 5,
      default:
        'Fresh Cut är en utmärkt val för herrklippning av flera anledningar. För det första är våra frisörer mycket erfarna och kunniga när det gäller att klippa herrhår, vilket garanterar en hög kvalitet på klippningen. För det andra använder Fresh Cut endast de bästa produkterna för att se till att varje klippning resulterar i ett snyggt och välvårdat hår. Slutligen har Fresh Cut en avslappnad och trevlig atmosfär, vilket gör det till en bekväm och avkopplande plats att besöka för en klippning.',
    },
  ],
}
