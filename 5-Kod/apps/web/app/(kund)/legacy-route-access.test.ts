import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  currentTenant: vi.fn(),
  currentRequestTenant: vi.fn(),
  requirePortal: vi.fn(),
  requireUser: vi.fn(),
  getCurrentUser: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT')
  }),
  headers: vi.fn(),
  getTenantFromHost: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('@/lib/tenant-data', () => ({
  currentTenant: mocks.currentTenant,
  currentRequestTenant: mocks.currentRequestTenant,
}))
vi.mock('@/lib/auth/session', () => ({
  requirePortal: mocks.requirePortal,
  requireUser: mocks.requireUser,
  getCurrentUser: mocks.getCurrentUser,
}))
vi.mock('@/lib/tenant', () => ({
  getTenantFromHost: mocks.getTenantFromHost,
  isPreviewHost: vi.fn(() => false),
}))
vi.mock('@/lib/auth/roles', () => ({
  loginAccessForHost: vi.fn(() => ({ allowed: true })),
  loginDestinationForHost: vi.fn(() => '/'),
  portalHomeFor: vi.fn(() => '/'),
  resolveLoginHostKind: vi.fn(() => 'other'),
}))
vi.mock('@/lib/auth/internal-redirect', () => ({
  safeInternalRedirectPath: vi.fn((value: unknown) => typeof value === 'string' ? value : null),
}))
vi.mock('@/components/portal/PortalShell', () => ({
  PortalShell: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('@/components/kund/SignUpForm', () => ({ SignUpForm: () => null }))
vi.mock('@/app/(auth)/login/LoginForm', () => ({ LoginForm: () => null }))
vi.mock('@/lib/kund/customer-host-fence', () => ({ canRenderCustomerPortal: vi.fn(() => true) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/auth/actions', () => ({ signOut: vi.fn() }))
vi.mock('@/lib/kund/customer-claim', () => ({
  hashCustomerClaimToken: vi.fn(),
  isCustomerClaimPath: vi.fn(() => true),
}))
vi.mock('@/lib/kund/customer-claim-server', () => ({ consumeCustomerClaim: vi.fn() }))
vi.mock('@corevo/ui', () => ({ injectTenantTokens: vi.fn(() => ({})) }))

import LoginPage from '@/app/(auth)/login/page'
import CustomerClaimPage from '@/app/(kund)/(claim)/konto/koppla/[token]/page'
import KontoLayout from '@/app/(kund)/konto/layout'
import RegistreraPage from '@/app/(kund)/registrera/page'

const passwordlessBundle = {
  tenant: { id: 'tenant-a', slug: 'freshcut', name: 'FreshCut' },
  settings: {
    portalMode: 'passwordless_tenant',
    customerAccountsEnabled: false,
  },
}

const legacyBundle = {
  tenant: { id: 'tenant-a', slug: 'freshcut', name: 'FreshCut' },
  settings: {
    portalMode: 'legacy_account',
    customerAccountsEnabled: true,
    branding: {},
  },
}

describe('legacy customer route fences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.currentTenant.mockResolvedValue(passwordlessBundle)
    mocks.currentRequestTenant.mockResolvedValue(passwordlessBundle.tenant)
    mocks.headers.mockResolvedValue(new Headers({ host: 'freshcut.corevo.se' }))
    mocks.getTenantFromHost.mockReturnValue({ kind: 'tenant', slug: 'freshcut' })
    mocks.getCurrentUser.mockResolvedValue(null)
  })

  it('rejects the account subtree before customer auth', async () => {
    await expect(KontoLayout({ children: null })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.requirePortal).not.toHaveBeenCalled()
  })

  it('rejects signup before checking an existing session', async () => {
    await expect(RegistreraPage({
      searchParams: Promise.resolve({ next: '/konto/koppla/token' }),
    })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.getCurrentUser).not.toHaveBeenCalled()
  })

  it('rejects account claims before requiring a user', async () => {
    await expect(CustomerClaimPage({
      params: Promise.resolve({ token: 'token' }),
    })).rejects.toThrow('NEXT_NOT_FOUND')
    expect(mocks.requireUser).not.toHaveBeenCalled()
  })

  it('rejects tenant login before reading a customer session', async () => {
    await expect(LoginPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    )
    expect(mocks.getCurrentUser).not.toHaveBeenCalled()
  })

  it.each(['platform', 'staff_portal', 'superadmin'])('keeps %s login available', async (kind) => {
    mocks.currentTenant.mockResolvedValue(null)
    mocks.getTenantFromHost.mockReturnValue({ kind })

    await expect(LoginPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy()
    expect(mocks.notFound).not.toHaveBeenCalled()
    expect(mocks.getCurrentUser).toHaveBeenCalledOnce()
  })

  it('keeps legacy tenant login available', async () => {
    mocks.currentTenant.mockResolvedValue(legacyBundle)

    await expect(LoginPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy()
    expect(mocks.notFound).not.toHaveBeenCalled()
    expect(mocks.getCurrentUser).toHaveBeenCalledOnce()
  })
})
