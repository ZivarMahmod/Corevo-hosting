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
  themePublishingChange: null as null | ((pending: boolean) => void),
  uploadSiteDraftImage: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/sida',
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}))
vi.mock('@corevo/ui', () => ({
  accentForeground: () => '#ffffff',
  injectTenantTokens: () => ({}),
}))
vi.mock('@/lib/platform/actions/site-revisions', () => ({
  discardSiteDraft: mocks.discardSiteDraft,
  publishSiteDraft: mocks.publishSiteDraft,
  restoreSiteRevision: mocks.restoreSiteRevision,
  saveSiteDraft: mocks.saveSiteDraft,
  uploadSiteDraftImage: mocks.uploadSiteDraftImage,
}))
vi.mock('./ThemePicker', () => ({
  ThemePicker: ({
    tenantId,
    current,
    onPreview,
    onPublished,
    onPublishingChange,
  }: {
    tenantId: string
    current: string
    onPreview?: (theme: string, copyMode: 'keep' | 'template') => void
    onPublished?: () => void
    onPublishingChange?: (pending: boolean) => void
  }) => {
    mocks.themePublishingChange = onPublishingChange ?? null
    return (
      <div role="group" aria-label="Mallväljare" data-tenant-id={tenantId} data-current={current}>
        <button type="button" onClick={() => onPreview?.('kalla', 'keep')}>Förhandsvisa mall</button>
        <button type="button" onClick={onPublished}>Bekräfta publicering</button>
      </div>
    )
  },
}))

import { SidaStudioV2, type SidaStudioV2Props } from './SidaStudioV2'

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
        imageSlot: 'about_image',
        imageDefaults: ['https://example.test/default.webp'],
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
const draftRevision = {
  ...historyRevision,
  id: 'revision-draft',
  status: 'draft',
  lock_version: 4,
  published_at: null,
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

async function chooseImage(file: File) {
  await act(async () => button('Byt bild').click())
  const input = container.querySelector('input[type="file"]')
  if (!(input instanceof HTMLInputElement)) throw new Error('Image input missing')
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })))
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

function renderStudio(props: Partial<SidaStudioV2Props> = {}, key = 'studio') {
  root.render(
    <SidaStudioV2
      key={key}
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
      booking={{
        templateKey: 'leander',
        verificationMode: 'sms_with_email_fallback',
        externalUrl: null,
        externalCtaUrls: {},
        ctaSlots: [],
        bookingLive: true,
        bookingProvider: 'corevo',
        hasStaffPhoto: false,
      }}
      {...props}
    />,
  )
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
  mocks.themePublishingChange = null
  mocks.uploadSiteDraftImage.mockReset()
  mocks.discardSiteDraft.mockResolvedValue({ success: 'Utkastet har kastats.' })
  mocks.publishSiteDraft.mockResolvedValue({ success: 'Sidan är publicerad.', snapshot })
  mocks.restoreSiteRevision.mockResolvedValue({ success: 'Versionen har återställts.', lockVersion: 4 })
  mocks.saveSiteDraft.mockResolvedValue({ success: 'Utkastet är sparat.', lockVersion: 1 })
  mocks.uploadSiteDraftImage.mockResolvedValue({ url: 'https://example.test/uploaded.webp' })
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({
    width: 400,
    height: 300,
    close: vi.fn(),
  } as unknown as ImageBitmap)))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
    callback(new Blob(['crop'], { type: 'image/webp' }))
  })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:crop')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
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
  await act(async () => renderStudio())
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
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

