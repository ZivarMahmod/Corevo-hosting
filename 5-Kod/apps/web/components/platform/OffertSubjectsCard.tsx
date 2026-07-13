'use client'

import { useActionState } from 'react'
import { saveOffertSubjects, type ActionState } from '@/lib/platform/actions'
import { Icon } from '@/components/portal/ui'
import styles from './platform.module.css'

/**
 * OFFERTENS FÖRFRÅGNINGSTYPER (goal-64) — kundkortets Offert-flik.
 *
 * Mallarna ritar chips före fritexten (Aurora: Bröllop/Företag/Event & fest/Begravning;
 * Källa: Bröllopsmorgon/Möhippa/…). Storefronten kunde redan RENDERA dem — den läser
 * `tenant_modules.config.subjects` — men ingen yta kunde SKRIVA listan. Det här är den
 * saknade halvan: kunden äger sina egna typer.
 *
 * En rad = en typ. Tom ruta = inga chips (formuläret faller tillbaka på fritext) — vi
 * hittar ALDRIG på typer åt en kund.
 */
export function OffertSubjectsCard({
  tenantId,
  subjects,
}: {
  tenantId: string
  subjects: string[]
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(saveOffertSubjects, {})

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>
        <Icon name="mail" /> Förfrågningstyper
      </h2>
      <p className={styles.muted}>
        En rad per typ (max 8). Visas som valbara chips överst i offertformuläret, före
        fritexten. Lämna tomt för att bara visa fritext.
      </p>

      <form action={formAction}>
        <input type="hidden" name="tenantId" value={tenantId} />
        <textarea
          name="subjects"
          rows={6}
          defaultValue={subjects.join('\n')}
          placeholder={'Bröllop\nFöretag\nEvent & fest\nBegravning'}
          className={styles.field}
          aria-label="Förfrågningstyper, en per rad"
        />
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? 'Sparar…' : 'Spara typer'}
        </button>
        {state.error ? (
          <p role="alert" className={styles.errorMsg}>
            {state.error}
          </p>
        ) : null}
        {state.success ? <p role="status">{state.success}</p> : null}
      </form>
    </section>
  )
}
