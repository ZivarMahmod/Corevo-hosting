import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('provisionStaffInvite', () => {
  it('creates the account before handing the verified auth id to the tenant-specific staff write', async () => {
    const events: string[] = []
    const roleQuery = {
      select() {
        return this
      },
      eq() {
        return this
      },
      async maybeSingle() {
        events.push('role:read')
        return { data: { id: 'role-staff' }, error: null }
      },
    }
    const profileQuery = {
      select() {
        return this
      },
      eq() {
        return this
      },
      async maybeSingle() {
        events.push('profile:read')
        return { data: null, error: null }
      },
    }
    const service = {
      from(table: string) {
        if (table === 'users') return profileQuery
        throw new Error(`Unexpected service table: ${table}`)
      },
      auth: {
        admin: {
          async inviteUserByEmail() {
            events.push('auth:invite')
            return { data: { user: { id: 'auth-new' } }, error: null }
          },
          async updateUserById() {
            events.push('auth:metadata')
            return { data: { user: { id: 'auth-new' } }, error: null }
          },
        },
      },
    }
    const accountClient = {
      from(table: string) {
        if (table === 'roles') {
          return {
            async upsert() {
              events.push('role:ensure')
              return { error: null }
            },
            ...roleQuery,
          }
        }
        if (table === 'users') {
          return {
            async insert() {
              events.push('profile:insert')
              return { error: null }
            },
          }
        }
        throw new Error(`Unexpected account table: ${table}`)
      },
    }
    const createStaff = vi.fn(async (authId: string) => {
      events.push(`staff:create:${authId}`)
      return { error: null }
    })

    const inviteModule = (await import('./staff-invite-service')) as Record<string, unknown>
    const provisionStaffInvite = inviteModule.provisionStaffInvite
    expect(provisionStaffInvite).toBeTypeOf('function')
    if (typeof provisionStaffInvite !== 'function') return

    const result = await provisionStaffInvite({
      service,
      accountClient,
      tenantId: 'tenant-1',
      email: 'anna@example.se',
      createStaff,
      reportIncident: vi.fn(),
    })

    expect(result).toEqual({ ok: true, inviteSent: true, alreadyLinked: false })
    expect(events).toEqual([
      'role:ensure',
      'role:read',
      'profile:read',
      'auth:invite',
      'auth:metadata',
      'profile:insert',
      'staff:create:auth-new',
    ])
  })

  it('treats the exact reusable account already linked to the requested staff row as an idempotent success', async () => {
    const query = (result: { data: unknown; error: unknown }) => {
      const filters = new Map<string, unknown>()
      const builder = {
        select() {
          return builder
        },
        eq(column: string, value: unknown) {
          filters.set(column, value)
          return builder
        },
        limit() {
          return builder
        },
        async maybeSingle() {
          return result
        },
      }
      return { builder, filters }
    }
    const accountClient = {
      from(table: string) {
        if (table !== 'roles') throw new Error(`Unexpected account table: ${table}`)
        const role = query({ data: { id: 'role-staff' }, error: null }).builder
        return {
          async upsert() {
            return { error: null }
          },
          ...role,
        }
      },
    }
    const inviteUserByEmail = vi.fn(async () => {
      throw new Error('Auth must not receive a second invite')
    })
    const service = {
      from(table: string) {
        if (table === 'users') {
          return query({ data: { id: 'auth-existing', status: 'active' }, error: null }).builder
        }
        if (table === 'staff') {
          return query({
            data: { id: 'staff-existing', profile_id: 'auth-existing' },
            error: null,
          }).builder
        }
        throw new Error(`Unexpected service table: ${table}`)
      },
      auth: {
        admin: {
          async getUserById() {
            return {
              data: { user: { id: 'auth-existing', banned_until: null, deleted_at: null } },
              error: null,
            }
          },
          inviteUserByEmail,
        },
      },
    }

    const inviteModule = (await import('./staff-invite-service')) as Record<string, unknown>
    const provisionStaffInvite = inviteModule.provisionStaffInvite
    expect(provisionStaffInvite).toBeTypeOf('function')
    if (typeof provisionStaffInvite !== 'function') return

    const result = await provisionStaffInvite({
      service,
      accountClient,
      tenantId: 'tenant-1',
      email: 'anna@example.se',
      targetStaffId: 'staff-existing',
      createStaff: vi.fn(async () => {
        throw new Error('Staff must not be created again')
      }),
      reportIncident: vi.fn(),
    })

    expect(result).toEqual({ ok: true, inviteSent: false, alreadyLinked: true })
    expect(inviteUserByEmail).not.toHaveBeenCalled()
  })

  it('cleans the provisional profile and Auth user when the tenant-specific staff write fails', async () => {
    const events: string[] = []
    let profile: {
      id: string
      tenant_id: string
      role_id: string
      status: string
    } | null = null

    const service = {
      from(table: string) {
        let selected = ''
        const builder = {
          select(columns: string) {
            selected = columns
            return builder
          },
          eq() {
            return builder
          },
          limit() {
            return builder
          },
          async maybeSingle() {
            if (table === 'staff') return { data: null, error: null }
            if (table !== 'users') throw new Error(`Unexpected service table: ${table}`)
            if (!profile) return { data: null, error: null }
            return selected.includes('tenant_id')
              ? {
                  data: { tenant_id: profile.tenant_id, role_id: profile.role_id },
                  error: null,
                }
              : { data: { id: profile.id, status: profile.status }, error: null }
          },
        }
        return builder
      },
      async rpc(name: string) {
        if (name !== 'prepare_staff_invite_cleanup') {
          throw new Error(`Unexpected RPC: ${name}`)
        }
        profile = null
        events.push('profile:cleanup')
        return { data: 'profile_deleted', error: null }
      },
      auth: {
        admin: {
          async inviteUserByEmail() {
            return { data: { user: { id: 'auth-new' } }, error: null }
          },
          async updateUserById() {
            return { data: { user: { id: 'auth-new' } }, error: null }
          },
          async deleteUser() {
            events.push('auth:delete')
            return { error: null }
          },
        },
      },
    }
    const accountClient = {
      from(table: string) {
        if (table === 'roles') {
          const role = {
            select() {
              return role
            },
            eq() {
              return role
            },
            async maybeSingle() {
              return { data: { id: 'role-staff' }, error: null }
            },
            async upsert() {
              return { error: null }
            },
          }
          return role
        }
        if (table === 'users') {
          return {
            async insert(row: typeof profile) {
              profile = row
              return { error: null }
            },
          }
        }
        throw new Error(`Unexpected account table: ${table}`)
      },
    }

    const inviteModule = (await import('./staff-invite-service')) as Record<string, unknown>
    const provisionStaffInvite = inviteModule.provisionStaffInvite
    expect(provisionStaffInvite).toBeTypeOf('function')
    if (typeof provisionStaffInvite !== 'function') return

    const result = await provisionStaffInvite({
      service,
      accountClient,
      tenantId: 'tenant-1',
      email: 'anna@example.se',
      createStaff: vi.fn(async () => ({ error: new Error('staff write failed') })),
      reportIncident: vi.fn(),
    })

    expect(result).toEqual({
      ok: false,
      error: 'Inbjudan kunde inte slutföras. Det provisoriska kontot städades; försök igen.',
    })
    expect(profile).toBeNull()
    expect(events).toEqual(['profile:cleanup', 'auth:delete'])
  })
})
