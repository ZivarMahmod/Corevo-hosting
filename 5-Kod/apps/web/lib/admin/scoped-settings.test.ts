import { describe, expect, it } from 'vitest'
import {
  mergeScopedSettings,
  parseCancellationCutoffHours,
  parseSettingsScope,
} from './scoped-settings'

const existing = {
  layout: { theme: 'saved' },
  cancellation_cutoff_hours: 24,
  customer_portal: { mode: 'legacy_account' },
  booking: {
    verificationMode: 'email_only',
    external_url: 'https://www.bokadirekt.se/places/saved',
  },
  notifications: { confirmation: true, reminder: true, review: false, sms: true },
  google_review_url: 'https://example.com/old',
  cookie_banner_enabled: true,
}

describe('mergeScopedSettings', () => {
  it('accepts only whole cancellation hours from zero through 8760', () => {
    expect(parseCancellationCutoffHours('')).toBe(24)
    expect(parseCancellationCutoffHours('0')).toBe(0)
    expect(parseCancellationCutoffHours('8760')).toBe(8760)
    expect(parseCancellationCutoffHours('1.5')).toBeNull()
    expect(parseCancellationCutoffHours('8761')).toBeNull()
  })

  it('rejects an unknown mutation scope instead of widening it to all settings', () => {
    expect(parseSettingsScope('booking')).toBe('booking')
    expect(parseSettingsScope('all')).toBe('all')
    expect(parseSettingsScope('tampered')).toBeNull()
    expect(parseSettingsScope(null)).toBeNull()
  })

  it('sparar bokningsregler utan att skriva över utskick, integration eller tema', () => {
    expect(
      mergeScopedSettings(existing, 'booking', {
        cancellationHours: 12,
      }),
    ).toEqual({
      ...existing,
      cancellation_cutoff_hours: 12,
    })
  })

  it('slår ihop notiser utan att radera andra settings- eller äldre notisnycklar', () => {
    const result = mergeScopedSettings(existing, 'notifications', {
      notifications: { confirmation: false, reminder: false, review: true },
    })
    expect(result.notifications).toEqual({
      confirmation: false,
      reminder: false,
      review: true,
      sms: true,
    })
    expect(result.layout).toEqual({ theme: 'saved' })
    expect(result.google_review_url).toBe('https://example.com/old')
  })

  it('isolerar integrations- och sekretessändringar', () => {
    const integration = mergeScopedSettings(existing, 'integrations', {
      googleReviewUrl: 'https://example.com/new',
    })
    expect(integration.google_review_url).toBe('https://example.com/new')
    expect(integration.cookie_banner_enabled).toBe(true)

    const privacy = mergeScopedSettings(existing, 'privacy', { cookieBannerEnabled: false })
    expect(privacy.cookie_banner_enabled).toBe(false)
    expect(privacy.google_review_url).toBe('https://example.com/old')
  })
})
