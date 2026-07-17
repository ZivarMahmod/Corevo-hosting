import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const webRoot = resolve(import.meta.dirname, '../..')
const read = (path: string) => readFileSync(resolve(webRoot, path), 'utf8')

describe('tenantens personliga behörighetsaction', () => {
  it('gatar owner på servern och skriver bara genom den smala RPC:n', () => {
    const action = read('lib/admin/member-permission-actions.ts')
    expect(action).toContain("requireOrganizationOwner('installningar')")
    expect(action).toContain("rpc('set_tenant_member_permissions'")
    expect(action).not.toContain(".from('tenant_member_permissions').upsert")
    expect(action).toContain("revalidatePath('/admin/installningar')")
  })

  it('renderar personliga konton, rollval och exakt fyra tillägg', () => {
    const component = read('components/admin/MemberPermissions.tsx')
    expect(component).toContain('PLATSCHEF')
    expect(component).toContain('FRISÖR')
    const configured = [...component.matchAll(/\['(can_[a-z_]+)',\s*'([^']+)'/g)]
      .map((match) => [match[1], match[2]])
    expect(configured).toEqual([
      ['can_view_all_calendars', 'Ser alla kalendrar'],
      ['can_manage_customers', 'Hanterar kundregistret'],
      ['can_edit_site', 'Redigerar sidan'],
      ['can_view_daily_metrics', 'Ser dagens siffror'],
    ])
  })
})
