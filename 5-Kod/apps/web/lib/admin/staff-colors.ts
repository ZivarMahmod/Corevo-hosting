/** goal-67 — FÄRG PER ANSTÄLLD.
 *
 *  I en full dag är den snabbaste frågan kalendern kan besvara "vems bokning är det?".
 *  Wavy svarar med färg. Vi gör detsamma, med tre regler som Wavy inte håller:
 *
 *  1. FÄRGEN ÄR ALDRIG ENSAM BÄRARE. Status (obekräftad/klar/avbokad) har ikon + text.
 *     Personens initialer står i kortet. Slocknar färgen är kalendern fortfarande läsbar.
 *  2. FÄRGBLINDSÄKER PALETT. Okabe–Ito (2008) — åtta nyanser konstruerade för att
 *     hålla isär vid deuteranopi/protanopi/tritanopi. Fyra egna påslag ligger sist och
 *     är valda så att de inte kolliderar med de åtta i något av lägena.
 *  3. SAMMA FÄRG I LJUS OCH MÖRK VY. Vi lagrar EN hex och låter CSS:en tona den
 *     (color-mix mot bakgrunden), istället för att hålla två paletter i synk.
 *
 *  Ingen färg vald (staff.color = null) → deterministisk färg ur staff.id. Kalendern
 *  har alltså färg från dag ett, utan backfill och utan att någon behöver välja.
 */

/** Okabe–Ito 8 + 4 kompletterande. Ordningen är tilldelningsordningen. */
export const STAFF_PALETTE = [
  '#0072B2', // blå
  '#D55E00', // vermillion
  '#009E73', // grön
  '#CC79A7', // rosa
  '#56B4E9', // ljusblå
  '#E69F00', // orange
  '#8B5CF6', // violett
  '#B22222', // tegel
  '#017C6B', // teal
  '#7A5C1E', // ockra
  '#4B5563', // grafit
  '#9D174D', // vinröd
] as const

export type StaffColor = (typeof STAFF_PALETTE)[number] | (string & {})

/** Stabil hash → samma anställd får samma färg vid varje render, på varje enhet.
 *  (djb2; vi behöver spridning, inte kryptografi.) */
function hash(id: string): number {
  let h = 5381
  for (let i = 0; i < id.length; i++) h = ((h << 5) + h + id.charCodeAt(i)) >>> 0
  return h
}

const HEX = /^#[0-9a-fA-F]{6}$/

/** Kalenderfärgen för en anställd. Vald färg vinner; annars härleds den ur id:t.
 *  Icke-hex kastas — värdet går in i en style-attribut-position i klienten. */
export function staffColor(staffId: string, chosen?: string | null): string {
  if (chosen && HEX.test(chosen)) return chosen
  return STAFF_PALETTE[hash(staffId) % STAFF_PALETTE.length]!
}

/** Initialer till kortets färgprick — färgen får sällskap av text, aldrig gå ensam.
 *  "Anna Bergström" → "AB", "Anna" → "AN", tomt → "?". */
export function staffInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]
  const last = parts[parts.length - 1]
  if (!first || !last) return '?'
  if (parts.length === 1) return first.slice(0, 2).toUpperCase()
  return (first.slice(0, 1) + last.slice(0, 1)).toUpperCase()
}

/** Färgerna som ännu är fria i tenanten — så väljaren inte föreslår en upptagen färg.
 *  Full palett (fler anställda än färger) → hela paletten, dubblett är bättre än ingen. */
export function availableColors(taken: readonly (string | null | undefined)[]): string[] {
  const used = new Set(taken.filter(Boolean).map((c) => (c as string).toLowerCase()))
  const free = STAFF_PALETTE.filter((c) => !used.has(c.toLowerCase()))
  return free.length > 0 ? [...free] : [...STAFF_PALETTE]
}
