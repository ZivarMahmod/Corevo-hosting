// Rena vy-beräkningar för admin-översikten (goal-68). Ingen data-access, inga
// React-beroenden → enhetstestbara. Sidan (app/(admin)/admin/page.tsx) importerar
// dessa så tidslinje-geometri, beläggning och jämförelser kan verifieras isolerat.

/** Tidsanpassad hälsning efter timmen på dygnet (0–24). */
export function greetingFor(hour: number): string {
  if (hour < 10) return 'God morgon'
  if (hour < 17) return 'God dag'
  return 'God kväll'
}

/** "HH:MM[:SS]" → timmar som decimal (09:30 → 9.5). Skräp → 0. */
export function parseHM(hm: string): number {
  const parts = hm.split(':')
  const h = Number(parts[0])
  const m = Number(parts[1])
  return (Number.isFinite(h) ? h : 0) + (Number.isFinite(m) ? m : 0) / 60
}

/** Timme-på-dygnet (decimal) för en UTC-tidsstämpel i en given tidszon. */
export function hourInTz(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return (h % 24) + m / 60
}

/**
 * Block-geometri på tidslinjen: var ett besök (startH→endH) hamnar i dagsfönstret
 * [dayStartH, dayEndH], i procent av spårbredden. KLAMPAR mot fönstret så tider
 * utanför inte spiller ut, och hanterar midnattsövergången (endH som rullat till
 * nästa dygn, dvs endH <= startH → behandlas som dagsslut). width === 0 betyder
 * "helt utanför fönstret" → sidan ritar inget block.
 */
export function laneBlock(
  startH: number,
  endH: number,
  dayStartH: number,
  dayEndH: number,
): { left: number; width: number } {
  const span = Math.max(1e-6, dayEndH - dayStartH)
  // endH < startH = äkta datumövergång (t.ex. 23:00→00:30) → klampa till dagsslut.
  // endH === startH = nollängd → e=s nedan → bredd 0 (inget block), INTE en midnatt.
  const eAdj = endH < startH ? dayEndH : endH
  const s = Math.max(dayStartH, Math.min(startH, dayEndH))
  const e = Math.max(dayStartH, Math.min(eAdj, dayEndH))
  return {
    left: ((s - dayStartH) / span) * 100,
    width: Math.max(0, ((e - s) / span) * 100),
  }
}

/** Beläggning = bokade minuter / arbetsminuter, heltalsprocent, tak 100. 0 om ingen
 *  arbetstid (undviker division med noll). */
export function occupancyPct(bookedMin: number, availableMin: number): number {
  if (availableMin <= 0) return 0
  return Math.min(100, Math.round((bookedMin / availableMin) * 100))
}

/** Procentförändring mot en jämförelsedag. null när jämförelsen saknar underlag
 *  (prev <= 0) → chipet döljs i stället för att visa en falsk 0%. */
export function comparisonPct(today: number, prev: number): number | null {
  if (prev <= 0) return null
  return Math.round(((today - prev) / prev) * 100)
}

/** Minuter kvar till en tidpunkt, aldrig negativt. */
export function countdownMinutes(fromMs: number, toMs: number): number {
  return Math.max(0, Math.round((toMs - fromMs) / 60000))
}

/** "HH:MM[:SS]" → minuter sedan midnatt. */
export function hmToMinutes(t: string): number {
  const parts = t.split(':')
  const h = Number(parts[0])
  const m = Number(parts[1])
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

/** Summa arbetsminuter av (ev. överlappande) pass — slår ihop överlapp först så en
 *  personal med två inmatade pass 09–13 + 12–15 räknas som 09–15 (360 min), inte 420.
 *  DB tillåter överlapp, så beläggningens nämnare skulle annars bli för stor. */
export function sumMergedMinutes(intervals: [number, number][]): number {
  if (intervals.length === 0) return 0
  const sorted = [...intervals].sort((a, b) => a[0] - b[0])
  let total = 0
  let [curStart, curEnd] = sorted[0]!
  for (let i = 1; i < sorted.length; i++) {
    const [s, e] = sorted[i]!
    if (s <= curEnd) {
      curEnd = Math.max(curEnd, e)
    } else {
      total += Math.max(0, curEnd - curStart)
      curStart = s
      curEnd = e
    }
  }
  return total + Math.max(0, curEnd - curStart)
}
