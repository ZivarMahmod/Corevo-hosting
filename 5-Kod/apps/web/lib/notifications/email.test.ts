import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { sendEmail, buildFrom } from './email'
import { resolveEmailBrand } from './brand'
import { confirmationEmail } from './templates'
import { THEME_CONTENT } from '@/components/storefront/theme-content'

const baseMail = {
  serviceName: 'Klippning',
  startISO: '2026-07-01T10:00:00Z',
  timeZone: 'Europe/Stockholm',
}

// goal-14 transport + brand contract. These read process.env at CALL time
// (EMAIL_RELAY_URL/SECRET, NOTIFICATIONS_FROM), so each test sets/clears env
// explicitly and restores it — never relying on ambient env (a false green).

const RELAY_VARS = ['EMAIL_RELAY_URL', 'EMAIL_RELAY_SECRET', 'NOTIFICATIONS_FROM'] as const

describe('sendEmail transport', () => {
  let saved: Record<string, string | undefined>
  beforeEach(() => {
    saved = {}
    for (const k of RELAY_VARS) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
  })
  afterEach(() => {
    for (const k of RELAY_VARS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  // (a) graceful no-op when the relay isn't configured (local/dev/CI, or before
  // one.com secrets are set) — exactly the old Resend no-op contract.
  it('no-ops with skipped:true when relay env is unset (never throws)', async () => {
    const res = await sendEmail({ to: 'kund@example.com', subject: 'Hej', html: '<p>hej</p>' })
    expect(res).toEqual({ ok: false, skipped: true })
  })

  it('still no-ops when only one relay var is set (both required)', async () => {
    process.env.EMAIL_RELAY_URL = 'https://relay.example/functions/v1/send-email'
    const res = await sendEmail({ to: 'kund@example.com', subject: 'Hej', html: '<p>hej</p>' })
    expect(res).toEqual({ ok: false, skipped: true })
  })

  it('rejects an invalid recipient without contacting the relay', async () => {
    process.env.EMAIL_RELAY_URL = 'https://relay.example/functions/v1/send-email'
    process.env.EMAIL_RELAY_SECRET = 'shh'
    const res = await sendEmail({ to: 'not-an-email', subject: 'x', html: 'x' })
    expect(res).toEqual({ ok: false, error: 'invalid_recipient' })
  })
})

describe('buildFrom', () => {
  let savedFrom: string | undefined
  beforeEach(() => {
    savedFrom = process.env.NOTIFICATIONS_FROM
    delete process.env.NOTIFICATIONS_FROM
  })
  afterEach(() => {
    if (savedFrom === undefined) delete process.env.NOTIFICATIONS_FROM
    else process.env.NOTIFICATIONS_FROM = savedFrom
  })

  // (c) From display name built from the salon name, address kept at booking@corevo.se.
  it('builds a quoted-string From from the salon name', () => {
    expect(buildFrom('Frisör Demo')).toBe('"Frisör Demo" <booking@corevo.se>')
  })

  it('falls back to the platform default when name is missing/blank', () => {
    expect(buildFrom(undefined)).toBe('Corevo <booking@corevo.se>')
    expect(buildFrom('   ')).toBe('Corevo <booking@corevo.se>')
  })

  it('escapes quotes/backslashes in the display name', () => {
    expect(buildFrom('A"B\\C')).toBe('"A\\"B\\\\C" <booking@corevo.se>')
  })

  it('keeps the salon name but takes the address from NOTIFICATIONS_FROM', () => {
    process.env.NOTIFICATIONS_FROM = 'Corevo <booking@corevo.se>'
    expect(buildFrom('Salong X')).toBe('"Salong X" <booking@corevo.se>')
  })
})

describe('resolveEmailBrand (pure)', () => {
  beforeEach(() => {
    delete process.env.NOTIFICATIONS_FROM
  })

  // (b) Reply-To is omitted when the salon has no contact email — replies fall back
  // to From; we never fabricate a Reply-To.
  it('omits replyTo when contact email is absent or blank', () => {
    expect(resolveEmailBrand({ tenantName: 'X', contact: {} }).replyTo).toBeUndefined()
    expect(resolveEmailBrand({ tenantName: 'X', contact: { email: '  ' } }).replyTo).toBeUndefined()
    expect(resolveEmailBrand({ tenantName: 'X' }).replyTo).toBeUndefined()
  })

  it('sets replyTo to the salon contact email when present', () => {
    expect(resolveEmailBrand({ tenantName: 'X', contact: { email: 'salong@x.se' } }).replyTo).toBe('salong@x.se')
  })

  it('builds From from the salon name', () => {
    expect(resolveEmailBrand({ tenantName: 'Frisör Demo' }).from).toBe('"Frisör Demo" <booking@corevo.se>')
  })

  it('picks accent from color_accent → color_primary → undefined', () => {
    expect(resolveEmailBrand({ branding: { color_accent: '#123456', color_primary: '#000000' } }).accentColor).toBe(
      '#123456',
    )
    expect(resolveEmailBrand({ branding: { color_primary: '#abcdef' } }).accentColor).toBe('#abcdef')
    expect(resolveEmailBrand({ branding: {} }).accentColor).toBeUndefined()
    expect(resolveEmailBrand({}).accentColor).toBeUndefined()
  })

  it('uses the theme tagline as the slogan, defaulting to leander for unknown', () => {
    expect(resolveEmailBrand({ theme: 'zigge' }).slogan).toBe(THEME_CONTENT.zigge.tagline)
    expect(resolveEmailBrand({ theme: 'nope' }).slogan).toBe(THEME_CONTENT.leander.tagline)
    expect(resolveEmailBrand({}).slogan).toBe(THEME_CONTENT.leander.tagline)
  })

  it('passes through logo_url, null when unset', () => {
    expect(resolveEmailBrand({ branding: { logo_url: 'https://cdn/x.png' } }).logoUrl).toBe('https://cdn/x.png')
    expect(resolveEmailBrand({ branding: {} }).logoUrl).toBeNull()
  })
})

// E3 render DoD: the brand fields actually land in the shell() HTML.
describe('email rendering (brand in shell)', () => {
  it('paints the salon accent and renders the slogan', () => {
    const { html } = confirmationEmail({
      ...baseMail,
      tenantName: 'Frisör Demo',
      accentColor: '#123456',
      slogan: 'Vår slogan',
    })
    expect(html).toContain('#123456')
    expect(html).toContain('Vår slogan')
  })

  it('falls back to a monogram of the salon name when no logo', () => {
    const { html } = confirmationEmail({ ...baseMail, tenantName: 'Demo' })
    expect(html).toContain('>D</td>') // monogram initial in the accent circle
    expect(html).not.toContain('<img')
  })

  it('renders the logo <img> when logoUrl is an absolute http(s) URL (no monogram)', () => {
    const { html } = confirmationEmail({ ...baseMail, tenantName: 'Demo', logoUrl: 'https://cdn/x.png' })
    expect(html).toContain('<img src="https://cdn/x.png"')
    expect(html).not.toContain('>D</td>')
  })

  // FX2: a logo_url that isn't an absolute http(s) URL (blank / relative / bare R2
  // key when R2_PUBLIC_BASE_URL is unset) must fall back to the monogram, never a
  // broken <img>.
  it.each([
    ['empty string', ''],
    ['whitespace', '   '],
    ['relative path', '/uploads/logo.png'],
    ['bare key', 'tenants/abc/branding/x.png'],
  ])('falls back to the monogram (no <img>) for a non-absolute logoUrl: %s', (_label, logoUrl) => {
    const { html } = confirmationEmail({ ...baseMail, tenantName: 'Demo', logoUrl })
    expect(html).not.toContain('<img')
    expect(html).toContain('>D</td>')
  })

  it('falls back to Corevo gold when no accent is set', () => {
    const { html } = confirmationEmail({ ...baseMail, tenantName: 'Demo' })
    expect(html).toContain('#F5A623')
  })
})
