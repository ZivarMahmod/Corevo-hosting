import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./BookingProvider.tsx', import.meta.url), 'utf8')
const inlineSource = readFileSync(new URL('./InlineBooking.tsx', import.meta.url), 'utf8')
const previewShellSource = readFileSync(
  new URL('../../app/salong-preview/[slug]/preview-shell.tsx', import.meta.url),
  'utf8',
)

describe('BookingProvider editor preview contract', () => {
  it('accepts the iframe-only booking preview event and drives all three preferences', () => {
    expect(source).toContain("addEventListener('corevo-booking-preview'")
    expect(source).toContain('previewPrefs.variant')
    expect(source).toContain('previewPrefs.pickerMode')
    expect(source).toContain('previewPrefs.staffAvatarMode')
    expect(source).toContain("removeEventListener('corevo-booking-preview'")
    expect(source).toContain('pickerMode: previewPrefs.pickerMode')
    expect(source).toContain('staffAvatarMode: previewPrefs.staffAvatarMode')
    expect(inlineSource).toContain('? booking.pickerMode : pickerMode')
    expect(inlineSource).toContain('? booking.staffAvatarMode')
    expect(source).toContain('previewTenantName')
    expect(source).toContain('tenantName: previewTenantName')
    expect(inlineSource).toContain('const activeTenantName = previewControlled && booking')
    expect(inlineSource).toContain('brandName={activeTenantName}')
  })

  it('can show and hide inline booking as the preview variant changes', () => {
    expect(source).toContain('variant: previewPrefs.variant')
    expect(inlineSource).toContain('previewControlled?: boolean')
    expect(inlineSource).toContain("previewControlled && booking?.variant !== 'inline'")
    expect(previewShellSource).toContain('previewControlled')
    expect(previewShellSource).not.toContain(
      "settings.bookingVariant === 'inline' && wizardServices.length > 0",
    )
  })

  it('keeps the booking query presentation exclusive while preview variants switch', () => {
    expect(source).toContain("const previewShouldOpen = nextVariant !== 'inline'")
    expect(source).toContain('setOpen(previewShouldOpen)')
    expect(source).toContain('setMounted((current) => current || previewShouldOpen)')
    expect(source).toContain("if (nextVariant === 'inline')")
    expect(source).toContain("document.getElementById('boka-inline')")
    expect(source).toContain("window.parent !== window && window.location.pathname.startsWith('/salong-preview/')")
  })
})
