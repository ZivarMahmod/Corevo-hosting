import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPortalPublicTenant: vi.fn(),
  getRecoveryStateAction: vi.fn(),
  noStore: vi.fn(),
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND') }),
}))

vi.mock('@/lib/customer-portal/public-tenant', () => ({ getPortalPublicTenant: mocks.getPortalPublicTenant }))
vi.mock('next/cache', () => ({ unstable_noStore: mocks.noStore }))
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/aterhamta/freshcut',
  useRouter: () => ({ replace: vi.fn() }),
}))
vi.mock('./verifiera/[tenantSlug]/actions', () => ({
  getRecoveryStateAction: mocks.getRecoveryStateAction,
  verifyRecoveryAction: vi.fn(),
}))
vi.mock('./aterhamta/[tenantSlug]/actions', () => ({
  startRecoveryAction: vi.fn(),
  resendRecoveryAction: vi.fn(),
}))

import RecoveryPage, * as RecoveryRoute from './aterhamta/[tenantSlug]/page'
import VerifyPage, * as VerifyRoute from './verifiera/[tenantSlug]/page'

type MetadataGenerator = (input: { params: Promise<{ tenantSlug: string }> }) => Promise<{ title?: string; robots?: unknown; referrer?: string }>

describe('public recovery routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPortalPublicTenant.mockResolvedValue({ tenantName: 'FreshCut' })
    mocks.getRecoveryStateAction.mockResolvedValue({ state: 'sent', attemptsRemaining: 5, retryAfterSeconds: 30 })
  })

  it('is noindex/no-cache, no-store and renders only public tenant identity in the recovery shell', async () => {
    const html = renderToStaticMarkup(await RecoveryPage({ params: Promise.resolve({ tenantSlug: 'freshcut' }) }))
    expect(mocks.noStore).toHaveBeenCalled()
    expect(mocks.getPortalPublicTenant).toHaveBeenCalledWith('freshcut')
    expect(html.match(/<main id="huvudinnehall"/g)).toHaveLength(1)
    expect(html).toContain('FreshCut')
    expect(html).not.toMatch(/aria-label="Huvudmeny"|Öppna profil|Logga ut|tenantId|customerId/)
  })

  it('turns only the neutral session flag into the canonical CP-REC-11 toast', async () => {
    const expired = renderToStaticMarkup(await RecoveryPage({
      params: Promise.resolve({ tenantSlug: 'freshcut' }),
      searchParams: Promise.resolve({ session: 'expired' }),
    }))
    expect(expired).toContain('Din session har gått ut. Verifiera dig igen.')
    expect(expired).toContain('role="status"')

    const arbitrary = renderToStaticMarkup(await RecoveryPage({
      params: Promise.resolve({ tenantSlug: 'freshcut' }),
      searchParams: Promise.resolve({ session: 'anything-else' }),
    }))
    expect(arbitrary).not.toContain('Din session har gått ut. Verifiera dig igen.')
  })

  it('loads only neutral challenge state for verification and never channel/provider state', async () => {
    const html = renderToStaticMarkup(await VerifyPage({ params: Promise.resolve({ tenantSlug: 'freshcut' }) }))
    expect(mocks.noStore).toHaveBeenCalled()
    expect(mocks.getRecoveryStateAction).toHaveBeenCalledWith('freshcut')
    expect(html).toContain('Om uppgiften finns hos oss har vi skickat en kod.')
    expect(html).not.toMatch(/SMS|maskerad|provider|tenantId|customerId/i)
  })

  it('resolves exact tenant-aware metadata on both recovery routes', async () => {
    const recoveryMetadata = (RecoveryRoute as unknown as { generateMetadata?: MetadataGenerator }).generateMetadata
    const verifyMetadata = (VerifyRoute as unknown as { generateMetadata?: MetadataGenerator }).generateMetadata
    expect(recoveryMetadata).toBeTypeOf('function')
    expect(verifyMetadata).toBeTypeOf('function')
    if (!recoveryMetadata || !verifyMetadata) return

    await expect(recoveryMetadata({ params: Promise.resolve({ tenantSlug: 'freshcut' }) })).resolves.toMatchObject({
      title: 'Kom åt dina bokningar – FreshCut',
      robots: { index: false, follow: false, nocache: true },
      referrer: 'no-referrer',
    })
    await expect(verifyMetadata({ params: Promise.resolve({ tenantSlug: 'freshcut' }) })).resolves.toMatchObject({
      title: 'Ange koden – FreshCut',
      robots: { index: false, follow: false, nocache: true },
      referrer: 'no-referrer',
    })
  })

  it.each(['Bad-Slug', 'missing'])('fails closed for invalid or unknown tenant %s', async (tenantSlug) => {
    if (tenantSlug === 'missing') mocks.getPortalPublicTenant.mockResolvedValue(null)
    await expect(RecoveryPage({ params: Promise.resolve({ tenantSlug }) })).rejects.toThrow('NEXT_NOT_FOUND')
    await expect(VerifyPage({ params: Promise.resolve({ tenantSlug }) })).rejects.toThrow('NEXT_NOT_FOUND')
  })
})
