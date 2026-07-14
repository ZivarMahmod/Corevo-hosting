import { zonedTimeToUtc } from '@/lib/booking/tz'
import { addDays, addMonths } from '@/lib/admin/dates'

/** Återkommande blockering (goal-66, B-22/B-23): ren förekomstgenerator.
 *
 *  Serien MATERIALISERAS — varje förekomst blir en vanlig time_off-rad. Därför är
 *  det här den enda upprepningslogik som finns: kalendern, bokningsmotorn och
 *  realtidskanalen läser rader precis som förut.
 *
 *  DST är hela svårigheten. "Lunch 12:00 varje dag" ska vara 12:00 PÅ VÄGGKLOCKAN
 *  året runt — men UTC-avståndet mellan två svenska 12:00 är 23 h vid vårskiftet
 *  och 25 h vid höstskiftet. Att addera 24 h i millisekunder hade flyttat lunchen
 *  till 11:00/13:00 efter varje omställning. Därför stegar vi i KALENDERDAGAR och
 *  räknar om varje dag till UTC via zonedTimeToUtc — samma funktion som hela
 *  bokningsmotorn litar på.
 *
 *  Längden är däremot en VARAKTIGHET (45 min är 45 min); den följer med i ms. */

export const REPEAT_KINDS = ['ingen', 'dag', 'vardagar', 'vecka', 'varannan', 'ar'] as const
export type RepeatKind = (typeof REPEAT_KINDS)[number]

export const REPEAT_LABELS: Record<RepeatKind, string> = {
  ingen: 'Aldrig',
  dag: 'Varje dag',
  vardagar: 'Vardagar',
  vecka: 'Varje vecka',
  varannan: 'Varannan vecka',
  ar: 'Varje år',
}

/** Materialiseringshorisont. ponytail: serien tar slut efter ~12 månader och läggs
 *  om — det är priset för att slippa en RRULE-motor i läskedjan. */
const HORIZON_DAYS = 365

export type Occurrence = { startIso: string; endIso: string }

function localDateOf(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function localTimeOf(iso: string, tz: string): string {
  // hourCycle h23: '24:00' får aldrig läcka ur midnatt (h24 ger det).
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))
}

/** Mån–fre i salongens tidszon. Stegningen sker i lokala kalenderdagar, så en ren
 *  UTC-veckodag på datumsträngen räcker (datumet ÄR redan lokalt). */
function isWeekday(date: string): boolean {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay()
  return dow >= 1 && dow <= 5
}

/**
 * Alla förekomster för en serie, FÖRSTA INKLUSIVE. Första förekomsten är blocket
 * användaren faktiskt pekade ut — den filtreras aldrig bort (lägger någon en
 * "vardagar"-serie på en lördag är lördagen deras uttryckliga val; upprepningen
 * hamnar på vardagarna).
 */
export function seriesOccurrences(input: {
  startIso: string
  endIso: string
  repeat: RepeatKind
  tz: string
}): Occurrence[] {
  const first: Occurrence = { startIso: input.startIso, endIso: input.endIso }
  if (input.repeat === 'ingen') return [first]

  const durationMs = new Date(input.endIso).getTime() - new Date(input.startIso).getTime()
  const date0 = localDateOf(input.startIso, input.tz)
  const time0 = localTimeOf(input.startIso, input.tz)

  const at = (date: string): Occurrence => {
    const start = zonedTimeToUtc(date, time0, input.tz)
    return {
      startIso: start.toISOString(),
      endIso: new Date(start.getTime() + durationMs).toISOString(),
    }
  }

  const out: Occurrence[] = [first]

  if (input.repeat === 'ar') {
    // Årligen: nästa två år räcker som planeringshorisont. addMonths klampar
    // 29 feb → 28 feb i icke-skottår i stället för att spilla in i mars.
    for (let i = 1; i <= 2; i++) out.push(at(addMonths(date0, 12 * i)))
    return out
  }

  const stepDays = input.repeat === 'vecka' ? 7 : input.repeat === 'varannan' ? 14 : 1
  for (let d = stepDays; d <= HORIZON_DAYS; d += stepDays) {
    const date = addDays(date0, d)
    if (input.repeat === 'vardagar' && !isWeekday(date)) continue
    out.push(at(date))
  }
  return out
}
