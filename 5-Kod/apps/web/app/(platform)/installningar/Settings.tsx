import { Card, Callout, Badge } from '@/components/portal/ui'
import styles from './installningar.module.css'

/**
 * Inställningar — plattformsövergripande (goal-17 PLATFORM).
 *
 * ÄRLIGHETSPASS (#8): the four misleading disabled toggles (MFA / IP-whitelist /
 * Auto-klar bokningar / Daglig sammanfattning) were REMOVED. They asserted a
 * platform posture with NO backing store and NO write-path — and two of them
 * (Auto-klar, daglig digest) are salon-level concerns, not platform ones. A dead
 * "Kommer snart" toggle is still a control that looks like a setting, so it's gone
 * rather than dimmed. The right superadmin-settings catalog is its own iteration
 * (parked in AUDIT-FIX-PLAN) — we build no brus here.
 *
 * What REMAINS is only what is genuinely true and live:
 *  • Audit-guard mot radering — the build-once-never-delete invariant is actually
 *    enforced (setTenantStatus soft-deletes, never .delete()). Shown as a labelled
 *    fact, not as a flippable control.
 *  • Fakturering-modell — "Manuell (flöde 2)" is the platform's real billing posture
 *    (FLÖDE 2: Corevo invoices each salong manually off the Fakturering view, no
 *    Stripe subscription, no MRR-automation). An architectural fact, stated directly.
 *
 * Server component: nothing is interactive, so there is no client state and no
 * mutation — hence no toast (consequence toasts belong on real mutations).
 */

/** A fact, not a control: there is no setting to change and therefore no fake toggle. */
function Invariant({ title, desc }: { title: string; desc: string }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowTitle}>{title}</div>
        <div className={styles.rowDesc}>{desc}</div>
      </div>
      <Badge tone="success" dot={false}>
        Skyddat i koden
      </Badge>
    </div>
  )
}

export function Settings() {
  return (
    <div className={styles.wrap}>
      {/* Honest band: this page only shows what is actually true + live. The broader
          superadmin-settings catalog is a separate iteration — no fake toggles here. */}
      <Callout tone="info" icon="info">
        Plattformsinställningarna nedan speglar hur plattformen faktiskt beter sig i
        dag — audit-guarden och faktureringsmodellen är sanna och live. Fler reglage
        (MFA, IP-whitelist m.m.) byggs i en egen iteration när de kopplas till ett
        riktigt sparat läge.
      </Callout>

      {/* ── Säkerhet (endast den live-enforced invarianten) ── */}
      <Card className={styles.cardGap}>
        <h2 className={`h2 ${styles.cardHead}`}>Säkerhet</h2>
        <Invariant
          title="Audit-guard mot radering"
          desc="Skyddade rader kan aldrig raderas, bara suspenderas. Skyddat i koden — build-once-never-delete."
        />
      </Card>

      {/* ── Fakturering (LIVE: the platform's real billing posture, flöde 2) ── */}
      <Card className={styles.cardGap}>
        <h2 className={`h2 ${styles.cardHeadGap}`}>Fakturering</h2>
        <div className={styles.billRow}>
          <div>
            <div className={styles.billTitle}>Modell: manuell (flöde 2)</div>
            <div className={styles.billDesc}>
              Underlag från genomförda bokningar. Ingen Stripe-prenumeration, ingen
              MRR-automation.
            </div>
          </div>
          <Badge tone="gold" dot={false}>
            Aktiv
          </Badge>
        </div>
      </Card>
    </div>
  )
}
