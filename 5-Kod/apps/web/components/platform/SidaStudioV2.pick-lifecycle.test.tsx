// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteRevision, SiteSnapshot } from '@/lib/platform/site-revisions'
import type { SiteEditorManifest } from './SidaStudioV2.manifest'

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  searchParams: new URLSearchParams(),
  discardSiteDraft: vi.fn(),
  publishSiteDraft: vi.fn(),
  restoreSiteRevision: vi.fn(),
  saveSiteDraft: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/sida',
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}))
vi.mock('@corevo/ui', () => ({ injectTenantTokens: () => ({}) }))
vi.mock('@/lib/platform/actions/site-revisions', () => ({
  discardSiteDraft: mocks.discardSiteDraft,
  publishSiteDraft: mocks.publishSiteDraft,
  restoreSiteRevision: mocks.restoreSiteRevision,
  saveSiteDraft: mocks.saveSiteDraft,
  uploadSiteDraftImage: vi.fn(),
}))
vi.mock('./ThemePicker', () => ({ ThemePicker: () => null }))

import { SidaStudioV2 } from './SidaStudioV2'

const manifest: SiteEditorManifest = {
  swatches: {},
  tabs: [
    {
      id: 'allmant',
      label: 'Allmänt',
      sub: '',
      path: '',
      cards: [{
        id: 'footer',
        title: 'Sidfot',
        fields: [{ key: 'tagline', label: 'Sidfotens text', defaultValue: 'Allmänt sidfot' }],
      }],
    },
    {
      id: 'hem',
      label: 'Hem',
      sub: '',
      path: '',
      cards: [{
        id: 'hero',
        title: 'Hero',
        fields: [{ key: 'heroTitle', label: 'Rubrik', defaultValue: 'Hemrubrik' }],
      }],
    },
  ],
}

const snapshot = {
  tenant: { name: 'Corevo Test' },
  branding: {
    logo_url: null,
    hero_images: [],
    gallery_images: [],
    about_image: null,
    closing_image: null,
    stats: null,
    color_primary: null,
    color_accent: null,
    color_bg: null,
    color_fg: null,
  },
  settings: {
    theme: 'siluett',
    copy: {},
    seo: { title: null, description: null },
    contact: { email: null, phone: null },
    social: { instagram: null, facebook: null, tiktok: null },
    booking: { variant: 'wizard', pickerMode: 'calendar', staffAvatars: 'foto' },
    opening_hours: null,
    map: null,
  },
  location: { address: null },
} as unknown as SiteSnapshot

const historicSnapshot = structuredClone(snapshot)
historicSnapshot.settings.copy.heroTitle = 'Historisk rubrik'
const historyRevision = {
  id: 'revision-history',
  tenant_id: 'tenant-1',
  status: 'published',
  snapshot: historicSnapshot,
  lock_version: 3,
  created_at: '2026-07-27T10:00:00.000Z',
  created_by: null,
  updated_at: '2026-07-27T10:00:00.000Z',
  updated_by: null,
  published_at: '2026-07-27T10:00:00.000Z',
  published_by: null,
  source_revision_id: null,
} as SiteRevision

let container: HTMLDivElement
let root: Root
let frameCallbacks: FrameRequestCallback[]
let originalScrollIntoView: PropertyDescriptor | undefined
let originalContentWindow: PropertyDescriptor | undefined
let postMessage: ReturnType<typeof vi.spyOn>

function button(label: string): HTMLButtonElement {
  const match = [...document.querySelectorAll('button')].find((node) => node.textContent === label)
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  return match
}

function frame(): HTMLIFrameElement {
  const iframe = container.querySelector('iframe')
  if (!(iframe instanceof HTMLIFrameElement) || !iframe.contentWindow) throw new Error('Preview iframe missing')
  return iframe
}

function field(key: string): HTMLInputElement {
  const match = container.querySelector(`[data-corevo-editor-field="${key}"]`)
  if (!(match instanceof HTMLInputElement)) throw new Error(`Field not found: ${key}`)
  return match
}

async function editField(key: string, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  await act(async () => {
    const input = field(key)
    setter?.call(input, value)
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }))
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

async function sendFromPreview(data: Record<string, unknown>) {
  await act(async () => {
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      source: frame().contentWindow,
      data: { source: 'corevo-sida', ...data },
    }))
  })
}

async function setVisibleFields(fields: string[]) {
  postMessage.mockClear()
  await sendFromPreview({ type: 'preview-ready' })
  const messages = postMessage.mock.calls.map(([data]) => data as { type?: string; requestId?: number })
  const scan = messages.reverse().find((data) => data.type === 'editor-scan')
  if (!scan) throw new Error('Editor scan missing')
  await sendFromPreview({ type: 'editor-scan-result', requestId: scan.requestId, fields })
}

