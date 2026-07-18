import { AccountSecurity } from '@/components/admin/AccountSecurity'
import { Badge, Button, Callout, Card, PageHead } from '@/components/portal/ui'
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

export function SecuritySettings({
  email,
  lastSignInAt,
}: {
  email: string | null
  lastSignInAt: string | null
}) {
  return (
    <div className={styles.wrap}>
      <PageHead
        eyebrow="Inställningar"
        title="Konto & säkerhet"
        lede="Ditt lösenord, dina inloggningar och plattformens aktiva dataskydd."
      />
      <AccountSecurity email={email} lastSignInAt={lastSignInAt} />

      <Callout tone="info" icon="info">
        Plattformens audit-guard är aktiv och kan inte stängas av från gränssnittet.
        Fler reglage visas först när de har ett riktigt sparat läge.
      </Callout>

      <Card className={styles.cardGap}>
        <h2 className={`h2 ${styles.cardHead}`}>Säkerhet</h2>
        <Invariant
          title="Audit-guard mot radering"
          desc="Skyddade rader kan aldrig raderas, bara suspenderas. Skyddat i koden — build-once-never-delete."
        />
        <div className={styles.linkRow}>
          <div>
            <div className={styles.rowTitle}>Personal på plattformen</div>
            <div className={styles.rowDesc}>Hantera plattformens personal och åtkomst på den befintliga ägandeytan.</div>
          </div>
          <Button href="/personal-plattform" variant="subtle" size="sm">
            Öppna personal
          </Button>
        </div>
      </Card>
    </div>
  )
}

export function BillingSettings() {
  return (
    <div className={styles.wrap}>
      <PageHead
        eyebrow="Inställningar"
        title="Fakturering"
        lede="Plattformens nuvarande faktureringsmodell och vägen till det kanoniska underlaget."
      />
      <Card>
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
        <div className={styles.billingAction}>
          <Button href="/fakturering" icon="arrowRight">
            Öppna faktureringsunderlag
          </Button>
        </div>
      </Card>
    </div>
  )
}
