'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toggleStaffActive, setStaffServices, type ActionState } from '@/lib/admin/actions'
import { Badge, Button, Card, useToast } from '@/components/portal/ui'

export type BookabilityService = { id: string; name: string }

/**
 * "Kan bokas?"-kortet på Schema-sidan (Zivar 2026-07-11: bokningsbarheten kändes
 * utspridd på tre ställen). Visar och redigerar HELA bokningsbarhets-regeln för
 * den valda medarbetaren på samma yta som tiderna: aktiv-flaggan + tjänste-
 * kopplingen (samma server actions som Personal-panelen — en sanning, två dörrar).
 * Regeln: endast AKTIV personal med minst en kopplad tjänst går att boka, och
 * bara på tiderna nedan.
 */
export function StaffBookability({
  staffId,
  staffName,
  active,
  serviceIds,
  services,
  workingDays,
}: {
  staffId: string
  staffName: string
  active: boolean
  serviceIds: string[]
  services: BookabilityService[]
  workingDays: number
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [actState, actAction, actPending] = useActionState<ActionState, FormData>(
    toggleStaffActive,
    {},
  )
  const [svcState, svcAction, svcPending] = useActionState<ActionState, FormData>(
    setStaffServices,
    {},
  )

  useEffect(() => {
    if (actState.success) {
      notify(actState.success, 'info')
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actState.success])

  useEffect(() => {
    if (svcState.success) {
      notify('Tjänster kopplade', 'success')
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svcState.success])

  const bookable = active && serviceIds.length > 0 && workingDays > 0
  const reason = !active
    ? 'Inaktiv — kan inte bokas'
    : serviceIds.length === 0
      ? 'Inga tjänster — kan inte bokas'
      : workingDays === 0
        ? 'Inget schema — kan inte bokas'
        : `Kan bokas · ${workingDays} dagar/vecka`
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 14.5 }}>{staffName}</span>
        <Badge tone={bookable ? 'success' : 'warning'}>
          {reason}
        </Badge>
        <form action={actAction} style={{ marginLeft: 'auto' }}>
          <input type="hidden" name="id" value={staffId} />
          <input type="hidden" name="active" value={String(!active)} />
          <Button variant="ghost" type="submit" icon={active ? 'pause' : 'check'} size="sm" disabled={actPending}>
            {actPending ? '…' : active ? 'Inaktivera' : 'Aktivera'}
          </Button>
        </form>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
          gap: 8,
          marginTop: 12,
          fontSize: 12.5,
          color: 'var(--c-ink-2)',
        }}
        aria-label="Bokningsbarhet"
      >
        <span>① Status: <strong>{active ? 'aktiv' : 'inaktiv'}</strong></span>
        <span>② Tjänster: <strong>{serviceIds.length}</strong></span>
        <span>③ Schematider: <strong>{workingDays} dagar</strong></span>
      </div>

      <form action={svcAction} style={{ marginTop: 12 }}>
        <input type="hidden" name="staff_id" value={staffId} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
          {services.map((svc) => (
            <label
              key={svc.id}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                name="service_id"
                value={svc.id}
                defaultChecked={serviceIds.includes(svc.id)}
                style={{ accentColor: 'var(--c-forest)' }}
              />
              {svc.name}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          <Button variant="subtle" type="submit" icon="check" size="sm" disabled={svcPending}>
            {svcPending ? 'Sparar…' : 'Spara tjänster'}
          </Button>
          <span style={{ fontSize: 12, color: 'var(--c-ink-3)' }}>
            Alla tre stegen ovan måste vara klara. Foto, konto och plats sköts under{' '}
            <Link href="/admin/personal" style={{ color: 'var(--c-forest)', fontWeight: 600 }}>
              Personal
            </Link>
            .
          </span>
        </div>
        {(actState.error || svcState.error) && (
          <p className="auth-error" role="alert" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
            {actState.error ?? svcState.error}
          </p>
        )}
      </form>
    </Card>
  )
}
