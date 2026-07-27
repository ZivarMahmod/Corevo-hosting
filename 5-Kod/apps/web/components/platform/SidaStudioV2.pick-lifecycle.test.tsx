// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteSnapshot } from '@/lib/platform/site-revisions'
import type { SiteEditorManifest } from './SidaStudioV2.manifest'

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  searchParams: new URLSearchParams(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/sida',
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh, push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}))
vi.mock('@corevo/ui', () => ({ injectTenantTokens: () => ({}) }))
vi.mock('@/lib/platform/actions/site-revisions', () => ({
  discardSiteDraft: vi.fn(),
  publishSiteDraft: vi.fn(),
  restoreSiteRevision: vi.fn(),
  saveSiteDraft: vi.fn(),
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

let container: HTMLDivElement
let root: Root
let frameCallbacks: FrameRequestCallback[]
let originalScrollIntoView: PropertyDescriptor | undefined
let originalContentWindow: PropertyDescriptor | undefined
let postMessage: ReturnType<typeof vi.spyOn>

function button(label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find((node) => node.textContent === label)
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  return match
}

function frame(): HTMLIFrameElement {
  const iframe = container.querySelector('iframe')
  if (!(iframe instanceof HTMLIFrameElement) || !iframe.contentWindow) throw new Error('Preview iframe missing')
  return iframe
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
      history={[]}
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
