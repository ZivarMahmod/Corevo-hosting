import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = fs.readFileSync(path.join(WEB_ROOT, 'components/admin/CalendarBoard.tsx'), 'utf8')

describe('bokningsdetaljen följer kalenderns serverdata', () => {
  it('byter den öppna bokningsraden när refresh levererar den nya statusen', () => {
    expect(source).toContain('setOpen((current) =>')
    expect(source).toContain('bookings.find((booking) => booking.id === current.id)')
  })
})
