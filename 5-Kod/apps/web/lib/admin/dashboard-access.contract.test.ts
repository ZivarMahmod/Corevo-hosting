import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const page = readFileSync(
  resolve(import.meta.dirname, '../../app/(admin)/admin/page.tsx'),
  'utf8',
)

describe('kundadmin dashboard access', () => {
  it('begränsar platsdata med användarens aktuella DB-inställning och nekar utan giltig plats', () => {
    expect(page).toContain('getAdminLocationPreferences(user.id)')
    expect(page).toContain("locationPreferences.accessScope === 'locations'")
    expect(page).toContain('requiredLocationId(undefined, allowedLocationIds')
    expect(page).toContain('Välj en tillåten primär plats innan översikten kan öppnas.')
    expect(page).toContain('locationId: locationFilter || undefined')
  })

  it('visar dashboardens bokningsmutationer endast för owner eller operational manager', () => {
    expect(page).toContain("memberPermissions?.operationalRole === 'manager'")
    expect(page.match(/\{canManageBookings && \(/g)).toHaveLength(3)
  })
})
