/**
 * @vitest-environment happy-dom
 */

import { act, type ComponentProps, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionState } from '@/lib/admin/actions'
import { GalleriAdmin } from './GalleriAdmin'

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  notify: vi.fn(),
  reorder: vi.fn<(prev: ActionState, fd: FormData) => Promise<ActionState>>(
    async () => ({ success: 'Ordningen är sparad.' }),
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock('@/lib/admin/galleri/actions', () => ({
  createGalleryItem: async () => ({}),
  deleteGalleryItem: async () => ({}),
  reorderGalleryItems: mocks.reorder,
  updateGalleryItem: async () => ({}),
}))

vi.mock('@/components/portal/ui', () => ({
  Button: ({
    children,
    disabled,
    href,
    onClick,
    type,
  }: {
    children: ReactNode
    disabled?: boolean
    href?: string
    onClick?: () => void
    type?: 'button' | 'submit'
  }) =>
    href ? (
      <a href={href}>{children}</a>
    ) : (
      <button type={type ?? 'button'} disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
  Callout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Drawer: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => (
    <div>
      {children}
      {footer}
    </div>
  ),
  EmptyState: ({ title, text }: { title: string; text: ReactNode }) => (
    <div>
      {title}
      {text}
    </div>
  ),
  Field: ({ children, label }: { children: ReactNode; label: string }) => (
    <label>
      {label}
      {children}
    </label>
  ),
  PageHead: ({ children, title }: { children: ReactNode; title: string }) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
  inputStyle: {},
  selectStyle: {},
  textareaStyle: {},
  useToast: () => ({ notify: mocks.notify }),
}))

vi.mock('./ImagePicker', () => ({
  ImagePicker: ({ name, formId }: { name: string; formId: string }) => (
    <input type="hidden" name={name} form={formId} value="asset-1" readOnly />
  ),
}))

const items = [
  {
    id: 'gallery-1',
    assetId: 'asset-1',
    imageUrl: 'https://example.test/1.jpg',
    caption: 'Första',
    tag: null,
    yearLabel: null,
    aspectRatio: null,
    altOverride: 'Första bilden',
    decorative: false,
    sortOrder: 0,
    active: true,
  },
  {
    id: 'gallery-2',
    assetId: 'asset-2',
    imageUrl: 'https://example.test/2.jpg',
    caption: 'Andra',
    tag: null,
    yearLabel: null,
    aspectRatio: null,
    altOverride: null,
    decorative: true,
    sortOrder: 1,
    active: true,
  },
] satisfies ComponentProps<typeof GalleriAdmin>['items']

const assets = [
  {
    id: 'asset-1',
    url: 'https://example.test/1.jpg',
    r2Key: '1.jpg',
    type: 'image',
    alt: null,
    sizeBytes: 1,
    width: null,
    height: null,
    source: 'upload',
    status: 'ready',
    lastError: null,
    createdAt: '2026-07-29T00:00:00Z',
  },
] satisfies ComponentProps<typeof GalleriAdmin>['assets']

const props = {
  items,
  assets,
  tenantName: 'Testföretaget',
  previewHref: '/salong-preview/test/galleri',
} satisfies ComponentProps<typeof GalleriAdmin>

let container: HTMLDivElement
let root: Root

function button(label: string) {
  const match = [...container.querySelectorAll('button')].find((node) =>
    node.textContent?.includes(label),
  )
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Knappen saknas: ${label}`)
  return match
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mocks.refresh.mockReset()
  mocks.notify.mockReset()
  mocks.reorder.mockReset()
  mocks.reorder.mockResolvedValue({ success: 'Ordningen är sparad.' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('GalleriAdmin', () => {
  it('skickar alltid hela ID-mängden i den nya ordningen', async () => {
    await act(async () => root.render(<GalleriAdmin {...props} />))
    await act(async () => button('Flytta ned').click())

    const formData = mocks.reorder.mock.calls[0]?.[1] as FormData
    expect(formData.getAll('ids')).toEqual(['gallery-2', 'gallery-1'])
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })

  it('visar paused som verkligt skrivskyddat', async () => {
    await act(async () => root.render(<GalleriAdmin {...props} readOnly />))

    expect(container.textContent).toContain('Galleriet är pausat')
    expect(button('Lägg till bild').disabled).toBe(true)
    expect(button('Flytta ned').disabled).toBe(true)
    expect(container.textContent).not.toContain('Redigera')
    expect(container.textContent).not.toContain('Ta bort')
  })

  it('visar reorder-felet och lämnar vyn orörd', async () => {
    mocks.reorder.mockResolvedValueOnce({ error: 'Ladda om och försök igen.' })
    await act(async () => root.render(<GalleriAdmin {...props} />))
    await act(async () => button('Flytta ned').click())

    expect(mocks.notify).toHaveBeenCalledWith('Ladda om och försök igen.', 'warning')
    expect(mocks.refresh).not.toHaveBeenCalled()
  })
})
