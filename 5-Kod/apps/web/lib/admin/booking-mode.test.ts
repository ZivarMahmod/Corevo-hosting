import { describe, it, expect } from 'vitest'
import {
  bookingModeFromState,
  stateForMode,
  canSwitch,
  parseBookingMode,
  BOOKING_MODE_COPY,
  SWITCHABLE_MODES,
} from './booking-mode'

/** L3 C-03 — lägena ÄR tenant_modules.state, inte en ny flagga. Testet låser
 *  översättningen åt båda hållen och den enkelriktade dörren (off → på = super-admin). */
describe('bookingModeFromState', () => {
  it('saknad rad = På (historisk default: booking:live)', () => {
    expect(bookingModeFromState(undefined)).toBe('pa')
    expect(bookingModeFromState(null)).toBe('pa')
  })
  it('live = På, paused = Pausad', () => {
    expect(bookingModeFromState('live')).toBe('pa')
    expect(bookingModeFromState('paused')).toBe('pausad')
  })
  it('bara off = Av — off är den enda enkelriktade dörren (DB-vakt 0026)', () => {
    expect(bookingModeFromState('off')).toBe('av')
  })
  it('draft = Pausad — aldrig publik, men DB tillåter draft→live så kunden får tända', () => {
    expect(bookingModeFromState('draft')).toBe('pausad')
    expect(canSwitch('pausad', 'pa')).toBe(true)
  })
})

describe('stateForMode', () => {
  it('bara de växlingsbara lägena har ett state kunden får skriva', () => {
    expect(stateForMode('pa')).toBe('live')
    expect(stateForMode('pausad')).toBe('paused')
    expect(stateForMode('av')).toBeNull()
  })
  it('SWITCHABLE_MODES = exakt På + Pausad', () => {
    expect([...SWITCHABLE_MODES]).toEqual(['pa', 'pausad'])
  })
})

describe('canSwitch', () => {
  it('På ↔ Pausad går båda hållen', () => {
    expect(canSwitch('pa', 'pausad')).toBe(true)
    expect(canSwitch('pausad', 'pa')).toBe(true)
  })
  it('kunden kan aldrig välja Av (DB-vakten gör off→på super-admin-only)', () => {
    expect(canSwitch('pa', 'av')).toBe(false)
    expect(canSwitch('pausad', 'av')).toBe(false)
  })
  it('från Av kommer kunden ingenstans — bara Corevo sätter på igen', () => {
    expect(canSwitch('av', 'pa')).toBe(false)
    expect(canSwitch('av', 'pausad')).toBe(false)
  })
  it('samma läge är ingen växling', () => {
    expect(canSwitch('pa', 'pa')).toBe(false)
  })
})

describe('parseBookingMode', () => {
  it('accepterar bara de tre lägena', () => {
    expect(parseBookingMode('pa')).toBe('pa')
    expect(parseBookingMode('pausad')).toBe('pausad')
    expect(parseBookingMode('av')).toBe('av')
    expect(parseBookingMode('live')).toBeNull()
    expect(parseBookingMode(null)).toBeNull()
    expect(parseBookingMode(7)).toBeNull()
  })
})

describe('konsekvenstext', () => {
  it('varje läge har en konsekvens, inte bara en etikett', () => {
    for (const mode of ['pa', 'pausad', 'av'] as const) {
      expect(BOOKING_MODE_COPY[mode].label.length).toBeGreaterThan(1)
      expect(BOOKING_MODE_COPY[mode].consequence.length).toBeGreaterThan(20)
    }
  })
  it('inga bransch-ord i lägestexterna', () => {
    const all = Object.values(BOOKING_MODE_COPY)
      .flatMap((c) => [c.label, c.consequence])
      .join(' ')
      .toLowerCase()
    for (const w of ['salong', 'frisör', 'klippning', 'stylist', 'barber']) {
      expect(all).not.toContain(w)
    }
  })
})
