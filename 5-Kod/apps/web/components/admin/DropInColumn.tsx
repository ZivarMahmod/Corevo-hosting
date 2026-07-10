'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createDropInBooking, type DropInState } from '@/lib/admin/dropin-actions'
import { useToast } from '@/components/portal/ui/Toast'
import { Icon } from '@/components/portal/ui/Icon'

export type KioskBooking = {
  id: string
  startMs: number
  timeLabel: string
  customerName: string
  serviceName: string
  pending: boolean
  locationName: string | null
}

export type KioskFreeSlot = {
  startIso: string
  startMs: number
  label: string
  locationId: string | null
  past: boolean
}

export type KioskService = { id: string; name: string; durationMin: number }

/**
 * En medarbetar-kolumn i Bokningsvyn — bokningar OCH lediga tider i tidsordning
 * (Zivar 2026-07-10: "man ska se lediga tider så en drop-in kan bokas in med
 * 2 knapptryck"). Tryck 1 = ledig tid, tryck 2 = Boka (första tjänsten är
 * förvald; byt med ett extra tryck vid behov). Bokningen går genom samma RPC
 * som onlinebokningar → tiden försvinner ur publika flödet i samma stund och
 * dubbelbokning är omöjlig — förloraren i en kapplöpning får ett ärligt fel
 * och listan laddas om.
 */
export function DropInColumn({
  staffId,
  staffName,
  bookings,
  freeSlots,
  services,
  showLoc,
}: {
  staffId: string
  staffName: string
  bookings: KioskBooking[]
  freeSlots: KioskFreeSlot[]
  services: KioskService[]
  showLoc: boolean
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [open, setOpen] = useState<KioskFreeSlot | null>(null)
  const [serviceId, setServiceId] = useState(services[0]?.id ?? '')
  const [state, formAction, pending] = useActionState<DropInState, FormData>(
    createDropInBooking,
    {},
  )

  useEffect(() => {
    if (state.success) {
      notify(state.success, 'success')
      setOpen(null)
      router.refresh()
    } else if (state.error) {
      notify(state.error, 'warning')
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // Bokat + ledigt i EN kronologisk ström — frisören ser dagen som den är.
  const items: ({ kind: 'booking'; b: KioskBooking } | { kind: 'free'; f: KioskFreeSlot })[] = [
    ...bookings.map((b) => ({ kind: 'booking' as const, b })),
    ...freeSlots.map((f) => ({ kind: 'free' as const, f })),
  ].sort((a, x) => (a.kind === 'booking' ? a.b.startMs : a.f.startMs) - (x.kind === 'booking' ? x.b.startMs : x.f.startMs))

  return (
    <div className="admin-kiosk-col">
      <div className="admin-kiosk-colhead">
        <span className="admin-kiosk-avatar" aria-hidden="true">
          {staffName.charAt(0).toUpperCase()}
        </span>
        {staffName}
        <span className="admin-kiosk-count">{bookings.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="admin-kiosk-empty">Inga tider idag</p>
      ) : (
        items.map((it) =>
          it.kind === 'booking' ? (
            <div key={it.b.id} className={`admin-kiosk-slot${it.b.pending ? ' is-pending' : ''}`}>
              <span className="admin-kiosk-time num">{it.b.timeLabel}</span>
              <span className="admin-kiosk-cust">{it.b.customerName}</span>
              <span className="admin-kiosk-svc">{it.b.serviceName}</span>
              {it.b.pending ? <span className="admin-kiosk-badge">Obekräftad</span> : null}
              {showLoc && it.b.locationName ? (
                <span className="admin-kiosk-loc">
                  <Icon name="mapPin" size={10} /> {it.b.locationName}
                </span>
              ) : null}
            </div>
          ) : it.f.past ? (
            <div key={it.f.startIso} className="admin-kiosk-free is-past" aria-disabled="true">
              <span className="num">{it.f.label}</span>
              <span className="admin-kiosk-free-tag">Passerad</span>
            </div>
          ) : open?.startIso === it.f.startIso ? (
            /* Bekräftelse-panelen ersätter chipen på plats — tjänst + Boka. */
            <form key={it.f.startIso} action={formAction} className="admin-kiosk-confirm">
              <input type="hidden" name="staff" value={staffId} />
              <input type="hidden" name="start" value={it.f.startIso} />
              <input type="hidden" name="location" value={it.f.locationId ?? ''} />
              <input type="hidden" name="service" value={serviceId} />
              <span className="admin-kiosk-confirm-head">Drop-in {it.f.label}</span>
              <span className="admin-kiosk-svcrow" role="radiogroup" aria-label="Tjänst">
                {services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setServiceId(s.id)}
                    className={`admin-kiosk-svcchip${serviceId === s.id ? ' is-on' : ''}`}
                    aria-pressed={serviceId === s.id}
                  >
                    {s.name} · {s.durationMin} min
                  </button>
                ))}
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="admin-kiosk-book" disabled={pending || !serviceId}>
                  {pending ? 'Bokar…' : `Boka drop-in ${it.f.label}`}
                </button>
                <button
                  type="button"
                  className="admin-kiosk-cancelbtn"
                  onClick={() => setOpen(null)}
                  disabled={pending}
                >
                  Avbryt
                </button>
              </span>
            </form>
          ) : (
            <button
              key={it.f.startIso}
              type="button"
              className="admin-kiosk-free"
              onClick={() => setOpen(it.f)}
              aria-label={`Boka drop-in ${it.f.label} hos ${staffName}`}
            >
              <span className="num">{it.f.label}</span>
              <span className="admin-kiosk-free-tag">Ledigt</span>
            </button>
          ),
        )
      )}
    </div>
  )
}
