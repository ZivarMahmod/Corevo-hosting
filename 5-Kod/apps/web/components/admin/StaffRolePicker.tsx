'use client'

import { useActionState } from 'react'
import { Button } from '@/components/portal/ui'
import {
  saveMemberPermissions,
  type MemberPermissionActionState,
} from '@/lib/admin/member-permission-actions'
import type { MemberPermissions as PermissionValue } from '@/lib/admin/member-permissions'

/** De fyra tilläggen — samma namn/etikett/hint som MemberRow i MemberPermissions,
 *  ordagrant lyft så rollval och tillägg är identiska i båda ytorna. */
const extras = [
  ['can_view_all_calendars', 'Ser alla kalendrar', 'Annars bara sin egen'],
  ['can_manage_customers', 'Hanterar kundregistret', 'Se och ändra alla kunder'],
  ['can_edit_site', 'Redigerar sidan', 'Texter, bilder och färger'],
  ['can_view_daily_metrics', 'Ser dagens siffror', 'Bokat belopp och beläggning'],
] as const

/**
 * Roll-väljaren inuti medarbetarens detaljsida — MemberRow-logiken ur
 * MemberPermissions, oförändrad server-action (saveMemberPermissions → RPC
 * set_tenant_member_permissions). Rollen ligger på staff_id och funkar utan konto:
 * sätts den före inbjudan ligger den redan där när kontot kopplas. Restylad till
 * detaljsidans portal-grammatik (eyebrow + fieldStyle + portal-Button).
 */
export function StaffRolePicker({
  staffId,
  hasAccount,
  permissions,
}: {
  staffId: string
  hasAccount: boolean
  permissions: PermissionValue
}) {
  const [state, action, pending] = useActionState<MemberPermissionActionState, FormData>(
    saveMemberPermissions,
    {},
  )
  const values = {
    can_view_all_calendars: permissions.canViewAllCalendars,
    can_manage_customers: permissions.canManageCustomers,
    can_edit_site: permissions.canEditSite,
    can_view_daily_metrics: permissions.canViewDailyMetrics,
  }

  return (
    <section>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        Roll &amp; behörigheter
      </div>
      <form action={action} style={{ display: 'grid', gap: 12 }}>
        <input type="hidden" name="staff_id" value={staffId} />
        <label style={{ display: 'grid', gap: 5, fontSize: 12.5, color: 'var(--c-ink-2)' }}>
          Roll
          <select name="operational_role" defaultValue={permissions.operationalRole} style={fieldStyle}>
            <option value="manager">PLATSCHEF</option>
            <option value="staff">FRISÖR</option>
          </select>
        </label>
        <div style={{ display: 'grid', gap: 8 }}>
          {extras.map(([name, label, hint]) => (
            <label
              key={name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: 13,
                color: 'var(--c-ink)',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'grid' }}>
                <strong style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</strong>
                <small style={{ color: 'var(--c-ink-3)', fontSize: 11.5 }}>{hint}</small>
              </span>
              <input
                name={name}
                type="checkbox"
                value="true"
                defaultChecked={values[name]}
                style={{ accentColor: 'var(--c-forest)' }}
              />
            </label>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span
            role="status"
            style={{
              fontSize: 12,
              fontStyle: 'italic',
              color: state.error ? 'var(--c-danger, #b3261e)' : 'var(--c-ink-3)',
            }}
          >
            {state.error ??
              state.success ??
              (hasAccount
                ? 'Tillägg utöver rollen — gäller bara den här personen.'
                : 'Sparas nu — gäller så fort hen har bjudits in.')}
          </span>
          <Button variant="subtle" type="submit" icon="check" size="sm" disabled={pending}>
            {pending ? 'Sparar…' : 'Spara roll'}
          </Button>
        </div>
      </form>
    </section>
  )
}

const fieldStyle = {
  minWidth: 0,
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--c-line)',
  background: 'var(--c-paper)',
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
  fontSize: 13.5,
  boxSizing: 'border-box',
} as const
