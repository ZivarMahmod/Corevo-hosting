'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import {
  saveMemberPermissions,
  type MemberPermissionActionState,
} from '@/lib/admin/member-permission-actions'
import type { MemberPermissions as PermissionValue } from '@/lib/admin/member-permissions'
import styles from './settings-v2.module.css'

export type PermissionMember = {
  id: string
  name: string
  subtitle: string
  hasAccount: boolean
  permissions: PermissionValue
}

const extras = [
  ['can_view_all_calendars', 'Ser alla kalendrar', 'Annars bara sin egen'],
  ['can_manage_customers', 'Hanterar kundregistret', 'Se och ändra alla kunder'],
  ['can_edit_site', 'Redigerar sidan', 'Texter, bilder och färger'],
  ['can_view_daily_metrics', 'Ser dagens siffror', 'Bokat belopp och beläggning'],
] as const

function MemberRow({ member }: { member: PermissionMember }) {
  const [state, action, pending] = useActionState<MemberPermissionActionState, FormData>(
    saveMemberPermissions,
    {},
  )
  const values = {
    can_view_all_calendars: member.permissions.canViewAllCalendars,
    can_manage_customers: member.permissions.canManageCustomers,
    can_edit_site: member.permissions.canEditSite,
    can_view_daily_metrics: member.permissions.canViewDailyMetrics,
  }

  if (!member.hasAccount) {
    return (
      <div className={styles.memberRow}>
        <span className={styles.avatar}>{member.name.slice(0, 1).toUpperCase()}</span>
        <span className={styles.memberCopy}><strong>{member.name}</strong><small>{member.subtitle} · inget personligt konto</small></span>
        <Link href="/admin/personal">Bjud in</Link>
      </div>
    )
  }

  return (
    <form action={action} className={styles.memberForm}>
      <input type="hidden" name="staff_id" value={member.id} />
      <div className={styles.memberRow}>
        <span className={styles.avatar}>{member.name.slice(0, 1).toUpperCase()}</span>
        <span className={styles.memberCopy}><strong>{member.name}</strong><small>{member.subtitle}</small></span>
        <select name="operational_role" defaultValue={member.permissions.operationalRole}>
          <option value="manager">PLATSCHEF</option>
          <option value="staff">FRISÖR</option>
        </select>
      </div>
      <div className={styles.permissionRows}>
        {extras.map(([name, label, hint]) => (
          <label key={name}>
            <span><strong>{label}</strong><small>{hint}</small></span>
            <input name={name} type="checkbox" value="true" defaultChecked={values[name]} />
          </label>
        ))}
        <div className={styles.permissionSave}>
          <span className={state.error ? styles.actionError : styles.actionSuccess} role="status">
            {state.error ?? state.success ?? 'Tillägg utöver rollen — gäller bara den här personen.'}
          </span>
          <button type="submit" disabled={pending}>{pending ? 'Sparar…' : 'Spara'}</button>
        </div>
      </div>
    </form>
  )
}

export function MemberPermissions({ ownerEmail, members }: { ownerEmail: string; members: PermissionMember[] }) {
  return (
    <div className={styles.permissions}>
      <p className={styles.monoLabel}>TRE ROLLER</p>
      <div className={styles.roleCards}>
        <div><span>ÄGARE</span><p>Allt — betalning, roller, GDPR och sidan. Flera ägare går bra.</p></div>
        <div><span>PLATSCHEF</span><p>Vardagsdriften: kalender, kunder, tjänster och scheman.</p></div>
        <div><span>FRISÖR</span><p>Sin egen kalender och sina bokningar, plus uttryckliga tillägg.</p></div>
      </div>
      <p className={styles.monoLabel}>TEAMET</p>
      <div className={styles.memberList}>
        <div className={styles.memberRow}>
          <span className={styles.avatar}>Ä</span>
          <span className={styles.memberCopy}><strong>{ownerEmail}</strong><small>Personligt ägarkonto · det är du</small></span>
          <span className={styles.ownerChip}>ÄGARE</span>
        </div>
        {members.map((member) => <MemberRow key={member.id} member={member} />)}
      </div>
      <p className={styles.accountNote}>Dela aldrig en inloggning. Sparade roll- och behörighetsändringar auditloggas med ditt konto.</p>
    </div>
  )
}
