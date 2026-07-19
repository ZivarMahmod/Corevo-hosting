import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = fs.readFileSync(path.join(WEB_ROOT, 'components/admin/CalendarBoard.tsx'), 'utf8')
const drawer = fs.readFileSync(path.join(WEB_ROOT, 'components/admin/BookingDrawer.tsx'), 'utf8')

describe('bokningsdetaljen följer kalenderns serverdata', () => {
  it('byter den öppna bokningsraden när refresh levererar den nya statusen', () => {
    expect(source).toContain('setOpen((current) =>')
    expect(source).toContain('bookings.find((booking) => booking.id === current.id)')
  })

  it('erbjuder bara slutförande när besöket faktiskt har nått sluttiden', () => {
    expect(drawer).toContain("if (isPast && can('completed'))")
    expect(drawer).not.toContain('Behöver avslutas.')
    expect(drawer).not.toContain('auto-klar')
  })

  it('ersätter avboka och omboka med endast utfallsval när en aktiv bokning passerat', () => {
    expect(drawer).toContain("if (!isPast && can('cancelled'))")
    expect(drawer).toContain('&& !outcomeReady')
  })

  it('stänger cancelled-återställning vid starttiden, inte först vid sluttiden', () => {
    expect(drawer).toContain('bookingStartPassed')
    expect(drawer).toContain("booking.status === 'cancelled' && bookingStartPassed")
  })

  it('rättar terminalt utfall direkt utan att återöppna bokningen', () => {
    expect(drawer).toContain("label: 'Rätta till uteblev', target: 'no_show'")
    expect(drawer).toMatch(/label:\s*'Rätta till genomförd',[\s\S]*?target:\s*'completed'/)
    expect(drawer).not.toContain("label: 'Öppna igen', target: 'confirmed'")
  })
})
