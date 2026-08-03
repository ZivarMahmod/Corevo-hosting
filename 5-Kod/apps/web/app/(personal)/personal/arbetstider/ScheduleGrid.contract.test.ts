import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./ScheduleGrid.tsx', import.meta.url), 'utf8')
const css = readFileSync(new URL('./ScheduleGrid.module.css', import.meta.url), 'utf8')

describe('personal weekly schedule responsiveness', () => {
  it('uses the responsive grid instead of a fixed inline seven-column layout', () => {
    expect(source).toContain('className={styles.grid}')
    expect(css).toContain('@media (max-width: 767px)')
    expect(css).toMatch(/\.grid\s*{[^}]*grid-template-columns:\s*1fr/s)
  })
})
