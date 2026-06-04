import { Card, Callout, Badge, Icon } from '@/components/portal/ui'
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
 *    enforced (setTenantStatus soft-deletes, never .delete()). Shown ON + locked,
 *    framed "Skyddat i koden", not a flippable control.
 *  • Fakturering-modell — "Manuell (flöde 2)" is the platform's real billing posture
 *    (FLÖDE 2: Corevo invoices each salong manually off the Fakturering view, no
 *    Stripe subscription, no MRR-automation). An architectural fact, stated directly.
 *
 * Server component: nothing is interactive, so there is no client state and no
 * mutation — hence no toast (consequence toasts belong on real mutations).
 */

/** One read-only reglage row — the locked, enforced live invariant (the only kind
 *  this page shows now). EXACT copy of Shell.jsx → Toggle, minus the live click. */
function Reglage({ title, desc }: { title: string; desc: string }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <div className={styles.rowTitle}>
          {title}
          <span className={`${styles.pill} ${styles.pillOn}`}>Aktiv</span>
        </div>
        <div className={styles.rowDesc}>{desc}</div>
      </div>
      {/* On + locked: it's the live truth, just not a setting you can turn off. */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        aria-label={`${title}: aktiv, skyddat i koden`}
        className={`${styles.track} ${styles.trackOn} ${styles.trackLocked}`}
      >
        <span className={`${styles.thumb} ${styles.thumbOn}`} />
      </button>
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
        <Reglage
          title="Audit-guard mot radering"
          desc="Skyddade rader kan aldrig raderas, bara suspenderas. Skyddat i koden — build-once-never-delete."
        />
        <div className={styles.guardBand}>
          <Icon name="shield" size={15} />
          <span>
            Aktiv: skyddade rader kan aldrig raderas, bara suspenderas. Inget reglage
            kan stänga av den här regeln.
          </span>
        </div>
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