async function flushFrames() {
  await act(async () => {
    while (frameCallbacks.length) frameCallbacks.shift()!(0)
  })
}

beforeEach(async () => {
  vi.useFakeTimers()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mocks.replace.mockReset()
  mocks.refresh.mockReset()
  mocks.push.mockReset()
  mocks.discardSiteDraft.mockReset()
  mocks.publishSiteDraft.mockReset()
  mocks.restoreSiteRevision.mockReset()
  mocks.saveSiteDraft.mockReset()
  mocks.discardSiteDraft.mockResolvedValue({ success: 'Utkastet har kastats.' })
  mocks.publishSiteDraft.mockResolvedValue({ success: 'Sidan är publicerad.', snapshot })
  mocks.restoreSiteRevision.mockResolvedValue({ success: 'Versionen har återställts.', lockVersion: 4 })
  mocks.saveSiteDraft.mockResolvedValue({ success: 'Utkastet är sparat.', lockVersion: 1 })
  frameCallbacks = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frameCallbacks.push(callback)
    return frameCallbacks.length
  })
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
  originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
  originalContentWindow = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    configurable: true,
    get: () => window,
  })
  postMessage = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(
    <SidaStudioV2
      surface="standalone"
      tenantId="tenant-1"
      effectiveSnapshot={snapshot}
      publishedSnapshot={snapshot}
      draft={null}
      history={[historyRevision]}
      previewPath="about:blank"
      storefrontHost="test.corevo.se"
      storefrontUrl="https://test.corevo.se"
      isActive
      initialTabId="hem"
      manifestData={manifest}
      liveModules={[]}
      scheduleHours={null}
    />,
  ))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  if (originalScrollIntoView) {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
  } else {
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
  }
  if (originalContentWindow) {
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', originalContentWindow)
  } else {
    delete (HTMLIFrameElement.prototype as { contentWindow?: unknown }).contentWindow
  }
  vi.useRealTimers()
})

describe('SidaStudioV2 cross-tab pick lifecycle', () => {
  it('clears the old route scan before focusing a field owned by another same-route tab', async () => {
    await setVisibleFields(['heroTitle'])

    await sendFromPreview({ type: 'editor-pick-field', field: 'tagline' })
    await flushFrames()

    const tagline = container.querySelector<HTMLElement>('[data-corevo-editor-field="tagline"]')
    expect(tagline).toBeInstanceOf(HTMLInputElement)
    expect(document.activeElement).toBe(tagline)
  })

  it('clears the pick instruction when a manual editor tab change cancels the mode', async () => {
    await act(async () => button('Välj på sidan').click())
    expect(container.textContent).toContain('Klicka på den del i förhandsvisningen som du vill redigera.')

    await act(async () => button('Allmänt').click())

    expect(container.textContent).not.toContain('Klicka på den del i förhandsvisningen som du vill redigera.')
  })
})

