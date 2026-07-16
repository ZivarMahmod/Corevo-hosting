import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const component = fs.readFileSync(path.join(WEB_ROOT, 'components/admin/CalendarBoard.tsx'), 'utf8')

describe('kalenderns draggenväg med muspekare', () => {
  it('använder pointer capture i stället för native HTML5 drag and drop', () => {
    expect(component).not.toContain('draggable=')
    expect(component).not.toContain('onDragStart=')
    expect(component).not.toContain('onDragOver=')
    expect(component).not.toContain('onDrop=')
    expect(component).toContain('setPointerCapture')
    expect(component).toContain('onPointerCancel')
  })

  it('aktiveras bara för en fin muspekare på desktop', () => {
    expect(component).toContain("e.pointerType !== 'mouse'")
    expect(component).toContain("matchMedia('(min-width: 768px) and (pointer: fine)')")
  })

  it('släpper bara i en faktisk personalkolumn under pekaren', () => {
    expect(component).toMatch(/document\s*\.elementFromPoint\(clientX, clientY\)/)
    expect(component).toContain('data-calendar-staff-id')
    expect(component).toContain("target.dataset.calendarStaffId")
  })
})
