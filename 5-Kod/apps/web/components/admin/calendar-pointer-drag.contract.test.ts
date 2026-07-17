import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const component = fs.readFileSync(path.join(WEB_ROOT, 'components/admin/CalendarBoard.tsx'), 'utf8')
const css = fs.readFileSync(path.join(WEB_ROOT, 'components/admin/calendar.module.css'), 'utf8')

describe('kalenderns draggenväg med mus och touch', () => {
  it('använder pointer capture i stället för native HTML5 drag and drop', () => {
    expect(component).not.toContain('draggable=')
    expect(component).not.toContain('onDragStart=')
    expect(component).not.toContain('onDragOver=')
    expect(component).not.toContain('onDrop=')
    expect(component).toContain('setPointerCapture')
    expect(component).toContain('onPointerCancel')
  })

  it('aktiveras för fin muspekare eller touch via bokningens draghandtag', () => {
    expect(component).toContain("e.pointerType === 'mouse'")
    expect(component).toContain("matchMedia('(min-width: 768px) and (pointer: fine)')")
    expect(component).toContain("e.pointerType === 'touch' || e.pointerType === 'pen'")
    expect(component).toContain("closest('[data-booking-drag-handle]')")
    expect(component).toContain('data-booking-drag-handle')
  })

  it('låter bara draghandtaget ta touchgesten och visar aktiv återkoppling', () => {
    expect(css).toMatch(/\.touchDragHandle\s*\{[\s\S]*?touch-action:\s*none;/)
    expect(css).toMatch(/@media \(pointer:\s*coarse\)[\s\S]*?\.touchDragHandle\s*\{[\s\S]*?display:\s*inline-flex;/)
    expect(component).toContain('styles.blockTouchDragging')
    expect(component).toContain('<Icon name="grip"')
  })

  it('släpper bara i en faktisk personalkolumn under pekaren', () => {
    expect(component).toMatch(/document\s*\.elementFromPoint\(clientX, clientY\)/)
    expect(component).toContain('data-calendar-staff-id')
    expect(component).toContain("target.dataset.calendarStaffId")
  })
})
