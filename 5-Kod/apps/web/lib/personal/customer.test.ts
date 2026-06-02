import { describe, it, expect } from 'vitest'
import { resolveCustomerName } from './customer'

// The calendar label and the client-card heading both go through resolveCustomerName.
// It must NEVER surface raw contact-PII (email/phone) — only the customer's chosen
// display name, or an initial when they asked to hide their name. This is the
// FAS0 leak fix (raw email used to be the fallback label).

describe('resolveCustomerName', () => {
  it('prefers an explicit display_name', () => {
    expect(
      resolveCustomerName({ display_name: 'Sara L.', full_name: 'Sara Lindqvist', name_hidden: false }),
    ).toBe('Sara L.')
  })

  it('uses the full name when nothing is hidden and no display_name', () => {
    expect(
      resolveCustomerName({ display_name: null, full_name: 'Erik Berg', name_hidden: false }),
    ).toBe('Erik Berg')
  })

  it('reduces to an initial when name_hidden is set', () => {
    expect(
      resolveCustomerName({ display_name: null, full_name: 'Erik Berg', name_hidden: true }),
    ).toBe('E.')
  })

  it('display_name still wins even when name_hidden is set', () => {
    expect(
      resolveCustomerName({ display_name: 'Stamkund', full_name: 'Erik Berg', name_hidden: true }),
    ).toBe('Stamkund')
  })

  it('falls back to a neutral label when nothing is known', () => {
    expect(resolveCustomerName({ display_name: null, full_name: null, name_hidden: false })).toBe(
      'Kund',
    )
    expect(resolveCustomerName({ display_name: '  ', full_name: '', name_hidden: false })).toBe(
      'Kund',
    )
  })

  it('hidden with no full name degrades to the neutral label, not an empty initial', () => {
    expect(resolveCustomerName({ display_name: null, full_name: null, name_hidden: true })).toBe(
      'Kund',
    )
  })
})
