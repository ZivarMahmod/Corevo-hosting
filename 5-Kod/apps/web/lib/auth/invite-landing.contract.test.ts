import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('server-verifierad invite-landning', () => {
  it('does not guess /admin from booking root after accepting a staff invite', () => {
    const form = read('app/(auth)/valkommen/AcceptInviteForm.tsx')
    expect(form).toContain("window.location.href = '/fortsatt'")
    expect(form).not.toContain("window.location.href = '/'")
    expect(form).not.toContain('supabase.auth.getUser()')
  })

  it('rechecks the database-backed role before choosing the final portal', () => {
    const page = read('app/(auth)/fortsatt/page.tsx')
    expect(page).toContain('getCurrentUser()')
    expect(page).toContain('portalHomeFor({')
    expect(page).toContain('PORTAL_MIN_LEVEL.personal')
    expect(page).toContain("redirect('/ingen-atkomst')")
  })
})
