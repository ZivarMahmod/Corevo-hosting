'use client'

import { useEffect, useState } from 'react'
import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { eraseCustomer, type ActionState } from '@/lib/admin/actions'
import { Button, Callout } from '@/components/portal/ui'
import { useToast } from '@/components/portal/ui/Toast'

/**
 * FAROZON på kundkortet (plan 007): GDPR-radering (art. 17) — anonymiserar kortet,
 * rensar bokningsnoteringar och raderar favoriter i DENNA salong. Irreversibel.
 * Tvåstegs-arm — EXAKT samma gest som PresentkortAdmin/ServicesManager (aldrig
 * window.confirm). Servern kräver dessutom ägar-roll + explicit confirm-fält, så
 * UI:t kan aldrig vara enda spärren.
 */
export function CustomerDangerZone({ customerId }: { customerId: string }) {
  const { notify } = useToast()
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [state, formAction, pending] = useActionState<ActionState, FormData>(eraseCustomer, {})

  useEffect(() => {
    if (state.success) {
      notify(state.success, 'success')
      router.refresh()
    }
    if (state.error) {
      notify(state.error, 'warning')
      setArmed(false) // avvisad av server-vakten → backa ur armat läge
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error])

  return (
    <Callout tone="warning" icon="alert">
      <strong>Radera kunddata (GDPR)</strong>
      <p style={{ margin: '4px 0 10px' }}>
        Anonymiserar kundkortet, rensar bokningsnoteringar och tar bort favoriter i din
        verksamhet. Bokningshistoriken finns kvar utan personuppgifter. Kan inte ångras.
      </p>
      <form action={formAction} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <input type="hidden" name="customer_id" value={customerId} />
        {armed ? (
          <>
            {/* confirm-fältet följer bara med i det ARMADE formuläret — servern
                avvisar allt utan det (dubbel spärr, aldrig UI-only). */}
            <input type="hidden" name="confirm" value="radera" />
            <Button
              variant="ghost"
              type="submit"
              icon="trash"
              size="sm"
              disabled={pending}
              style={{ color: 'var(--c-danger)' }}
            >
              {pending ? '…' : 'Säker? Radera permanent'}
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={() => setArmed(false)}>
              Ångra
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            icon="trash"
            onClick={() => setArmed(true)}
            style={{ color: 'var(--c-danger)' }}
          >
            Radera kunddata…
          </Button>
        )}
      </form>
    </Callout>
  )
}
