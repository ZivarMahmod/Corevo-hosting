import { describe, it, expect } from 'vitest'
import {
  customerDisplayName,
  customerAuthLabel,
  customerRole,
  customerStatusLabel,
  staffRoleLabel,
  staffStatus,
} from './people'

// Pure derivation for the cross-tenant Kunder/Personal lists. The DB reads are
// thin RLS-bypass wrappers; the LOGIC worth pinning is how a raw row becomes the
// label the mock shows — name-masking, guest vs. account, invite status.

describe('customer derivation', () => {
  it('name_hidden masks the name regardless of stored value', () => {
    expect(
      customerDisplayName({ full_name: 'Sara Lind', display_name: null, name_hidden: true }),
    ).toBe('Skyddat namn')
  })
  it('falls back full_name → display_name → "Okänd kund"', () => {
    expect(
      customerDisplayName({ full_name: 'Anna B', display_name: 'Annie', name_hidden: false }),
    ).toBe('Anna B')
    expect(
      customerDisplayName({ full_name: null, display_name: 'Annie', name_hidden: false }),
    ).toBe('Annie')
    expect(customerDisplayName({ full_name: null, display_name: null, name_hidden: false })).toBe(
      'Okänd kund',
    )
  })
  it('no auth user = guest (gäst-nyckel), linked user = password', () => {
    expect(customerAuthLabel(null)).toBe('Gäst-nyckel')
    expect(customerRole(null)).toBe('Gäst')
    expect(customerAuthLabel('uid')).toBe('Lösenord')
    expect(customerRole('uid')).toBe('Kund')
  })
  it('status label: anonymized > name-hidden > active', () => {
    expect(customerStatusLabel('anonymized', false)).toBe('Anonymiserad')
    expect(customerStatusLabel('active', true)).toBe('Skyddat namn')
    expect(customerStatusLabel('active', false)).toBe('Aktiv')
  })
})

describe('staff derivation', () => {
  it('maps seeded role enum → Swedish label', () => {
    expect(staffRoleLabel('salon_admin')).toBe('Salongschef')
    expect(staffRoleLabel('staff')).toBe('Frisör')
    expect(staffRoleLabel(null)).toBe('Frisör')
    expect(staffRoleLabel('barber')).toBe('barber') // unknown passes through
  })
  it('invite status: no user → väntar, inactive → inbjuden, active → aktiv', () => {
    expect(staffStatus({ active: true, hasUser: false, userStatus: null })).toBe(
      'Väntar bekräftelse',
    )
    expect(staffStatus({ active: false, hasUser: true, userStatus: 'active' })).toBe('Inbjuden')
    expect(staffStatus({ active: true, hasUser: true, userStatus: 'invited' })).toBe('Inbjuden')
    expect(staffStatus({ active: true, hasUser: true, userStatus: 'active' })).toBe('Aktiv')
  })
})