describe('SidaStudioV2 revision safety', () => {
  it('native-disables editor mutations and names the active save while it awaits', async () => {
    await editField('heroTitle', 'Lokalt arbete')
    const pending = deferred<{ success: string; lockVersion: number }>()
    mocks.saveSiteDraft.mockReturnValueOnce(pending.promise)

    act(() => button('Spara utkast').click())
    await act(async () => { await Promise.resolve() })

    const fieldset = container.querySelector('fieldset')
    expect(fieldset).toBeInstanceOf(HTMLFieldSetElement)
    expect((fieldset as HTMLFieldSetElement).disabled).toBe(true)
    expect(field('heroTitle').closest('fieldset')).toBe(fieldset)
    expect(container.querySelector('[data-accept="editor-shell"]')?.getAttribute('aria-busy')).toBe('true')
    expect(container.textContent).toContain('Sparar…')
    expect(button('Allmänt').disabled).toBe(true)
    expect(button('Välj på sidan').disabled).toBe(true)

    pending.resolve({ success: 'Utkastet är sparat.', lockVersion: 1 })
    await act(async () => { await pending.promise })

    expect((fieldset as HTMLFieldSetElement).disabled).toBe(false)
  })

  it('rejects same-tick save and publish attempts with one immediate mutex', async () => {
    await editField('heroTitle', 'Lokalt arbete')
    const pending = deferred<{ success: string; lockVersion: number }>()
    mocks.saveSiteDraft.mockReturnValueOnce(pending.promise)

    act(() => {
      button('Spara utkast').click()
      button('Publicera').click()
    })
    await act(async () => { await Promise.resolve() })

    expect(mocks.saveSiteDraft).toHaveBeenCalledTimes(1)
    expect(mocks.publishSiteDraft).not.toHaveBeenCalled()

    pending.resolve({ success: 'Utkastet är sparat.', lockVersion: 1 })
    await act(async () => { await pending.promise })
  })

  it('keeps local work dirty after conflict and blocks every later revision write', async () => {
    await editField('heroTitle', 'Behåll min lokala rubrik')
    mocks.saveSiteDraft.mockResolvedValueOnce({
      error: 'Utkastet har ändrats i en annan session.',
      conflict: true,
    })

    await act(async () => button('Spara utkast').click())

    expect(field('heroTitle').value).toBe('Behåll min lokala rubrik')
    expect(container.textContent).toContain('Osparat')
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Utkastet har ändrats i en annan session.')
    expect(button('Ladda om senaste')).toBeInstanceOf(HTMLButtonElement)

    act(() => {
      button('Spara utkast').click()
      button('Publicera').click()
    })
    await act(async () => { await Promise.resolve() })

    expect(mocks.saveSiteDraft).toHaveBeenCalledTimes(1)
    expect(mocks.publishSiteDraft).not.toHaveBeenCalled()
    expect(mocks.refresh).not.toHaveBeenCalled()

    await act(async () => button('Ladda om senaste').click())
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Ladda om senaste?')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('lokala ändringar försvinner')
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    act(() => vi.advanceTimersByTime(180))

    expect(document.querySelector('[role="alert"]')).not.toBeNull()
    expect(field('heroTitle').value).toBe('Behåll min lokala rubrik')
  })

  it('keeps one outer publish lock while saving first and preserves dirty state on publish conflict', async () => {
    await editField('heroTitle', 'Lokalt före publicering')
    mocks.saveSiteDraft.mockResolvedValueOnce({ success: 'Utkastet är sparat.', lockVersion: 8 })
    mocks.publishSiteDraft.mockResolvedValueOnce({
      error: 'Utkastet har ändrats i en annan session.',
      conflict: true,
    })

    await act(async () => button('Publicera').click())

    expect(mocks.saveSiteDraft).toHaveBeenCalledTimes(1)
    expect(mocks.publishSiteDraft).toHaveBeenCalledWith({ tenantId: 'tenant-1', expectedLockVersion: 8 })
    expect(field('heroTitle').value).toBe('Lokalt före publicering')
    expect(container.textContent).toContain('Osparat')
    expect(container.querySelector('fieldset')?.hasAttribute('disabled')).toBe(true)
  })

  it('releases the mutex after an exception and keeps a later save usable', async () => {
    await editField('heroTitle', 'Lokalt arbete')
    mocks.saveSiteDraft.mockRejectedValueOnce(new Error('network'))

    await act(async () => button('Spara utkast').click())

    expect(container.querySelector('[data-accept="editor-shell"]')?.getAttribute('aria-busy')).toBe('false')
    expect(container.textContent).toContain('Utkastet kunde inte sparas.')

    mocks.saveSiteDraft.mockResolvedValueOnce({ success: 'Utkastet är sparat.', lockVersion: 2 })
    await act(async () => button('Spara utkast').click())

    expect(mocks.saveSiteDraft).toHaveBeenCalledTimes(2)
  })

  it('asks before local published restore replaces dirty values', async () => {
    await act(async () => button('Allmänt').click())
    await editField('tagline', 'Behåll tills jag bekräftar')

    await act(async () => button('Återställ till publicerad version').click())

    expect(field('tagline').value).toBe('Behåll tills jag bekräftar')
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Återställ publicerad version?')
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('lokala ändringar försvinner')
  })

  it('asks before history restore writes over dirty values but restores clean state directly', async () => {
    await act(async () => button('Allmänt').click())
    await editField('tagline', 'Behåll tills jag bekräftar')

    await act(async () => button('Återställ').click())

    expect(field('tagline').value).toBe('Behåll tills jag bekräftar')
    expect(mocks.restoreSiteRevision).not.toHaveBeenCalled()
    expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Återställ version?')

    await act(async () => button('Avbryt').click())
    act(() => vi.advanceTimersByTime(180))
    await editField('tagline', '')
    await act(async () => button('Återställ').click())

    expect(mocks.restoreSiteRevision).toHaveBeenCalledTimes(1)
  })

  it('uses the portal Modal for leave choices and restores trigger focus after Escape', async () => {
    await editField('heroTitle', 'Osparat')
    const trigger = document.createElement('a')
    trigger.href = '/annan-sida'
    trigger.textContent = 'Gå vidare'
    document.body.append(trigger)
    trigger.focus()

    await act(async () => trigger.click())

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog?.getAttribute('aria-label')).toBe('Lämna redigeraren?')
    expect(container.contains(dialog)).toBe(false)
    expect(dialog?.textContent).toContain('Spara utkast och lämna')
    expect(dialog?.textContent).toContain('Kasta ändringarna')
    expect(dialog?.textContent).toContain('Stanna kvar')

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    act(() => vi.advanceTimersByTime(180))

    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
