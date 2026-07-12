// Onboarding-studio — PURE placeholder-ord härledda ur den valda BRANSCHEN.
// Bugfix: preview-attrappens namn/slug var hårdkodade "Din salong"/"dinsalong"
// oavsett bransch — en florist som valt Blomsterhandel såg "DIN SALONG" i
// mallens hero/footer. Regeln är medvetet enkel: branschens FÖRSTA ord med
// gemener bakom "Din " ("Blomsterhandel" → "Din blomsterhandel", "Salong &
// barber" → "Din salong"); ingen bransch vald → neutralt "Ditt företag"
// (ALDRIG salong). Ingen server-import — konsumeras av klient-preview-leaves.

/** Första ordet i bransch-namnet, trimmat ('' när namnet saknas/är tomt). */
function firstWord(branchName: string | null | undefined): string {
  return (branchName ?? '').trim().split(/\s+/)[0] ?? ''
}

/** Attrapp-VISNINGSNAMN: "Din <branschens första ord, gemener>", fallback "Ditt företag". */
export function studioPlaceholderName(branchName: string | null | undefined): string {
  const word = firstWord(branchName).toLowerCase()
  return word ? `Din ${word}` : 'Ditt företag'
}

/** Attrapp-SLUG: "din<bransch-ord>" subdomän-säkert (åä→a, ö→o, é→e, bara a–z0–9),
 *  fallback "dittforetag" — även när bransch-ordet saknar slug-bara tecken. */
export function studioPlaceholderSlug(branchName: string | null | undefined): string {
  const word = firstWord(branchName)
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/[^a-z0-9]/g, '')
  return word ? `din${word}` : 'dittforetag'
}

/** Slår upp branschens visningsnamn ur presets-verticals (cfg bär bara KEY:n).
 *  null när ingen bransch är vald eller nyckeln är okänd → helpers ger neutralen. */
export function studioBranchName(
  verticals: { key: string; name: string }[],
  branchKey: string | null | undefined,
): string | null {
  if (!branchKey) return null
  return verticals.find((v) => v.key === branchKey)?.name ?? null
}
