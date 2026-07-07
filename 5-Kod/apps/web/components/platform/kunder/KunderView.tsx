'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { sendPasswordReset, createPlatformCustomer } from '@/lib/platform/actions'
import type { CustomerListItem } from '@/lib/platform/people'
import {
  PageHead,
  Stat,
  Card,
  Badge,
  Button,
  Drawer,
  Icon,
  useToast,
  type BadgeTone,
} from '@/components/portal/ui'
import styles from './kunder.module.css'

type TenantOption = { id: string; name: string; slug: string; status: string }

/**
 * Cross-tenant Kunder island (law: SuperData.jsx → SuperCustomers). Search/filter
 * drives a GET navigation so the SERVER re-runs listCustomersAllTenants (the data
 * never round-trips through the client — search is a real cross-tenant query, not
 * a client filter on a partial set). Clicking a row opens the detail Drawer with
 * the operativa åtgärder; the password-reset action is REAL (wires to the existing
 * sendPasswordReset server action), the copy-e-post action is an honest client-side
 * helper. Every action fires a consequence toast (§6). The mock's "ny magic-link"
 * customer action is OMITTED — no honest server path resends a customer magic-link
 * (that flow is owner/M6-side), so we don't render a dead control.
 */
export function KunderView({
  customers,
  tenants,
  q,
  tenant,
  serviceRoleAvailable,
}: {
  customers: CustomerListItem[]
  tenants: TenantOption[]
  q: string
  tenant: string
  serviceRoleAvailable: boolean
}) {
  const router = useRouter()
  const { notify } = useToast()
  const [pending, startTransition] = useTransition()

  // Controlled search box mirrors the URL; submit (or salon change) navigates.
  const [query, setQuery] = useState(q)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  // Add-customer form state (goal-22). The view is cross-tenant, so a salong choice is
  // mandatory — prefilled with the active salong filter when one is set.
  const [addTenant, setAddTenant] = useState('')
  const [addName, setAddName] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const selected = useMemo(
    () => customers.find((c) => c.id === selectedId) ?? null,
    [customers, selectedId],
  )
  // slug → tenant id, so a customer row can resolve the tenantId the password-reset
  // action requires (the foundation read exposes only slug).
  const tenantIdBySlug = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of tenants) m.set(t.slug, t.id)
    return m
  }, [tenants])
  // Add-customer can only target an ACTIVE salon (the server rejects others), so the
  // form's salong-select offers only those — the search filter above still lists ALL
  // (you may legitimately filter customers by a suspended salon).
  const activeTenants = useMemo(() => tenants.filter((t) => t.status === 'active'), [tenants])

  function navigate(nextQ: string, nextTenant: string) {
    const params = new URLSearchParams()
    if (nextQ.trim()) params.set('q', nextQ.trim())
    if (nextTenant !== 'all') params.set('tenant', nextTenant)
    const qs = params.toString()
    startTransition(() => router.push(qs ? `/kunder?${qs}` : '/kunder'))
  }

  const isFiltered = q.trim() !== '' || tenant !== 'all'

  // Honest aggregates over the returned set (LIVE — never the mock's 3 087/412/9).
  // With a filter active these describe the slice; the label says so, so they never lie.
  const total = customers.length
  const accounts = customers.filter((c) => c.role === 'Kund').length
  const guests = customers.filter((c) => c.role === 'Gäst').length
  const salons = new Set(customers.map((c) => c.slug).filter(Boolean)).size
  const scope = isFiltered ? 'i urvalet' : 'totalt'

  return (
    <div>
      <PageHead
        eyebrow="Insyn"
        title="Slutkunder"
        lede="Sök vem som helst tvärs alla kunder. Allt du brukade klicka i rå Supabase — här, no-code."
      >
        <Button
          variant="ghost"
          icon="upload"
          disabled={customers.length === 0}
          onClick={() => exportCsv(customers)}
        >
          Exportera
        </Button>
        <Button variant="primary" icon="plus" onClick={openAdd}>
          Lägg till kund
        </Button>
      </PageHead>

      {/* .bo-stat-grid (global): 4 cards in a row, collapses to 2-col at 920px. */}
      <div className="bo-stat-grid">
        <Stat label={`Kunder ${scope}`} value={<span className="num">{total}</span>} icon="users" />
        <Stat
          label="Med konto"
          value={<span className="num">{accounts}</span>}
          icon="user"
          hint="lösenords-inloggning"
        />
        <Stat
          label="Gäster"
          value={<span className="num">{guests}</span>}
          icon="user"
          hint="stabil gäst-nyckel"
        />
        <Stat label="Salonger" value={<span className="num">{salons}</span>} icon="building" />
      </div>

      {/* Search + salong filter — a real cross-tenant query (server re-reads). */}
      <form
        className={styles.filters}
        onSubmit={(e) => {
          e.preventDefault()
          navigate(query, tenant)
        }}
      >
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <Icon name="search" size={16} />
          </span>
          <input
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök namn, e-post, salong…"
            autoCapitalize="none"
            aria-label="Sök kund"
          />
        </div>
        <select
          className={styles.select}
          value={tenant}
          onChange={(e) => navigate(query, e.target.value)}
          aria-label="Filtrera på salong"
        >
          <option value="all">Alla salonger</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {/* Submit trigger — the mock filters its in-memory array on each keypress;
            we run a REAL cross-tenant server query, so the search needs a submit
            (salong-byte navigates immediately via onChange above). */}
        <Button type="submit" variant="ghost" icon="search">
          Sök
        </Button>
      </form>

      {customers.length === 0 ? (
        <Card>
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>
              {isFiltered ? 'Inget matchar' : 'Inga kunder ännu'}
            </p>
            <p className={styles.emptyText}>
              {isFiltered
                ? 'Prova en bredare sökning eller välj en annan salong. Sökningen täcker namn, e-post och salong.'
                : 'När en salong tar emot sin första bokning dyker kunden upp här — tvärs alla salonger.'}
            </p>
            {isFiltered ? (
              <Button
                variant="subtle"
                icon="undo"
                onClick={() => {
                  setQuery('')
                  navigate('', 'all')
                }}
              >
                Rensa filter
              </Button>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card pad={0} style={{ opacity: pending ? 0.6 : 1, transition: 'opacity .15s ease' }}>
          {/* Hand-written .ptable (not the shared <Table>) so the WHOLE row is
              clickable → drawer, matching the mock's onRow + the Bokningar island
              precedent. role=button + Enter/Space keep it keyboard-operable. */}
          <div style={{ overflowX: 'auto' }}>
            <table className="ptable">
              <thead>
                <tr>
                  <th>Namn</th>
                  <th>Salong</th>
                  <th>Roll</th>
                  <th>Auth</th>
                  <th>Senast inloggad</th>
                  <th data-last="">Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Öppna ${c.name} · ${c.tenant}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedId(c.id)
                      }
                    }}
                  >
                    <td>
                      <span className={styles.nameWrap}>
                        <span className={styles.avatar} aria-hidden="true">
                          {initial(c.name)}
                        </span>
                        <span className={styles.nameCol}>
                          <b className={styles.name}>{c.name}</b>
                          <span className={styles.sub}>{c.email ?? '—'}</span>
                        </span>
                      </span>
                    </td>
                    <td>{c.tenant}</td>
                    <td>
                      <Badge tone={roleTone(c.role)} dot={false}>
                        {c.role}
                      </Badge>
                    </td>
                    <td>
                      <span className={styles.muted}>{c.auth}</span>
                    </td>
                    <td>
                      <span className={styles.muted}>{formatLastLogin(c.lastLogin)}</span>
                    </td>
                    <td data-last="">
                      <Badge tone={statusTone(c.status)} dot={false}>
                        {c.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Detail drawer (operativ data-kontroll) ── */}
      {selected && (
        <Drawer
          onClose={() => setSelectedId(null)}
          title={selected.name}
          sub={selected.tenant}
          accent={
            <Badge tone={roleTone(selected.role)} dot={false}>
              {selected.role}
            </Badge>
          }
          footer={
            <Button
              variant="primary"
              icon="mail"
              style={{ flex: 1, justifyContent: 'center' }}
              disabled={pending || !selected.email}
              onClick={() => resetPassword(selected)}
            >
              Skicka lösenordsreset
            </Button>
          }
        >
          <div className={styles.drawerBody}>
            <section>
              <div className="eyebrow" style={{ marginBottom: 10 }}>
                Konto
              </div>
              <div className={styles.kvGrid}>
                <KV label="E-post" value={selected.email ?? '—'} />
                <KV label="Telefon" value={selected.phone ?? '—'} mono />
                <KV label="Auth-metod" value={selected.auth} />
                <KV label="Besök" value={<span className="num">{selected.visits}</span>} />
                <KV label="Salong" value={selected.tenant} />
                <KV label="Senast inloggad" value={formatLastLogin(selected.lastLogin)} />
              </div>
            </section>

            <section className={styles.opsCard}>
              <div className={styles.opsHead}>
                <Icon name="shield" size={15} />
                <span>Operativa åtgärder</span>
                <span className={styles.chip}>auth.users</span>
              </div>
              {!serviceRoleAvailable && (
                <p className={styles.opsNote}>
                  Lösenordsreset kräver <code className={styles.code}>SUPABASE_SERVICE_ROLE_KEY</code>{' '}
                  (sätts av ops). Tills den är satt går reset inte att köra.
                </p>
              )}
              <div className={styles.opsBtns}>
                <Button
                  variant="subtle"
                  icon="mail"
                  style={{ justifyContent: 'flex-start' }}
                  disabled={pending || !selected.email || !serviceRoleAvailable}
                  onClick={() => resetPassword(selected)}
                >
                  Skicka lösenordsreset
                </Button>
                <Button
                  variant="subtle"
                  icon="link"
                  style={{ justifyContent: 'flex-start' }}
                  disabled={!selected.email}
                  onClick={() => copyEmail(selected.email)}
                >
                  Kopiera e-post
                </Button>
              </div>
            </section>

            <p className={styles.auditNote}>
              <Icon name="info" size={14} />
              <span>Varje åtgärd loggas i audit-loggen med dig som aktör.</span>
            </p>
          </div>
        </Drawer>
      )}

      {/* ── Add-customer drawer (goal-22): a REAL form that inserts a customers row on
            the chosen salong. The honest callout stays — most rows are still minted on
            first booking — but the manual path now creates a real, immediately visible
            row instead of a dead "Stäng"-stub. ── */}
      {adding && (
        <Drawer
          onClose={closeAdd}
          title="Lägg till kund"
          sub="Skapar en riktig kund-rad på vald salong."
          footer={
            <>
              <Button
                variant="ghost"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={closeAdd}
                disabled={pending}
              >
                Avbryt
              </Button>
              <Button
                variant="primary"
                icon="plus"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={pending || !addName.trim() || !addTenant}
                onClick={submitNewCustomer}
              >
                {pending ? 'Lägger till…' : 'Lägg till kund'}
              </Button>
            </>
          }
        >
          <div className={styles.drawerBody}>
            <div className={styles.calloutInfo}>
              <Icon name="info" size={16} />
              <span>
                En stabil kund-rad skapas oftast automatiskt när salongen tar emot kundens första
                bokning. Vill du lägga till en kund i förväg gör du det här — raden får eget kund-id
                men ingen inloggning (kopplas till ett konto först när kunden själv loggar in).
              </span>
            </div>

            <form
              className={styles.addForm}
              onSubmit={(e) => {
                e.preventDefault()
                submitNewCustomer()
              }}
            >
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Salong</span>
                <select
                  className={styles.fieldControl}
                  value={addTenant}
                  onChange={(e) => setAddTenant(e.target.value)}
                  aria-label="Välj salong"
                  disabled={pending}
                  required
                >
                  <option value="">Välj salong…</option>
                  {activeTenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>Namn</span>
                <input
                  className={styles.fieldControl}
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="t.ex. Anna Svensson"
                  disabled={pending}
                  required
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  E-post <span className={styles.fieldOpt}>(valfritt)</span>
                </span>
                <input
                  className={styles.fieldControl}
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  placeholder="anna@exempel.se"
                  autoCapitalize="none"
                  disabled={pending}
                />
              </label>

              <label className={styles.field}>
                <span className={styles.fieldLabel}>
                  Telefon <span className={styles.fieldOpt}>(valfritt)</span>
                </span>
                <input
                  className={styles.fieldControl}
                  type="tel"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="070-123 45 67"
                  disabled={pending}
                />
              </label>

              {addError && (
                <p className={styles.formError} role="alert">
                  {addError}
                </p>
              )}
              {/* keyboard submit works via the form; the visible action lives in the footer */}
              <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
            </form>

            <span className={styles.chip}>customers · {activeTenants.length} aktiva salonger</span>
          </div>
        </Drawer>
      )}
    </div>
  )

  // ── actions ───────────────────────────────────────────────────────────────────
  function resetPassword(c: CustomerListItem) {
    if (!c.email) {
      notify('Kunden saknar e-post — ingen reset att skicka.', 'warning')
      return
    }
    if (!serviceRoleAvailable) {
      notify('Lösenordsreset kräver SUPABASE_SERVICE_ROLE_KEY (sätts av ops).', 'warning')
      return
    }
    const tenantId = tenantIdBySlug.get(c.slug)
    if (!tenantId) {
      notify('Kunde inte koppla kunden till en salong.', 'warning')
      return
    }
    const fd = new FormData()
    fd.set('tenantId', tenantId)
    fd.set('email', c.email)
    startTransition(async () => {
      const res = await sendPasswordReset({}, fd)
      if (res.error) notify(res.error, 'warning')
      else notify(`Återställningslänk skapad för ${c.email}.`, 'success')
    })
  }

  async function copyEmail(email: string | null) {
    if (!email) return
    try {
      await navigator.clipboard.writeText(email)
      notify('E-post kopierad.', 'info')
    } catch {
      notify('Kunde inte kopiera — markera och kopiera manuellt.', 'warning')
    }
  }

  // ── add-customer (goal-22) ──────────────────────────────────────────────────────
  function openAdd() {
    // Prefill the salong with the active filter so the common "add to this salong" flow
    // is one field shorter — but only if that salon is active (the select lists active
    // salons only; prefilling a suspended one would set a value with no matching option).
    const prefill = activeTenants.some((t) => t.id === tenant) ? tenant : ''
    setAddTenant(prefill)
    setAddName('')
    setAddEmail('')
    setAddPhone('')
    setAddError(null)
    setAdding(true)
  }

  function closeAdd() {
    if (pending) return
    setAdding(false)
    setAddError(null)
  }

  function submitNewCustomer() {
    if (pending) return // guard the Enter-key path: the footer button is disabled while
    // pending, but the form's onSubmit (Enter) is not — without this, a double Enter mints
    // two identical rows (no contact_hash → no unique-index backstop → permanent dup).
    const name = addName.trim()
    if (!addTenant) {
      setAddError('Välj en salong.')
      return
    }
    if (!name) {
      setAddError('Ange kundens namn.')
      return
    }
    setAddError(null)
    const fd = new FormData()
    fd.set('tenantId', addTenant)
    fd.set('full_name', name)
    fd.set('email', addEmail.trim())
    fd.set('phone', addPhone.trim())
    startTransition(async () => {
      const res = await createPlatformCustomer({}, fd)
      if (res.error) {
        setAddError(res.error)
        notify(res.error, 'warning')
        return
      }
      notify(res.success ?? `Kund "${name}" tillagd.`, 'success')
      setAdding(false)
      router.refresh()
    })
  }

  // HONEST export: writes a CSV of EXACTLY the rows on screen (the current
  // cross-tenant query result) — no backend, no fabricated totals. Matches the
  // mock's "Exportera" affordance without inventing data it can't back.
  function exportCsv(rows: CustomerListItem[]) {
    if (rows.length === 0) return
    const header = ['Namn', 'E-post', 'Telefon', 'Salong', 'Roll', 'Auth', 'Senast inloggad', 'Status']
    const cell = (v: string | number | null) => {
      const s = v == null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [
      header.join(','),
      ...rows.map((c) =>
        [c.name, c.email, c.phone, c.tenant, c.role, c.auth, formatLastLogin(c.lastLogin), c.status]
          .map(cell)
          .join(','),
      ),
    ]
    // BOM so Excel reads UTF-8 (å/ä/ö) correctly.
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kunder-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    notify(`Exporterade ${rows.length} kund${rows.length === 1 ? '' : 'er'}.`, 'success')
  }
}

// ── small bits ──────────────────────────────────────────────────────────────────
function KV({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className={styles.kv}>
      <span className={styles.kvLabel}>{label}</span>
      <span className={mono ? styles.kvValueMono : styles.kvValue}>{value}</span>
    </div>
  )
}

function initial(name: string): string {
  const ch = name.trim()[0]
  return ch ? ch.toUpperCase() : '?'
}

function roleTone(role: string): BadgeTone {
  return role === 'Kund' ? 'info' : 'neutral'
}

function statusTone(status: string): BadgeTone {
  if (status === 'Aktiv') return 'success'
  if (status === 'Skyddat namn') return 'info'
  if (status === 'Anonymiserad') return 'neutral'
  return 'neutral'
}

/** ISO → "8 maj 2026" (Europe/Stockholm); honest "—" when never seen. */
function formatLastLogin(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Stockholm',
  }).format(d)
}
