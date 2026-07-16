import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const componentPath = path.resolve(__dirname, 'SidaStudioV2.tsx')
const cssPath = path.resolve(__dirname, 'SidaStudioV2.module.css')
const component = existsSync(componentPath) ? readFileSync(componentPath, 'utf8') : ''
const css = existsSync(cssPath) ? readFileSync(cssPath, 'utf8') : ''

describe('SidaStudioV2 acceptance shell', () => {
  it('owns one aggregate working snapshot and all four revision actions', () => {
    expect(component).toContain('useState<SiteSnapshot>(effectiveSnapshot)')
    expect(component).toContain('saveSiteDraft')
    expect(component).toContain('publishSiteDraft')
    expect(component).toContain('discardSiteDraft')
    expect(component).toContain('restoreSiteRevision')
    expect(component).not.toContain('type="color"')
    expect(component).toContain('result.snapshot ?? working')
    expect(component).toContain('router.refresh()')
  })

  it('exposes stable hooks for every canonical editor surface', () => {
    for (const hook of [
      'editor-shell',
      'editor-toolbar',
      'editor-tabs',
      'editor-status',
      'editor-panel',
      'editor-preview',
      'preview-device',
      'draft-banner',
      'leave-dialog',
    ]) {
      expect(component, `missing data-accept=${hook}`).toContain(`data-accept="${hook}"`)
    }
    expect(component).toContain('data-corevo-editor-field={field.key}')
    expect(component).toContain('data-accept={`show-field-${field}`}')
  })

  it('scans active effective copy before replaying the complete snapshot', () => {
    expect(component).toContain("type: 'editor-scan'")
    expect(component).toContain("data.type === 'editor-scan-result'")
    expect(component).toContain("type: 'site-snapshot-preview'")
    expect(component).toContain('effectiveCopy')
    expect(component).toContain('scanPreview')
  })

  it('hydrates standard copy before scanning a freshly loaded preview', () => {
    expect(component).toContain('field.defaultValue !== undefined')
    expect(component).toContain('next.settings.copy[field.key] = field.defaultValue')
    expect(component).toContain('onLoad={bootstrapPreview}')
  })

  it('scans both desired copy and the published SSR fallback before replay', () => {
    expect(component).toContain('published.settings.copy[field.key] ?? field.defaultValue')
    expect(component).toContain('currentValue === publishedValue')
    expect(component).toContain('[current, publishedCandidate]')
  })

  it('waits for the hydrated preview bridge before sending the initial snapshot and scan', () => {
    expect(component).toContain("data.type === 'preview-ready'")
    expect(component).toContain('postPublishedSnapshot()')
    expect(component).toContain('bootstrapPreview()')
    expect(component).toContain('onLoad={bootstrapPreview}')
  })

  it('bootstraps from the SSR-published baseline before replaying a persisted draft', () => {
    expect(component).toContain('resolvePreviewSnapshot(published, activeTab ? [activeTab] : [], scheduleHours)')
    expect(component).toContain('snapshot: publishedPreviewSnapshot')
    expect(component).toContain('imageSlots: activeImageSlots')
    expect(component).toContain('tokens: injectTenantTokens(publishedPreviewSnapshot.branding)')
    expect(component).toContain('postPublishedSnapshot()')
    expect(component).toContain('scanPublishedPreview()')
  })

  it('resolves published default image and stat slots before persisted draft replay', () => {
    expect(component).toContain('const resolvePreviewSnapshot')
    expect(component).toContain('card.imageDefaults.slice')
    expect(component).toContain('next.branding.stats = card.statsDefaults')
    expect(component).toContain('publishedPreviewSnapshot')
  })

  it('guards browser back navigation with the same three-choice leave dialog', () => {
    expect(component).toContain("addEventListener('popstate'")
    expect(component).toContain('HISTORY_BACK_TARGET')
    expect(component).toContain('window.history.pushState')
    expect(component).toContain('window.history.go(-2)')
    expect(component).toContain('committedLeaveRef.current = Boolean(href)')
    expect(component).toContain('!committedLeaveRef.current')
  })

  it('uses the storefront scan result to hide fields the active route does not render', () => {
    expect(component).toContain('const [visibleCopyFields, setVisibleCopyFields]')
    expect(component).toContain('fields?: string[]')
    expect(component).toContain('setVisibleCopyFields(new Set(data.fields))')
    expect(component).toContain('visibleFields.includes(field.key)')
  })

  it('keeps declared empty optional fields editable before their first preview value exists', () => {
    expect(component).toContain("field.defaultValue === ''")
    expect(component).toContain('visibleCopyFields.has(field.key)')
  })

  it('keeps iframe navigation, active tab and editor field scan on one route', () => {
    expect(component).toContain("data.type === 'preview-route'")
    expect(component).toContain('setTabId(target.id)')
  })

  it('shows only module tabs backed by active modules', () => {
    expect(component).not.toContain('void liveModules')
    expect(component).toContain('liveModules.includes(tab.module)')
  })

  it('renders the booking route with a slash in the visible tenant URL', () => {
    expect(component).toContain("const displayPath = activeTab?.path.startsWith('?')")
    expect(component).toContain("`/${activeTab.path}`")
    expect(component).toContain('{storefrontHost}{displayPath}')
  })

  it('uses the draft-safe R2 upload/crop flow and the correct highlight channel', () => {
    expect(component).toContain('uploadSiteDraftImage')
    expect(component).toContain('type="file"')
    expect(component).toContain('Byt bild')
    expect(component).toContain('cropFocusedImage')
    expect(component).toContain("'img-flash'")
    expect(component).toContain("'site-field-flash'")
    expect(component).toContain('values.slice(0, limit)')
    expect(component).toContain('>EGNA BILDER</span>')
    expect(component).not.toContain("hasCustom ? 'EGEN TEXT' : 'STANDARD'")
  })

  it('reorders multi-image slots by drag or keyboard controls', () => {
    expect(component).toContain('draggable={canReorder}')
    expect(component).toContain('setDraggedIndex(index)')
    expect(component).toContain('onDrop={() => move(draggedIndex, index)}')
    expect(component).toContain('aria-label={`Flytta bild ${index + 1} upp`}')
    expect(component).toContain('aria-label={`Flytta bild ${index + 1} ner`}')
    expect(component).toContain('next.branding[slot] = reordered')
  })

  it('keeps typography informational and retains editable stats', () => {
    expect(component).toContain('Typsnitten är valda för att passa ihop')
    expect(component).not.toContain('const BODY_FONTS')
    expect(component).not.toContain('<FontField')
    expect(component).toContain('function StatsFields')
    expect(component).toContain("'EGEN TEXT' : 'STANDARD'")
    expect(component).toContain('const rows = custom ? snapshot.branding.stats! : defaults')
    expect(component).toContain('if (!value.trim()) return')
    expect(component).not.toContain('Math.max(4, defaults.length')
    expect(component).not.toContain('nextRows.filter(([statValue, label])')
  })

  it('locks canonical geometry, tokens and mobile controls in CSS', () => {
    expect(css).toMatch(/grid-template-columns:\s*470px\s+minmax\(0,\s*1fr\)/)
    expect(css).toMatch(/--editor-bg:\s*#121210/i)
    expect(css).toMatch(/--editor-panel:\s*#1c1c18/i)
    expect(css).toMatch(/--editor-card:\s*#25251f/i)
    expect(css).toMatch(/--editor-line:\s*#33332c/i)
    expect(css).toMatch(/--editor-text:\s*#f0f0ea/i)
    expect(css).toMatch(/\.mobileDevice[^}]*width:\s*390px/is)
    expect(css).toMatch(/\.mobilePublish[^}]*min-height:\s*(?:4[4-9]|[5-9]\d)px/is)
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.tabs button[^}]*min-height:\s*44px/is)
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.draftBanner button,[\s\S]*?\.showButton[^}]*min-height:\s*44px/is)
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.imageRow button:not\(\.showButton\),[\s\S]*?\.info a[^}]*min-height:\s*44px/is)
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.swatches button \{ width:\s*44px; height:\s*44px; \}/is)
    expect(css).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.cropEditor input\[type='range'\][^}]*min-height:\s*44px/is)
  })
})
