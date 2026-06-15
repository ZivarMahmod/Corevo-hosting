import { describe, it, expect } from 'vitest'
import {
  cleanTerminology,
  resolveTerm,
  termPlural,
  makeTerm,
  modulesForVertical,
  type VerticalPresetData,
} from './verticals-shared'

// Bransch-terminologi-resolvern (multi-bransch Fas 4, K20) sheppades UTAN tester.
// Den styr varje admin-etikett (Stylist/Barberare/Nagelteknolog/Personal) och är
// PUR + klient-säker, så dessa tester nålar fast kontraktet som koden lutar sig mot:
//   • precedensen  override → fallback → default → key  (returnerar ALDRIG blankt)
//   • NO-REGRESSION-garantin: tom overlay (eller 'generell' bransch) renderar EXAKT
//     call-sajtens nuvarande svenska ord → att wira en yta kan aldrig regressa den.
//   • "gissar ALDRIG svensk böjning": termPlural läser bara explicit <key>_plural,
//     härleder aldrig plural ur singularen (Barberare→Barberare, Rätt→Rätter).
// modulesForVertical (samma fil, också otestad) täcks med — preset-staterna + att
// booking faller tillbaka till 'live' och allt annat till 'off'.

// ── cleanTerminology — rårendering av jsonb → ren { key: label } ─────────────────
describe('cleanTerminology', () => {
  it('icke-objekt (null/undefined/string/number) → {}', () => {
    expect(cleanTerminology(null)).toEqual({})
    expect(cleanTerminology(undefined)).toEqual({})
    expect(cleanTerminology('Stylist')).toEqual({})
    expect(cleanTerminology(42)).toEqual({})
  })

  it('array förkastas (jsonb-array är inte en giltig overlay)', () => {
    expect(cleanTerminology(['staff', 'Stylist'])).toEqual({})
  })

  it('behåller string-värden och trimmar dem', () => {
    expect(cleanTerminology({ staff: '  Stylist  ', service: 'Klippning' })).toEqual({
      staff: 'Stylist',
      service: 'Klippning',
    })
  })

  it('släpper tomma, whitespace-bara och icke-string-värden', () => {
    expect(
      cleanTerminology({
        staff: '',
        service: '   ',
        unit: 'Stol',
        n: 5,
        b: true,
        nested: { x: 1 },
        nil: null,
      }),
    ).toEqual({ unit: 'Stol' })
  })
})

// ── resolveTerm — singular-etikett, precedens override→fallback→default→key ──────
describe('resolveTerm', () => {
  it('1. vertikalens override vinner (trimmas)', () => {
    expect(resolveTerm({ staff: '  Barberare ' }, 'staff', 'Personal')).toBe('Barberare')
  })

  it('2. call-sajtens fallback används när override saknas', () => {
    expect(resolveTerm({}, 'staff', 'Frisör')).toBe('Frisör')
    expect(resolveTerm(null, 'staff', 'Frisör')).toBe('Frisör')
    expect(resolveTerm(undefined, 'staff', 'Frisör')).toBe('Frisör')
  })

  it('3. generisk default när varken override eller fallback finns', () => {
    expect(resolveTerm({}, 'staff')).toBe('Personal')
    expect(resolveTerm({}, 'service')).toBe('Tjänst')
    expect(resolveTerm({}, 'unit')).toBe('Resurs')
  })

  it('4. nyckeln själv som sista utväg — returnerar ALDRIG blankt', () => {
    expect(resolveTerm({}, 'mystery')).toBe('mystery')
    expect(resolveTerm(null, 'mystery')).toBe('mystery')
  })

  it('tom/whitespace override faller igenom till fallback (no-regression)', () => {
    expect(resolveTerm({ staff: '' }, 'staff', 'Frisör')).toBe('Frisör')
    expect(resolveTerm({ staff: '   ' }, 'staff', 'Frisör')).toBe('Frisör')
  })

  it('tom/whitespace fallback ignoreras → default tar vid', () => {
    expect(resolveTerm({}, 'staff', '')).toBe('Personal')
    expect(resolveTerm({}, 'staff', '   ')).toBe('Personal')
  })

  it('NO-REGRESSION: tom overlay renderar EXAKT call-sajtens ord', () => {
    // Varje wirad yta skickar sin nuvarande hårdkodade svenska som fallback.
    expect(resolveTerm({}, 'staff', 'Medarbetare')).toBe('Medarbetare')
    expect(resolveTerm({}, 'service', 'Tjänst')).toBe('Tjänst')
  })

  it('fallback returneras VERBATIM (otrimmad) — bara override-vägen trimmas', () => {
    // Kontraktet är asymmetriskt: override.trim() men `return fallback` rakt av.
    // Ofarligt i praktiken (call-sajter skickar rena literaler) men nålas fast här.
    expect(resolveTerm({}, 'staff', '  Frisör  ')).toBe('  Frisör  ')
  })

  it('böjer ALDRIG — singular-override returneras ordagrant', () => {
    expect(resolveTerm({ staff: 'Stylist' }, 'staff', 'Personal')).toBe('Stylist')
  })
})

