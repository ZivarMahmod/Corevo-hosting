import Link from 'next/link'
import { Icon } from '@/components/portal/ui'
import styles from './account.module.css'

export type NameMode = 'full' | 'first' | 'initial'

/**
 * INTEGRITET panel (§4.8). Shows the customer how their name is presented to the
 * salon + their contact details + the data-retention promise.
 *
 * ⚠️ PERSISTENCE FLAG (honest, no dead controls):
 *  · NAME-DISPLAY picker — the customers table HAS the backing columns
 *    (display_name / name_hidden) and customers_rls (0011 §6.1) WOULD permit a
 *    kund to self-write their own row. BUT the only server action that writes
 *    them (`setCustomerPrivacy`, lib/admin/actions.ts) is owner-scoped (adminCtx),
 *    and lib/* is FROZEN this wave (consume-only) — so there is NO customer-
 *    callable save path. We therefore render the picker as a STATIC reflection of
 *    the REAL stored choice (read from the customer's own row), clearly marked as
 *    salon-managed, instead of a live-looking toggle that silently saves nothing.
 *  · CONSENT toggle ("Spara mina uppgifter för nästa gång") — there is no consent
 *    column on customers and no action, so it is rendered as a written statement
 *    of the actual retention behaviour, not an interactive toggle. The real,
 *    wired self-service privacy controls (export + erase) live on /konto/profil
 *    (GdprControls) and are linked from here.
 *  · TELEFON / E-POST — phone HAS a real path (updateProfile on /konto/profil), so
 *    we link there rather than render an input that can't save.
 *
 * The derived display string ("Visas i salongens system som …") mirrors
 * get_customer_contact's rule: initial → "S.", first → first name, full → full.
 */
function deriveShown(mode: NameMode, fullName: string | null, displayName: string | null): string {
  const fn = (fullName ?? '').trim()
  if (mode === 'initial') {
    const parts = fn.split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '—'
    return parts.map((p) => `${p.charAt(0).toUpperCase()}.`).join(' ')
  }
  if (mode === 'first') {
    if (displayName?.trim()) return displayName.trim()
    return fn.split(/\s+/)[0] || '—'
  }
  return fn || '—'
}

const SEG: { value: NameMode; label: string }[] = [
  { value: 'full', label: 'Fullt namn' },
  { value: 'first', label: 'Bara förnamn' },
  { value: 'initial', label: 'Initialer' },
]

export function AccountPrivacy({
  fullName,
  email,
  phone,
  nameMode,
  displayName,
}: {
  fullName: string | null
  email: string | null
  phone: string | null
  /** Current stored choice, derived from the customer's own row (full when none). */
  nameMode: NameMode
  displayName: string | null
}) {
  const shown = deriveShown(nameMode, fullName, displayName)

  return (
    <section className={styles.privacy}>
      <div className={styles.privacyHead}>
        <Icon name="shield" size={18} style={{ color: 'var(--color-primary)' }} />
        <h2 className={styles.privacyTitle}>Integritet</h2>
      </div>
      <p className={styles.privacyLede}>
        Du bestämmer hur du syns för verksamheten. Ditt lojalitetsband finns kvar oavsett — det bygger på
        dig, inte på dina kontaktuppgifter.
      </p>

      <div className={styles.fieldLabel}>Så här ser personalen mitt namn</div>
      <div className={styles.seg} role="group" aria-label="Visningsnamn (hanteras av verksamheten)">
        {SEG.map((o) => {
          const active = o.value === nameMode
          return (
            <span
              key={o.value}
              className={`${styles.segBtn}${active ? ` ${styles.segBtnActive}` : ''}`}
              aria-current={active ? 'true' : undefined}
            >
              {o.label}
            </span>
          )
        })}
      </div>
      <p className={styles.segHint}>
        Visas i verksamhetens system som <b>{shown}</b>
      </p>

      {/* Honest FLAG (per-path, no non-existent paths): name-DISPLAY mode has no
          customer-callable save action in the consume-only lib — only the salon
          can change it. */}
      <p className={styles.flag}>
        Hur ditt namn visas hanteras av verksamheten — hör av dig om du vill ändra det. Ditt namn och
        telefonnummer kan du själv uppdatera under{' '}
        <Link href="/konto/profil" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
          Min profil
        </Link>
        . E-postadressen kan inte ändras.
      </p>

      {/* Contact fields — READ-ONLY reflection of stored values. The editable path
          (name + phone) is updateProfile on /konto/profil; e-post is fixed. */}
      <div className={styles.contactGrid}>
        <div>
          <div className={styles.contactLabel}>Telefon</div>
          <div className={styles.contactValue}>{phone?.trim() || '—'}</div>
        </div>
        <div>
          <div className={styles.contactLabel}>E-post</div>
          <div className={styles.contactValue}>{email?.trim() || '—'}</div>
        </div>
      </div>

      {/* Consent row — STATIC, FLAGGED indicator. There is no consent column on
          customers and no customer-callable action, so this is NOT an interactive
          toggle (that would be a dead/fake-saving control). It reflects the real
          retention behaviour: while your account exists, your contact details are
          kept so you don't re-enter them. The genuine self-service controls
          (export + permanently erase) are wired on /konto/profil. */}
      <div className={styles.consent}>
        <div className={styles.consentText}>
          <div className={styles.consentLabel}>Spara mina uppgifter för nästa gång</div>
          <div className={styles.consentSub}>
            Dina uppgifter sparas så länge du har ett konto. Vill du bli glömd kan du exportera eller
            radera allt under{' '}
            <Link href="/konto/profil" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
              Min profil
            </Link>
            .
          </div>
        </div>
        <button
          type="button"
          className={styles.toggleStatic}
          aria-disabled="true"
          aria-label="Uppgifter sparas medan kontot finns (hanteras via Min profil)"
          title="Hanteras via Min profil"
          tabIndex={-1}
        >
          <span aria-hidden />
        </button>
      </div>
    </section>
  )
}
