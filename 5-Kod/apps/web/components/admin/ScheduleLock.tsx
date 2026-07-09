'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { unlockScheduleWithBackup, restoreScheduleBackup } from '@/lib/admin/schedule-actions'
import { Button, Icon, useToast } from '@/components/portal/ui'

/**
 * Lås runt grundtiderna (Zivar: tiderna läggs en gång — sen ska de inte kunna
 * ändras av misstag). Varje sidbesök börjar LÅST: innehållet är synligt men
 * inert. "Lås upp" kräver ett uttryckligt Ja, och tar i samma steg en kopia av
 * alla tider (unlockScheduleWithBackup) så "Återställ" alltid kan ta ägaren
 * tillbaka till exakt läget innan upplåsningen.
 */
export function ScheduleLock({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { notify } = useToast()
  const [unlocked, setUnlocked] = useState(false)
  const [confirming, setConfirming] = useState<null | 'unlock' | 'restore'>(null)
  const [pending, start] = useTransition()

  const runUnlock = () =>
    start(async () => {
      const res = await unlockScheduleWithBackup()
      if (res.error) {
        notify(res.error, 'warning')
      } else {
        notify(res.success ?? 'Upplåst.', 'success')
        setUnlocked(true)
      }
      setConfirming(null)
    })

  const runRestore = () =>
    start(async () => {
      const res = await restoreScheduleBackup()
      if (res.error) {
        notify(res.error, 'warning')
      } else {
        notify(res.success ?? 'Återställt.', 'success')
        router.refresh()
      }
      setConfirming(null)
    })

  const bar: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    padding: '12px 16px',
    borderRadius: 12,
    border: `1px solid ${unlocked ? 'var(--c-gold-300, var(--c-line-strong))' : 'var(--c-line)'}`,
    background: unlocked ? 'var(--c-gold-100)' : 'var(--c-paper-2)',
    marginBottom: 16,
    fontFamily: 'var(--font-ui)',
  }

  return (
    <div>
      <div style={bar} role="group" aria-label="Schemalås">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: 'var(--c-ink-2)' }}>
          <Icon name="lock" size={16} style={{ color: unlocked ? 'var(--c-gold-600)' : 'var(--c-ink-3)', flex: 'none' }} />
          {unlocked ? (
            <span>
              <strong style={{ fontWeight: 650 }}>Upplåst</strong> — ändringar sparas direkt. En
              kopia togs när du låste upp, så du kan alltid återställa.
            </span>
          ) : (
            <span>
              <strong style={{ fontWeight: 650 }}>Tiderna är låsta</strong> så inget ändras av
              misstag. Lås upp för att justera.
            </span>
          )}
        </span>

        {confirming === null ? (
          <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {unlocked ? (
              <>
                <Button variant="ghost" size="sm" icon="undo" disabled={pending} onClick={() => setConfirming('restore')}>
                  Återställ till innan upplåsningen
                </Button>
                <Button variant="ghost" size="sm" icon="lock" disabled={pending} onClick={() => setUnlocked(false)}>
                  Lås igen
                </Button>
              </>
            ) : (
              <Button variant="primary" size="sm" icon="lock" disabled={pending} onClick={() => setConfirming('unlock')}>
                Lås upp
              </Button>
            )}
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-ink)' }}>
              {confirming === 'unlock'
                ? 'Är du säker? En kopia av tiderna sparas så du kan ångra.'
                : 'Detta tar tillbaka ALLA tider till som de var när du låste upp. Fortsätt?'}
            </span>
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={confirming === 'unlock' ? runUnlock : runRestore}
            >
              {pending ? 'Vänta…' : 'Ja'}
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(null)}>
              Nej
            </Button>
          </span>
        )}
      </div>

      {/* inert (React 19): blockerar klick, fokus OCH tab-navigering när låst. */}
      <div inert={!unlocked || undefined} style={{ opacity: unlocked ? 1 : 0.55, transition: 'opacity 0.15s' }}>
        {children}
      </div>
    </div>
  )
}
