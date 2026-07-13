import { describe, it, expect, vi, beforeEach } from 'vitest'

// KLUBBENS INTAG — vad testerna faktiskt vaktar (goal-64):
//   1. MODUL-GATEN: lojalitet inte 'live' → INGEN skrivning. draft/off/paused nekar alla.
//   2. TENANT-FENCEN: tenanten kommer ur middleware-headern, ALDRIG ur formuläret. Ett
//      klientskickat tenant-fält får inte kunna styra vart raden hamnar.
//   3. RATE-LIMIT: taket gäller FÖRE skrivningen (annars är limitern dekoration).
//   4. DUBBEL-JOIN: samma e-post två gånger spränger inte — RPC:n är idempotent och
//      actionen svarar 'done' båda gångerna.

const headerStore = { slug: 'salong-a' as string | null }
const rpcCalls: { fn: string; args: Record<string, unknown> }[] = []
const state = {
  moduleState: 'live' as string | null,
  rateLimitAllows: true,
  rpcError: null as { message: string } | null,
  /** (tenant, e-post) som redan är medlem — låter oss simulera DB:ns unique-index. */
  members: new Set<string>(),
}

vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => (k === 'x-corevo-tenant-slug' ? headerStore.slug : null) }),
}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/security/rate-limit', () => ({
  LIMITS: { loyalty: { max: 6, windowSecs: 300 } },
  getClientIp: async () => '1.2.3.4',
  rateLimitKey: (...p: string[]) => p.join(':'),
  checkRateLimit: async () => state.rateLimitAllows,
}))

vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => ({
    from: (table: string) => {
      const q = {
        _filters: {} as Record<string, unknown>,
        select: () => q,
        eq(col: string, val: unknown) {
          q._filters[col] = val
          return q
        },
        async maybeSingle() {
          if (table === 'tenants') {
            // Bara den slug middleware-headern pekar ut existerar.
            return q._filters.slug === 'salong-a'
              ? { data: { id: 'tenant-a', slug: 'salong-a' }, error: null }
              : { data: null, error: null }
          }
          if (table === 'tenant_modules') {
            return state.moduleState
              ? { data: { state: state.moduleState }, error: null }
              : { data: null, error: null }
          }
          return { data: null, error: null }
        },
      }
      return q
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args })
      if (state.rpcError) return { data: null, error: state.rpcError }
      // Simulera funktionens idempotens: en andra join med samma e-post är inget fel.
      state.members.add(`${args.p_tenant_slug}:${args.p_email}`)
      return { data: 'member-1', error: null }
    },
  }),
}))

import { joinLoyaltyClub } from './intake'

const fd = (entries: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(entries)) f.append(k, v)
  return f
}
const IDLE = { phase: 'idle' } as const

beforeEach(() => {
  rpcCalls.length = 0
  headerStore.slug = 'salong-a'
  state.moduleState = 'live'
  state.rateLimitAllows = true
  state.rpcError = null
  state.members.clear()
})

describe('joinLoyaltyClub — modul-gaten', () => {
  it('skriver EN rad när lojalitet är live', async () => {
    const res = await joinLoyaltyClub(IDLE, fd({ email: 'a@b.se', name: 'Ada' }))
    expect(res.phase).toBe('done')
    expect(rpcCalls).toHaveLength(1)
    expect(rpcCalls[0]!.fn).toBe('join_loyalty_club')
  })

  for (const bad of ['draft', 'off', 'paused']) {
    it(`nekar och skriver INGENTING när modulen är '${bad}'`, async () => {
      state.moduleState = bad
      const res = await joinLoyaltyClub(IDLE, fd({ email: 'a@b.se' }))
      expect(res.phase).toBe('error')
      expect(rpcCalls).toHaveLength(0) // 404-fällans motsats: en stängd klubb tar inte emot
    })
  }

  it('nekar när kunden saknar lojalitet-rad helt', async () => {
    state.moduleState = null
    const res = await joinLoyaltyClub(IDLE, fd({ email: 'a@b.se' }))
    expect(res.phase).toBe('error')
    expect(rpcCalls).toHaveLength(0)
  })
})

describe('joinLoyaltyClub — tenant-fencen', () => {
  it('tar tenanten ur middleware-headern, ALDRIG ur formuläret', async () => {
    // Klienten försöker peka ut en annan kund. Fältet ska ignoreras helt.
    await joinLoyaltyClub(IDLE, fd({ email: 'a@b.se', tenantId: 'tenant-ONDSKA', tenant_slug: 'salong-b' }))
    expect(rpcCalls[0]!.args.p_tenant_slug).toBe('salong-a') // headern vann
  })

  it('nekar när headern saknas (off-tenant-request)', async () => {
    headerStore.slug = null
    const res = await joinLoyaltyClub(IDLE, fd({ email: 'a@b.se' }))
    expect(res.phase).toBe('error')
    expect(rpcCalls).toHaveLength(0)
  })

  it('nekar när headerns slug inte matchar någon aktiv tenant', async () => {
    headerStore.slug = 'finns-inte'
    const res = await joinLoyaltyClub(IDLE, fd({ email: 'a@b.se' }))
    expect(res.phase).toBe('error')
    expect(rpcCalls).toHaveLength(0)
  })
})

describe('joinLoyaltyClub — rate-limit', () => {
  it('stoppar skrivningen när taket är nått', async () => {
    state.rateLimitAllows = false
    const res = await joinLoyaltyClub(IDLE, fd({ email: 'a@b.se' }))
    expect(res.phase).toBe('error')
    expect(rpcCalls).toHaveLength(0) // limitern gäller FÖRE skrivningen
  })
})

describe('joinLoyaltyClub — dubbel-join', () => {
  it('samma e-post två gånger spränger inte (idempotent)', async () => {
    const first = await joinLoyaltyClub(IDLE, fd({ email: 'ada@b.se' }))
    const second = await joinLoyaltyClub(IDLE, fd({ email: 'ada@b.se' }))
    expect(first.phase).toBe('done')
    expect(second.phase).toBe('done') // kunden som klickar två gånger får inget fel
    expect(state.members.size).toBe(1) // och kundregistret får ingen dubblett
  })
})

describe('joinLoyaltyClub — validering', () => {
  it.each(['', 'inte-en-epost', 'a@b'])('nekar ogiltig e-post: %s', async (email) => {
    const res = await joinLoyaltyClub(IDLE, fd({ email }))
    expect(res.phase).toBe('error')
    expect(rpcCalls).toHaveLength(0)
  })

  it('skickar planId vidare som p_plan (nivån valideras server-side i RPC:n)', async () => {
    await joinLoyaltyClub(IDLE, fd({ email: 'a@b.se', planId: 'plan-1' }))
    expect(rpcCalls[0]!.args.p_plan).toBe('plan-1')
  })
})