// ── termPlural — bara explicit <key>_plural, härleder aldrig böjning ─────────────
describe('termPlural', () => {
  it('läser <key>_plural-override (trimmas)', () => {
    expect(termPlural({ staff_plural: '  Stylister ' }, 'staff', 'Personal')).toBe('Stylister')
  })

  it('faller tillbaka till call-sajtens plural när <key>_plural saknas', () => {
    expect(termPlural({}, 'staff', 'Personal')).toBe('Personal')
    expect(termPlural(null, 'staff', 'Personal')).toBe('Personal')
    expect(termPlural(undefined, 'staff', 'Personal')).toBe('Personal')
  })

  it('singular-override ensam driver INTE pluralen', () => {
    // staff:'Stylist' finns men inget staff_plural → fallbacken står kvar.
    expect(termPlural({ staff: 'Stylist' }, 'staff', 'Personal')).toBe('Personal')
  })

  it('tom/whitespace <key>_plural → fallback (no-regression)', () => {
    expect(termPlural({ staff_plural: '   ' }, 'staff', 'Personal')).toBe('Personal')
  })

  it('härleder ALDRIG svensk plural ur singularen (oregelbunden böjning)', () => {
    // Barberare→Barberare, Rätt→Rätter: olika mönster → får aldrig gissas.
    expect(termPlural({ staff: 'Barberare' }, 'staff', 'Barberare')).toBe('Barberare')
    expect(termPlural({ service: 'Rätt' }, 'service', 'Rätter')).toBe('Rätter')
  })
})

// ── makeTerm — bunden closure = resolveTerm med fast terminologi ─────────────────
describe('makeTerm', () => {
  it('returnerar en term(key, fallback)-closure med samma precedens', () => {
    const term = makeTerm({ staff: 'Stylist' })
    expect(term('staff', 'Personal')).toBe('Stylist') // override
    expect(term('service', 'Tjänst')).toBe('Tjänst') // fallback
    expect(term('unit')).toBe('Resurs') // default
    expect(term('mystery')).toBe('mystery') // key
  })

  it('null terminologi → ren fallback/default-väg', () => {
    const term = makeTerm(null)
    expect(term('staff', 'Medarbetare')).toBe('Medarbetare')
    expect(term('staff')).toBe('Personal')
  })
})

// ── modulesForVertical — preset-stater + off/booking-live-fallback ───────────────
const vData = (over: Partial<VerticalPresetData> = {}): VerticalPresetData => ({
  verticals: [
    {
      key: 'frisor',
      name: 'Frisör',
      defaultTemplate: 'salvia',
      defaultModules: { booking: 'live', shop: 'draft' },
      terminology: { staff: 'Stylist' },
    },
  ],
  modules: [
    { key: 'booking', name: 'Bokning' },
    { key: 'shop', name: 'Webshop' },
    { key: 'blogg', name: 'Blogg' },
  ],
  templatesByVertical: {},
  ...over,
})

describe('modulesForVertical', () => {
  it('ingen bransch vald → booking live, allt annat off', () => {
    expect(modulesForVertical(vData(), null)).toEqual([
      { key: 'booking', name: 'Bokning', defaultState: 'live' },
      { key: 'shop', name: 'Webshop', defaultState: 'off' },
      { key: 'blogg', name: 'Blogg', defaultState: 'off' },
    ])
  })

  it('vald bransch applicerar sina preset-stater; modul utan preset → off', () => {
    expect(modulesForVertical(vData(), 'frisor')).toEqual([
      { key: 'booking', name: 'Bokning', defaultState: 'live' }, // preset
      { key: 'shop', name: 'Webshop', defaultState: 'draft' }, // preset
      { key: 'blogg', name: 'Blogg', defaultState: 'off' }, // ej i preset → off
    ])
  })

  it('okänd branschnyckel → allt faller tillbaka (booking live, resten off)', () => {
    expect(modulesForVertical(vData(), 'finnsinte').map((o) => o.defaultState)).toEqual([
      'live',
      'off',
      'off',
    ])
  })
})