describe('SidaStudioV2 template role gate', () => {
  it('shows the same saved draft and history on standalone and embedded surfaces', async () => {
    const readRevisionState = () => ({
      status: container.querySelector('[data-accept="editor-status"]')?.textContent,
      banner: container.querySelector('[data-accept="draft-banner"]')?.textContent,
      historyActions: [...container.querySelectorAll('button')]
        .filter((node) => node.textContent === 'Återställ').length,
    })
    const props: Partial<SidaStudioV2Props> = {
      effectiveSnapshot: historicSnapshot,
      draft: draftRevision,
      history: [historyRevision],
      initialTabId: 'allmant',
    }

    await act(async () => renderStudio({ ...props, surface: 'standalone' }, 'standalone'))
    const standalone = readRevisionState()
    await act(async () => renderStudio({ ...props, surface: 'embedded' }, 'embedded'))
    const embedded = readRevisionState()

    expect(standalone).toEqual(embedded)
    expect(embedded.status).toContain('Utkast')
    expect(embedded.banner).toContain('Utkast sparat')
    expect(embedded.historyActions).toBe(1)
  })

  it('fails closed, admits root, and hides switching behind dirty or draft state', async () => {
    await act(async () => button('Allmänt').click())
    expect(container.querySelector('[aria-label="Mallväljare"]')).toBeNull()

    await act(async () => renderStudio({ surface: 'embedded' }, 'embedded-partner'))
    await act(async () => button('Allmänt').click())
    expect(container.querySelector('[aria-label="Mallväljare"]')).toBeNull()

    await act(async () => renderStudio({ surface: 'embedded', canChangeTemplate: true }, 'embedded-root'))
    await act(async () => button('Allmänt').click())
    expect(container.querySelector('[aria-label="Mallväljare"]')).not.toBeNull()

    await editField('name', 'Ändrad kund')
    expect(container.querySelector('[aria-label="Mallväljare"]')).toBeNull()
    expect(container.textContent).toContain('Publicera eller kasta sidans ändringar innan du byter mall.')

    await act(async () => renderStudio({
      surface: 'embedded',
      canChangeTemplate: true,
      draft: draftRevision,
      effectiveSnapshot: historicSnapshot,
      initialTabId: 'allmant',
    }, 'draft'))
    expect(container.querySelector('[aria-label="Mallväljare"]')).toBeNull()
    expect(container.textContent).toContain('Publicera eller kasta sidans ändringar innan du byter mall.')
  })

  it('locks same-tick snapshot and revision actions for the full theme publication lifecycle', async () => {
    await act(async () => renderStudio({
      surface: 'embedded',
      canChangeTemplate: true,
      initialTabId: 'allmant',
    }, 'embedded-root-publishing'))
    expect(mocks.themePublishingChange).not.toBeNull()

    const name = field('name')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      mocks.themePublishingChange?.(true)
      setter?.call(name, 'Får inte sparas')
      name.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'Får inte sparas' }))
      button('Återställ').click()
    })
    await act(async () => { await Promise.resolve() })

    expect(name.value).toBe('Corevo Test')
    expect(mocks.restoreSiteRevision).not.toHaveBeenCalled()
    expect(container.querySelector('fieldset')?.hasAttribute('disabled')).toBe(true)
    expect(container.querySelector('[data-accept="editor-shell"]')?.getAttribute('aria-busy')).toBe('true')
    expect(button('Välj på sidan').disabled).toBe(true)

    await act(async () => mocks.themePublishingChange?.(false))
    expect(container.querySelector('fieldset')?.hasAttribute('disabled')).toBe(false)

    await act(async () => button('Återställ').click())
    expect(mocks.restoreSiteRevision).toHaveBeenCalledTimes(1)
    await editField('name', 'Tillåts efter publicering')
    expect(field('name').value).toBe('Tillåts efter publicering')
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

  it('commits the successful internal save before a publish conflict', async () => {
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
    expect(container.textContent).toContain('Utkast')
    expect(container.textContent).not.toContain('Osparat')
    expect(container.querySelector('[data-accept="draft-banner"]')).not.toBeNull()
    expect(container.querySelector('fieldset')?.hasAttribute('disabled')).toBe(true)
  })

  it('blocks revision and navigation actions while an image upload is pending, then saves the uploaded URL', async () => {
    await editField('heroTitle', 'Lokalt arbete')
    const pendingUpload = deferred<{ url: string }>()
    const pendingSave = deferred<{ success: string; lockVersion: number }>()
    mocks.uploadSiteDraftImage.mockReturnValueOnce(pendingUpload.promise)
    mocks.saveSiteDraft.mockReturnValueOnce(pendingSave.promise)
    await chooseImage(new File(['image'], 'salong.png', { type: 'image/png' }))

    act(() => button('Beskär och använd').click())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(mocks.uploadSiteDraftImage).toHaveBeenCalledTimes(1)

    const disabledDuringUpload = {
      save: button('Spara utkast').disabled,
      publish: button('Publicera').disabled,
      tab: button('Allmänt').disabled,
      pick: button('Välj på sidan').disabled,
    }
    const trigger = document.createElement('a')
    trigger.href = '/annan-sida'
    trigger.textContent = 'Gå vidare'
    document.body.append(trigger)
    let leaveDialogOpened = false
    try {
      await act(async () => trigger.click())
      leaveDialogOpened = document.querySelector('[role="dialog"]') !== null
      if (leaveDialogOpened) {
        await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
        act(() => vi.advanceTimersByTime(180))
      }

      act(() => {
        button('Spara utkast').click()
        button('Publicera').click()
      })
      await act(async () => { await Promise.resolve() })

      pendingUpload.resolve({ url: 'https://example.test/uploaded.webp' })
      await act(async () => {
        await pendingUpload.promise
        await Promise.resolve()
      })

      expect(container.querySelector('img[src="https://example.test/uploaded.webp"]')).not.toBeNull()
      expect(disabledDuringUpload).toEqual({ save: true, publish: true, tab: true, pick: true })
      expect(leaveDialogOpened).toBe(false)
      expect(mocks.saveSiteDraft).not.toHaveBeenCalled()
      expect(mocks.publishSiteDraft).not.toHaveBeenCalled()

      await act(async () => button('Spara utkast').click())
      expect(mocks.saveSiteDraft).toHaveBeenCalledWith(expect.objectContaining({
        snapshot: expect.objectContaining({
          branding: expect.objectContaining({ about_image: 'https://example.test/uploaded.webp' }),
        }),
      }))
    } finally {
      trigger.remove()
      pendingSave.resolve({ success: 'Utkastet är sparat.', lockVersion: 9 })
      await act(async () => { await Promise.resolve() })
    }
  })

  it('restores the clean upload sentinel on Back and keeps the guard for successful uploaded work', async () => {
    const pendingUpload = deferred<{ url?: string; error?: string }>()
    const pushState = vi.spyOn(window.history, 'pushState').mockImplementation(() => undefined)
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
    mocks.uploadSiteDraftImage.mockReturnValueOnce(pendingUpload.promise)
    await chooseImage(new File(['image'], 'salong.png', { type: 'image/png' }))

    act(() => button('Beskär och använd').click())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(pushState).toHaveBeenCalledTimes(1)

    try {
      await act(async () => {
        window.history.back()
        window.dispatchEvent(new PopStateEvent('popstate'))
      })

      expect(pushState).toHaveBeenCalledTimes(2)
      expect(container.querySelector('[role="status"]')?.textContent)
        .toBe('Bilden laddas upp. Vänta innan du lämnar sidan.')
      expect(document.querySelector('[role="dialog"]')).toBeNull()

      pendingUpload.resolve({ url: 'https://example.test/uploaded.webp' })
      await act(async () => {
        await pendingUpload.promise
        await Promise.resolve()
      })

      expect(back).toHaveBeenCalledTimes(1)
      expect(container.querySelector('img[src="https://example.test/uploaded.webp"]')).not.toBeNull()
      expect(container.textContent).not.toContain('Bilden laddas upp. Vänta innan du lämnar sidan.')

      await act(async () => window.dispatchEvent(new PopStateEvent('popstate')))
      expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Lämna redigeraren?')
      expect(mocks.push).not.toHaveBeenCalled()
    } finally {
      pendingUpload.resolve({ url: 'https://example.test/uploaded.webp' })
      await act(async () => { await Promise.resolve() })
    }
  })

  it('removes only the restored sentinel when a clean upload fails', async () => {
    const pendingUpload = deferred<{ url?: string; error?: string }>()
    const pushState = vi.spyOn(window.history, 'pushState').mockImplementation(() => undefined)
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => undefined)
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => undefined)
    mocks.uploadSiteDraftImage.mockReturnValueOnce(pendingUpload.promise)
    await chooseImage(new File(['image'], 'salong.png', { type: 'image/png' }))

    act(() => button('Beskär och använd').click())
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(pushState).toHaveBeenCalledTimes(1)

    try {
      await act(async () => {
        window.history.back()
        window.dispatchEvent(new PopStateEvent('popstate'))
      })
      expect(pushState).toHaveBeenCalledTimes(2)
      expect(document.querySelector('[role="dialog"]')).toBeNull()

      pendingUpload.resolve({ error: 'Uppladdningen misslyckades.' })
      await act(async () => {
        await pendingUpload.promise
        await Promise.resolve()
      })

      expect(back).toHaveBeenCalledTimes(2)
      expect(container.querySelector('[role="alert"]')?.textContent).toContain('Uppladdningen misslyckades.')
      expect(container.textContent).not.toContain('Bilden laddas upp. Vänta innan du lämnar sidan.')
      const pushesAfterCleanup = pushState.mock.calls.length

      await act(async () => window.dispatchEvent(new PopStateEvent('popstate')))
      expect(pushState).toHaveBeenCalledTimes(pushesAfterCleanup)
      expect(back).toHaveBeenCalledTimes(2)
      expect(go).not.toHaveBeenCalled()
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(mocks.push).not.toHaveBeenCalled()
    } finally {
      pendingUpload.resolve({ error: 'Uppladdningen misslyckades.' })
      await act(async () => { await Promise.resolve() })
    }
  })

  it.each([
    {
      label: 'returned error',
      result: { error: 'Utkastet kunde inte sparas.' },
      role: 'status',
      message: 'Utkastet kunde inte sparas.',
    },
    {
      label: 'conflict',
      result: { error: 'Utkastet har ändrats i en annan session.', conflict: true },
      role: 'alert',
      message: 'Utkastet har ändrats i en annan session.',
    },
  ])('closes the leave Modal and focuses the visible $label', async ({ result, role, message }) => {
    await editField('heroTitle', 'Osparat')
    mocks.saveSiteDraft.mockResolvedValueOnce(result)
    const trigger = document.createElement('a')
    trigger.href = '/annan-sida'
    trigger.textContent = 'Gå vidare'
    document.body.append(trigger)
    try {
      await act(async () => trigger.click())
      expect(document.querySelector('[role="dialog"]')).not.toBeNull()

      await act(async () => button('Spara utkast och lämna').click())
      await flushFrames()

      const notice = container.querySelector<HTMLElement>(`[role="${role}"]`)
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(notice?.textContent).toContain(message)
      expect(document.activeElement).toBe(notice)
      expect(mocks.push).not.toHaveBeenCalled()
    } finally {
      trigger.remove()
    }
  })

  it('closes the leave Modal and focuses the visible error when save throws', async () => {
    await editField('heroTitle', 'Osparat')
    mocks.saveSiteDraft.mockRejectedValueOnce(new Error('network'))
    const trigger = document.createElement('a')
    trigger.href = '/annan-sida'
    trigger.textContent = 'Gå vidare'
    document.body.append(trigger)
    try {
      await act(async () => trigger.click())
      await act(async () => button('Spara utkast och lämna').click())
      await flushFrames()

      const notice = container.querySelector<HTMLElement>('[role="status"]')
      expect(document.querySelector('[role="dialog"]')).toBeNull()
      expect(notice?.textContent).toContain('Utkastet kunde inte sparas.')
      expect(document.activeElement).toBe(notice)
      expect(mocks.push).not.toHaveBeenCalled()
    } finally {
      trigger.remove()
    }
  })

  it('retains a successful internal save and lock version when publish throws', async () => {
    await editField('heroTitle', 'Lokalt före nätfel')
    mocks.saveSiteDraft.mockResolvedValueOnce({ success: 'Utkastet är sparat.', lockVersion: 8 })
    mocks.publishSiteDraft.mockRejectedValueOnce(new Error('network'))

    await act(async () => button('Publicera').click())

    expect(field('heroTitle').value).toBe('Lokalt före nätfel')
    expect(container.textContent).toContain('Utkast')
    expect(container.textContent).not.toContain('Osparat')
    expect(container.textContent).toContain('Utkast sparat')
    expect(container.textContent).toContain('Sidan kunde inte publiceras.')

    await act(async () => button('Kasta utkast').click())
    expect(mocks.discardSiteDraft).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      expectedLockVersion: 8,
    })
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
