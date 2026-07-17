import { describe, expect, it } from 'vitest'
import { resolveChannel, type CustomerPrefs } from './router'

// Plan 014 steg 3 — routerns fyra kontraktsfall + kant: transaktionellt får
// aldrig tystas när e-post finns.

const APP_KUND: CustomerPrefs = {
  push_enabled: true,
  email_enabled: true,
  sms_enabled: false,
  preferred_channel: null,
  marketing_consent: false,
  want_reminders: true,
  want_offers: false,
  want_open_slots: false,
  want_recommendations: false,
}

const base = {
  hasPushSubscription: false,
  hasEmail: true,
  hasPhone: true,
  tenantSmsEnabled: true,
}

describe('resolveChannel', () => {
  it('(a) opt-out-kund + marknadsföring ⇒ allowed=false, no_consent', () => {
    const d = resolveChannel({ ...base, category: 'marketing', type: 'offer', prefs: APP_KUND })
    expect(d.allowed).toBe(false)
    expect(d.skipReason).toBe('no_consent')
    expect(d.channel).toBeNull()
  })

  it('(a2) samtycke men typ-opt-out ⇒ type_opt_out', () => {
    const prefs = { ...APP_KUND, marketing_consent: true, want_offers: false }
    const d = resolveChannel({ ...base, category: 'marketing', type: 'offer', prefs })
    expect(d.allowed).toBe(false)
    expect(d.skipReason).toBe('type_opt_out')
  })

  it('(b) app-kund med aktiv sub + transaktionellt ⇒ push, e-post som fallback', () => {
    const d = resolveChannel({
      ...base,
      hasPushSubscription: true,
      category: 'transactional',
      type: 'booking_confirmation',
      prefs: APP_KUND,
    })
    expect(d.channel).toBe('push')
    expect(d.fallback).toBe('email')
  })

  it('(c) gäst (ingen prefs-rad) + transaktionellt ⇒ e-post; utan e-post ⇒ SMS via tenant-toggle', () => {
    const withEmail = resolveChannel({
      ...base,
      category: 'transactional',
      type: 'booking_confirmation',
      prefs: null,
    })
    expect(withEmail.channel).toBe('email')
    expect(withEmail.fallback).toBe('sms')

    const noEmail = resolveChannel({
      ...base,
      hasEmail: false,
      category: 'transactional',
      type: 'booking_confirmation',
      prefs: null,
    })
    expect(noEmail.channel).toBe('sms')

    const noEmailSmsOff = resolveChannel({
      ...base,
      hasEmail: false,
      tenantSmsEnabled: false,
      category: 'transactional',
      type: 'booking_confirmation',
      prefs: null,
    })
    expect(noEmailSmsOff.allowed).toBe(false)
    expect(noEmailSmsOff.skipReason).toBe('no_channel')
  })

  it('(d) SMS väljs aldrig automatiskt för app-kund utan eget val', () => {
    // App-kund utan e-post och utan push — sms_enabled=false (default) ⇒ ingen SMS.
    const d = resolveChannel({
      ...base,
      hasEmail: false,
      category: 'marketing',
      type: 'offer',
      prefs: { ...APP_KUND, marketing_consent: true, want_offers: true },
    })
    expect(d.channel).not.toBe('sms')
    expect(d.allowed).toBe(false)

    // Med kundens EGET val (sms_enabled=true) öppnas SMS.
    const opted = resolveChannel({
      ...base,
      hasEmail: false,
      category: 'marketing',
      type: 'offer',
      prefs: { ...APP_KUND, marketing_consent: true, want_offers: true, sms_enabled: true },
    })
    expect(opted.channel).toBe('sms')
  })

  it('transaktionellt tystas aldrig när e-post finns (kanal-opt-out trumfas)', () => {
    const allOff = { ...APP_KUND, push_enabled: false, email_enabled: false, sms_enabled: false }
    const d = resolveChannel({
      ...base,
      category: 'transactional',
      type: 'booking_confirmation',
      prefs: allOff,
    })
    expect(d.allowed).toBe(true)
    expect(d.channel).toBe('email')
  })
})
