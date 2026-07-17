import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function sourceAt(relativePath: string): string {
  return readFileSync(path.join(WEB_ROOT, relativePath), 'utf8')
}

// Plan 007: GDPR-raderingen är irreversibel — kontraktet låser de tre spärrar som
// aldrig får försvinna i en refaktor. Samma stil som notification-logging-kontraktet.
describe('eraseCustomer guards (plan 007)', () => {
  const actions = sourceAt('lib/admin/actions.ts')
  const erase = sourceAt('lib/gdpr/erase.ts')

  it('kräver ägar-roll — personal (nivå 3) kan aldrig radera kunddata', () => {
    const fn = actions.slice(actions.indexOf('export async function eraseCustomer'))
    expect(fn).toContain('roleLevel < 6')
  })

  it('kräver explicit confirm-fält server-side (UI-armen är aldrig enda spärren)', () => {
    const fn = actions.slice(actions.indexOf('export async function eraseCustomer'))
    expect(fn).toMatch(/confirm.*===\s*'radera'/)
  })

  it('tenant-radering är TENANT-SCOPAD och raderar aldrig auth-användaren', () => {
    const fn = erase.slice(erase.indexOf('export async function eraseTenantCustomerData'))
    // Varje skrivning mot customers/bookings bär tenant-fencen.
    expect(fn.match(/\.eq\('tenant_id', tenantId\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    // auth.admin.deleteUser hör BARA till självbetjäningsvägen (kontot kan bära
    // andra salongers relationer).
    expect(fn).not.toContain('auth.admin.deleteUser')
  })

  it('tenant TVINGAS ur JWT-kontexten i createCustomer — aldrig ur formData', () => {
    const fn = actions.slice(
      actions.indexOf('export async function createCustomer'),
      actions.indexOf('export async function eraseCustomer'),
    )
    expect(fn).toContain('tenant_id: ctx.tenant.id')
    expect(fn).not.toMatch(/fd\.get\(['"]tenant/)
  })
})
