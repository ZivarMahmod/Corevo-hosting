import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const web = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('06 Frisöradmin mobil PWA contract', () => {
  it('uses the canonical dark mobile shell and two-item bottom navigation', () => {
    const shell = web('components/personal/PersonalPwaShell.tsx')
    const css = web('components/personal/personal-pwa.module.css')
    expect(shell).toContain('data-accept="personal-pwa"')
    expect(shell).toContain('<nav className={styles.bottomNav}')
    expect(shell.match(/<Link href=/g)).toHaveLength(2)
    expect(shell).toContain('Kalender')
    expect(shell).toContain('Min profil')
    for (const token of [
      '#121210',
      '#1c1c18',
      '#25251f',
      '#2e2e28',
      '#f0f0ea',
      '#c8c8bd',
      '#96968c',
      '#2f5f47',
      '#9ac4a5',
    ]) {
      expect(css).toContain(token)
    }
    expect(css).toContain('max-width: 470px')
  })

  it('renders real calendar data and a booking sheet without demo names', () => {
    const page = web('app/(personal)/personal/page.tsx')
    const calendar = web('components/personal/PersonalCalendarPwa.tsx')
    const create = web('components/personal/PersonalWalkInFab.tsx')
    expect(page).toContain(
      'getMemberPermissions({ tenantId: user.tenantId, staffId: user.staffId })',
    )
    expect(page).toContain('getStaffScheduleWithNotes([selectedStaffId], fromUtc, toUtc)')
    expect(page).toContain('bookings={bookings}')
    expect(calendar).toContain('data-accept="personal-calendar"')
    expect(calendar).toContain('data-accept="booking-sheet"')
    expect(create).toContain('data-accept="personal-create"')
    expect(create).toContain('createWalkIn')
    expect(create).toContain('<dialog')
    expect(create).toContain('dialog.showModal()')
    expect(create).toContain('aria-labelledby="walk-in-title"')
    expect(create).toContain('aria-label="Stäng walk-in"')
    expect(create).toContain('triggerRef.current?.focus()')
    expect(`${page}\n${calendar}`).not.toContain('Frisöradmin Mobil PWA.dc.html')
    expect(`${page}\n${calendar}`).not.toMatch(/const\s+(demo|fixtures?)\s*=/i)
  })

  it('keeps booking as primary and minbooking as an explicit legacy door', () => {
    const roles = web('lib/auth/roles.ts')
    const host = web('lib/auth/host-routing.ts')
    const auth = web('app/(auth)/actions.ts')
    expect(roles).toContain("return '/personal'")
    expect(host).toContain("if (isPrefix(path, STAFF_GROUP)) return { action: 'pass' }")
    expect(auth).toContain('staffOnLegacyDoor')
    expect(auth).toContain("hostKind === 'staff_portal'")
    expect(auth.indexOf('staffOnLegacyDoor =')).toBeLessThan(
      auth.indexOf('if (door !== hostKind && !staffOnLegacyDoor)'),
    )
  })
})
