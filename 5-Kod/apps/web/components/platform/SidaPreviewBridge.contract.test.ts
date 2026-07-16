import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./SidaPreviewBridge.tsx', import.meta.url), 'utf8')
const sectionsSource = readFileSync(new URL('../storefront/sections.tsx', import.meta.url), 'utf8')
const optionalFieldSources = [
  '../storefront/layouts/salong/kalla.modules.tsx',
  '../storefront/layouts/salong/snitt.modules.tsx',
  '../storefront/layouts/salong/siluett.modules.tsx',
  '../storefront/layouts/florist/aurora.modules.tsx',
  '../storefront/layouts/florist/ateljevinter.modules.tsx',
].map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n')
const snittPageSource = readFileSync(new URL('../storefront/layouts/salong/snitt.pages.tsx', import.meta.url), 'utf8')
const snittHomeSource = readFileSync(new URL('../storefront/layouts/salong/SnittLayout.tsx', import.meta.url), 'utf8')

describe('SidaPreviewBridge full snapshot contract', () => {
  it('announces readiness only after the child message listener is installed', () => {
    const listener = source.indexOf("window.addEventListener('message', onMessage)")
    const ready = source.indexOf("type: 'preview-ready'")
    expect(listener).toBeGreaterThan(-1)
    expect(ready).toBeGreaterThan(listener)
  })

  it('accepts one parent-only same-origin site snapshot message and applies each safe surface', () => {
    expect(source).toContain("data.type === 'site-snapshot-preview'")
    expect(source).toContain('e.source !== window.parent')
    expect(source).toContain('applySiteSnapshotPreview(data.snapshot, data.tokens')
    expect(source).toContain('applyPreviewTokens(tokens)')
    expect(source).toContain('applySnapshotCopy(snapshot.settings.copy')
    expect(source).toContain('applySnapshotImages(snapshot.branding')
    expect(source).toContain('applySnapshotFacts(snapshot, previous)')
  })

  it('keeps the legacy platform-editor messages intact', () => {
    for (const type of [
      'brand-preview', 'editor-scan', 'copy-preview', 'copy-flash-field',
      'image-preview', 'copy-flash', 'img-flash',
    ]) expect(source).toContain(`'${type}'`)
  })

  it('delegates storefront navigation to the parent editor route state', () => {
    expect(source).toContain("type: 'preview-route'")
    expect(source).toContain('path: target ? `/${target}` :')
    expect(source).not.toContain('window.location.assign(dest)')
  })

  it('previews social, booking and all non-copy field highlights', () => {
    expect(source).toContain("data.type === 'site-field-flash'")
    expect(source).toContain('snapshot.settings.social')
    expect(source).toContain('snapshot.settings.booking')
    expect(source).toContain("new CustomEvent('corevo-booking-preview'")
    expect(source).toContain('flashSiteField(')
    expect(source).toContain('markSnapshotImages(')
    expect(source).toContain('[data-corevo-fact-group="location.address"]')
    expect(source).toContain('[data-corevo-contact-group]')
    expect(source).toContain('[data-corevo-contact-phone-row]')
    expect(source).toContain('[data-corevo-contact-email-row]')
    expect(source).toContain('[data-corevo-opening-group]')
    expect(source).toContain('[data-corevo-address-placeholder]')
    expect(source).toContain('[data-corevo-opening-placeholder]')
    expect(source).toContain('SITE_DAYS.indexOf(row.day)')
    expect(source).toContain('syncMapPreview(snapshot)')
    expect(source).toContain('[data-corevo-map-link]')
    expect(source).toContain('[data-corevo-map-link-group]')
    expect(source).toContain('[data-corevo-map-embed]')
    expect(source).toContain('[data-corevo-map-group]')
  })

  it('uses the exact design highlight instead of the legacy magenta outline', () => {
    expect(source).toContain("el.style.outline = '2px solid #D6AC6A'")
    expect(source).not.toContain('#FF2FD6')
    expect(source).not.toContain("outline = '3px")
  })

  it('restores cleared copy and hides removed images without rewriting DOM', () => {
    expect(source).toContain('const originalFieldText = new WeakMap')
    expect(source).toContain('applySnapshotCopy(snapshot.settings.copy, previous?.settings.copy')
    expect(source).toContain('restoreField(field)')
    expect(source).toContain('applySnapshotCopy(previousSnapshot.settings.copy, null)')
    expect(source).toContain('setPreviewImageVisible(element, false)')
    expect(source).not.toContain('.innerHTML =')
  })

  it('shows and hides only image slots that the live layout already owns', () => {
    expect(source).toContain('syncSnapshotImageList(')
    expect(source).toContain('setPreviewImageVisible(')
    expect(source).not.toContain('ensureSnapshotImageCandidate(')
    expect(source).not.toContain('data-corevo-preview-clone')
  })

  it('restores stable runtime markers after every DOM field scan', () => {
    expect(source).toContain("const STABLE_FIELD_ATTR = 'data-corevo-editor-stable-field'")
    expect(source).toContain('restoreStableFieldMarkers(root)')
    expect(source).toContain('el.getAttribute(STABLE_FIELD_ATTR)')
    expect(source).toContain('image.setAttribute(FIELD_ATTR, stableField)')
    expect(source).toContain('element.setAttribute(FIELD_ATTR, stableField)')
  })

  it('patches every rendered tenant-name text node and forwards it into booking preview', () => {
    expect(source).toContain('patchTenantName(')
    expect(source).toContain('document.createTreeWalker(root, NodeFilter.SHOW_TEXT)')
    expect(source).toContain('tenantName: snapshot.tenant.name')
  })

  it('reveals intentionally empty optional module copy on its first preview edit', () => {
    for (const field of ['galleryEyebrow', 'galleryLede', 'clubNote']) {
      expect(optionalFieldSources).toContain(`data-corevo-editor-stable-field="${field}"`)
    }
    expect(source).toContain('originalHidden')
    expect(source).toContain('setPreviewCopyVisible(')
  })

  it('preserves Snitt punctuation and multiline hero semantics during copy preview', () => {
    expect(snittPageSource).toContain('data-corevo-editor-decoration')
    expect(snittHomeSource).toContain('data-corevo-editor-line')
    expect(snittHomeSource).toContain('data-corevo-editor-line-tail')
    expect(source).toContain('patchSegmentedLines(')
    expect(source).toContain("closest('[data-corevo-editor-decoration]')")
  })

  it('can reveal the first saved social link without inventing visible server content', () => {
    expect(source).toContain('[data-corevo-social-group]')
    expect(source).toContain('link.hidden =')
    expect(source).toContain('group.hidden =')
    expect(sectionsSource).toContain('data-corevo-social-group hidden={!hasSocial}')
    for (const provider of ['instagram', 'facebook', 'tiktok']) {
      expect(sectionsSource).toContain(`data-corevo-editor-stable-field="social.${provider}"`)
    }
  })

  it('switches the stable logo image/text pair in real time', () => {
    expect(source).toContain('syncLogoPreview(')
    expect(source).toContain('[data-corevo-logo-image]')
    expect(source).toContain('[data-corevo-logo-text]')
  })
})
