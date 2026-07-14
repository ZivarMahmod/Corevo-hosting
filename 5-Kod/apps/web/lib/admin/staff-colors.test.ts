import { describe, expect, it } from 'vitest'
import { STAFF_PALETTE, availableColors, staffColor, staffInitials } from './staff-colors'

describe('staffColor', () => {
  it('vald hex-färg vinner över den härledda', () => {
    expect(staffColor('abc', '#123456'))/**/.toBe('#123456')
  })

  it('skräp i color-kolumnen når aldrig style-attributet', () => {
    // Värdet hamnar i en inline-style i klienten. DB har en check-constraint, men
    // vakten står även här: en rad skriven före 0062 kan bära vad som helst.
    for (const junk of ['red', 'rgb(1,2,3)', 'javascript:alert(1)', '#abc', '']) {
      expect(staffColor('abc', junk)).toMatch(/^#[0-9A-F]{6}$/i)
      expect(staffColor('abc', junk)).not.toBe(junk)
    }
  })

  it('samma id ger alltid samma färg (stabil över renders och enheter)', () => {
    const id = '9f1c7e2a-0000-4000-8000-000000000001'
    expect(staffColor(id)).toBe(staffColor(id))
  })

  it('härledd färg ligger alltid i paletten', () => {
    for (let i = 0; i < 200; i++) {
      expect(STAFF_PALETTE).toContain(staffColor(`staff-${i}`) as (typeof STAFF_PALETTE)[number])
    }
  })

  it('sprider sig över paletten — inte alla i samma hink', () => {
    const seen = new Set(Array.from({ length: 60 }, (_, i) => staffColor(`s${i}`)))
    expect(seen.size).toBeGreaterThanOrEqual(8)
  })
})

describe('staffInitials', () => {
  it('förnamn + efternamn', () => expect(staffInitials('Anna Bergström')).toBe('AB'))
  it('mellannamn hoppas över — första och sista', () =>
    expect(staffInitials('Anna Li Bergström')).toBe('AB'))
  it('ett namn → två tecken', () => expect(staffInitials('Anna')).toBe('AN'))
  it('tomt namn kraschar inte kortet', () => expect(staffInitials('   ')).toBe('?'))
})

describe('availableColors', () => {
  it('föreslår aldrig en upptagen färg', () => {
    const free = availableColors([STAFF_PALETTE[0], STAFF_PALETTE[1]])
    expect(free).not.toContain(STAFF_PALETTE[0])
    expect(free).toHaveLength(STAFF_PALETTE.length - 2)
  })

  it('okänsligt för versalisering (DB kan bära #ABCDEF)', () => {
    expect(availableColors([STAFF_PALETTE[0].toUpperCase()])).not.toContain(STAFF_PALETTE[0])
  })

  it('full palett → hela paletten igen (dubblett slår tom väljare)', () => {
    expect(availableColors([...STAFF_PALETTE])).toHaveLength(STAFF_PALETTE.length)
  })
})
