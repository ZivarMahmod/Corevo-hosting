import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const component = fs.readFileSync(path.join(WEB_ROOT, 'components/admin/CalendarBoard.tsx'), 'utf8')
const css = fs.readFileSync(path.join(WEB_ROOT, 'components/admin/calendar.module.css'), 'utf8')
const gestures = fs.readFileSync(
  path.join(WEB_ROOT, 'components/admin/calendar-gestures.ts'),
  'utf8',
)

describe('kalenderns draggenväg med mus och touch', () => {
  it('använder pointer capture i stället för native HTML5 drag and drop', () => {
    expect(component).not.toContain('draggable=')
    expect(component).not.toContain('onDragStart=')
    expect(component).not.toContain('onDragOver=')
    expect(component).not.toContain('onDrop=')
    expect(component).toContain('setPointerCapture')
    expect(component).toContain('onPointerCancel')
  })

  it('aktiveras för fin muspekare eller långtryck på hela bokningen', () => {
    expect(component).toContain("e.pointerType === 'mouse'")
    expect(component).toContain("matchMedia('(min-width: 768px) and (pointer: fine)')")
    expect(component).toContain("e.pointerType === 'touch' || e.pointerType === 'pen'")
    expect(component).toContain('TOUCH_DRAG_HOLD_MS')
    expect(component).toContain('data-calendar-booking')
    expect(component).not.toContain('data-booking-drag-handle')
  })

  it('behåller vertikal scroll tills långtryck och faktisk förflyttning aktiverar drag', () => {
    expect(css).toMatch(
      /@media \(pointer:\s*coarse\), \(any-pointer:\s*coarse\)[\s\S]*?\.blockDrag\s*\{[\s\S]*?touch-action:\s*pan-y pinch-zoom;/,
    )
    expect(css).not.toMatch(/\.blockDrag\s*\{[\s\S]*?touch-action:\s*none;/)
    expect(component).toContain(
      "addEventListener('touchmove', preventTouchScroll, { passive: false })",
    )
    expect(component).toContain('moved: false')
    expect(component).toContain('if (!drag.active) return')
    expect(component).toContain('styles.blockTouchDragging')
    expect(gestures).toContain('TOUCH_DRAG_HOLD_MS = 500')
    expect(gestures).toContain('TOUCH_DRAG_SLOP_PX = 10')
    expect(component).toContain('cancelPressCandidate')
    expect(component).not.toContain('<Icon name="grip"')
  })

  it('öppnar direkt och lyfter en fast ghost utan textmarkering eller callout', () => {
    expect(component).toContain('onOpen(booking)')
    expect(component).not.toContain('CalendarBubble')
    expect(component).toContain('styles.blockGhost')
    expect(component).toContain('grabOffsetX')
    expect(component).toContain('grabOffsetY')
    expect(component).toContain('edgeAutoScrollVelocity')
    expect(css).toMatch(/\.blockDrag\s*\{[\s\S]*?user-select:\s*none;/)
    expect(css).toMatch(/\.blockDrag\s*\{[\s\S]*?-webkit-user-select:\s*none;/)
    expect(css).toMatch(/\.blockDrag\s*\{[\s\S]*?-webkit-touch-callout:\s*none;/)
  })

  it('släpper bara i en faktisk personalkolumn under pekaren', () => {
    expect(component).toMatch(/document\s*\.elementFromPoint\(pointer\.clientX, pointer\.clientY\)/)
    expect(component).toContain('data-calendar-staff-id')
    expect(component).toContain('target.dataset.calendarStaffId')
  })
})
