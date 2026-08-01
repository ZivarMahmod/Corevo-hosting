import { describe, expect, it } from 'vitest'
import { foldIcsLine, icsEscape, icsUtcStamp, serializeIcs } from './ics'

const octets = (value: string) => new TextEncoder().encode(value).byteLength

describe('RFC5545 calendar helpers', () => {
  it('escapes TEXT delimiters and turns every newline into inert text', () => {
    const escaped = icsEscape('A\\B;C,D\r\nBEGIN:VEVENT\nX\rY')

    expect(escaped).toBe('A\\\\B\\;C\\,D\\nBEGIN:VEVENT\\nX\\nY')
    expect(escaped).not.toMatch(/[\r\n]/)
  })

  it('folds UTF-8 content at 75 octets without splitting a code point', () => {
    const logical = `SUMMARY:${'å'.repeat(50)}`
    const physical = foldIcsLine(logical).split('\r\n')

    expect(physical.length).toBeGreaterThan(1)
    expect(physical.every((line) => octets(line) <= 75)).toBe(true)
    expect(physical.slice(1).every((line) => line.startsWith(' '))).toBe(true)
    expect(physical.map((line, index) => index === 0 ? line : line.slice(1)).join('')).toBe(logical)
    expect(foldIcsLine('A'.repeat(75))).toBe('A'.repeat(75))
    expect(foldIcsLine('A'.repeat(76))).toBe(`${'A'.repeat(75)}\r\n A`)
  })

  it('serializes folded content with CRLF only and a final CRLF', () => {
    const calendar = serializeIcs(['BEGIN:VCALENDAR', `DESCRIPTION:${'å'.repeat(50)}`, 'END:VCALENDAR'])

    expect(calendar.endsWith('\r\n')).toBe(true)
    expect(calendar.replaceAll('\r\n', '')).not.toMatch(/[\r\n]/)
    expect(calendar.split('\r\n').filter(Boolean).every((line) => octets(line) <= 75)).toBe(true)
  })

  it('normalizes offset timestamps to UTC across Stockholm DST', () => {
    expect(icsUtcStamp('2026-07-22T12:00:00+02:00')).toBe('20260722T100000Z')
    expect(icsUtcStamp('2026-12-22T12:00:00+01:00')).toBe('20261222T110000Z')
    expect(() => icsUtcStamp('not-a-date')).toThrow('invalid_ics_timestamp')
  })

  it('rejects raw line breaks before folding', () => {
    expect(() => foldIcsLine('SUMMARY:ok\r\nBEGIN:VEVENT')).toThrow('invalid_ics_line')
  })
})
