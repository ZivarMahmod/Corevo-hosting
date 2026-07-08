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
}

export function themeCaps(key: string): ThemeCaps {
  return THEME_CAPS[key] ?? DEFAULT_CAPS
}

/** Mall-EGNA extrafält på HEM (utöver de generella hero-fälten): fält + mallens
 *  inbyggda standardtext (layoutens fasta prosa). Redigeras i Sida-flikens Hem-flik;
 *  tomt = layoutens inbyggda text fortsätter gälla. */
export type ExtraField = { name: string; label: string; hint?: string; rows?: number; default: string }

export const THEME_EXTRA_HOME: Record<string, ExtraField[]> = {
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
