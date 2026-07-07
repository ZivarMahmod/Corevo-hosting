'use client'

import { type CSSProperties, type ReactNode, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Badge,
  Button,
  Card,
  Icon,
  PageHead,
  Table,
  ViewSwitcher,
  usePersistentView,
  useToast,
  type BadgeTone,
} from '@/components/portal/ui'
import { setTenantStatus } from '@/lib/platform/actions'
import type { TenantDisplayStatus } from '@/lib/platform/tenants'
import styles from './salonger.module.css'

/**
 * Salonger — kort/lista-vyn (law: acceptans/components/SuperAdmin.jsx → SuperSalons).
 * Exact copy of the mock's composition (card grid + filter pills + Kort/Lista +
 * Exportera) rebuilt on the real back-office primitives, fed by REAL cross-tenant
 * data (listTenantsWithStats). The one addition the mock lacks is the discreet
 * per-card delete (Zivar-requested): a kebab → two-step confirm → soft-delete
 * (setTenantStatus 'deleted'). Hard row-deletion stays blocked (build-once-never-
 * delete); soft-delete only flips tenants.status — data + history are kept.
 */

export type SalongCardVM = {
  id: string
  slug: string
  name: string
  markColor: string
  owner: string | null
  themeLabel: string | null
  variantLabel: string
  level: 1 | 2 | 3
  bookings: number
  completed: number
  staff: number
  displayStatus: TenantDisplayStatus
  lastLabel: string
  storefrontUrl: string
}

const STATUS_META: Record<TenantDisplayStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Aktiv', tone: 'success' },
  suspended: { label: 'Pausad', tone: 'warning' },
  onboarding: { label: 'Onboarding', tone: 'info' },
}

type FilterKey = 'all' | TenantDisplayStatus
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Alla' },
  { key: 'active', label: 'Aktiv' },
  { key: 'suspended', label: 'Pausad' },
  { key: 'onboarding', label: 'Onboarding' },
]

const CHIP: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  color: 'var(--c-ink-2)',
  background: 'var(--c-paper-2)',
  borderRadius: 999,
  padding: '4px 10px',
  fontFamily: 'var(--font-ui)',
}

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function SalongerClient({ tenants }: { tenants: SalongCardVM[] }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [view, setView] = usePersistentView<'kort' | 'lista'>('salonger:view', ['kort', 'lista'], 'kort')

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return tenants.filter((t) => {
      if (filter !== 'all' && t.displayStatus !== filter) return false
      if (!term) return true
      return (
        t.name.toLowerCase().includes(term) ||
        t.slug.toLowerCase().includes(term) ||
        (t.owner ?? '').toLowerCase().includes(term)
      )
    })
  }, [tenants, q, filter])

  function exportCsv() {
    const header = ['Namn', 'Subdomän', 'Ägare', 'Status', 'Bokningar', 'Completade', 'Personal', 'Tema', 'Variant', 'Nivå']
    const rows = list.map((t) => [
      t.name,
      `${t.slug}.corevo.se`,
      t.owner ?? '',
      STATUS_META[t.displayStatus].label,
      String(t.bookings),
      String(t.completed),
      String(t.staff),
      t.themeLabel ?? '',
      t.variantLabel,
      `Nivå ${t.level}`,
    ])
    const csv = [header, ...rows].map((r) => r.map((c) => csvEscape(String(c))).join(',')).join('\r\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'salonger.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="portal-section">
      <PageHead
        eyebrow="Plattform"
        title="Kunder"
        lede="Dina kunder. Onboarda en ny — vilken bransch som helst — och följ hela bygget i en live preview tills sidan är deployad."
      >
        <Button variant="ghost" icon="upload" onClick={exportCsv}>
          Exportera
        </Button>
        <Button variant="primary" icon="plus" href="/salonger/ny">
          Onboarda ny kund
        </Button>
      </PageHead>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 18,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <span
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--c-ink-3)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Sök kund, ägare, subdomän…"
            autoCapitalize="none"
            aria-label="Sök kund"
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              borderRadius: 10,
              border: '1px solid var(--c-line)',
              background: 'var(--c-paper)',
              color: 'var(--c-ink)',
              fontFamily: 'var(--font-ui)',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        {FILTERS.map((f) => {
          const on = filter === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={on}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid var(--c-line)',
                cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                fontSize: 13.5,
                fontWeight: 600,
                background: on ? 'var(--c-forest)' : 'var(--c-paper)',
                color: on ? '#fff' : 'var(--c-ink-2)',
              }}
            >
              {f.label}
            </button>
          )
        })}
        <ViewSwitcher
          ariaLabel="Vy"
          value={view}
          onChange={setView}
          options={[
            { value: 'kort', label: 'Kort', icon: 'grid' },
            { value: 'lista', label: 'Lista', icon: 'menu' },
          ]}
        />
      </div>

      {list.length === 0 ? (
        <Card>
          <p style={{ fontWeight: 600, margin: '0 0 4px' }}>Inga kunder matchar</p>
          <p style={{ color: 'var(--c-ink-3)', fontSize: 13.5, margin: 0 }}>
            Prova en bredare sökning eller ett annat filter — eller onboarda en ny kund.
          </p>
        </Card>
      ) : view === 'lista' ? (
        <Card pad={0}>
          <Table
            cols={['Kund', 'Ägare', 'Variant', 'Personal', 'Bokningar', 'Status', '']}
            rows={list.map((t) => [
              <Link
                key="s"
                href={`/salonger/${t.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'inherit' }}
              >
                <span
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: t.markColor,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontFamily: 'var(--font-display)',
                    flex: 'none',
                  }}
                >
                  {t.name.charAt(0).toUpperCase()}
                </span>
                <span>
                  <b style={{ fontWeight: 600 }}>{t.name}</b>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--c-ink-3)' }}>
                    {t.slug}.corevo.se
                  </span>
                </span>
              </Link>,
              t.owner ?? '—',
              <span key="v" style={{ fontSize: 12.5, color: 'var(--c-ink-2)' }}>{t.variantLabel}</span>,
              <span key="p" className="num">{t.staff}</span>,
              <span key="b" className="num">{t.bookings}</span>,
              <Badge key="st" tone={STATUS_META[t.displayStatus].tone}>{STATUS_META[t.displayStatus].label}</Badge>,
              <Link key="a" href={`/salonger/${t.id}`} style={{ color: 'var(--c-ink-3)', display: 'inline-flex' }}>
                <Icon name="arrowRight" size={17} />
              </Link>,
            ])}
          />
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
            gap: 16,
          }}
        >
          {list.map((t) => (
            <SalongCard key={t.id} vm={t} />
          ))}
        </div>
      )}
    </section>
  )
}

function SalongCard({ vm }: { vm: SalongCardVM }) {
  const router = useRouter()
  const { notify } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()
  const status = STATUS_META[vm.displayStatus]

  function remove() {
    const fd = new FormData()
    fd.set('tenantId', vm.id)
    fd.set('status', 'deleted')
    startTransition(async () => {
      const res = await setTenantStatus({}, fd)
      if (res.error) notify(res.error, 'warning')
      else {
        notify(res.success ?? 'Kunden är borttagen.', 'success')
        setConfirming(false)
        router.refresh()
      }
    })
  }

  return (
    <div
      className={styles.card}
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/salonger/${vm.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') router.push(`/salonger/${vm.id}`)
      }}
      style={{
        position: 'relative',
        background: 'var(--c-paper)',
        border: '1px solid var(--c-line)',
        borderRadius: 16,
        padding: 22,
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
          <div
            aria-hidden="true"
            style={{
              width: 42,
              height: 42,
              borderRadius: 11,
              background: vm.markColor,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 18,
              flex: 'none',
            }}
          >
            {vm.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15,
                color: 'var(--c-ink)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {vm.name}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--c-ink-3)' }}>{vm.slug}.corevo.se</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 'none' }}>
          <Badge tone={status.tone}>{status.label}</Badge>
          <button
            type="button"
            className={styles.kebab}
            aria-label="Fler åtgärder"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((o) => !o)
            }}
          >
            <Icon name="moreH" size={17} />
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <div className={styles.menuScrim} onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
          <div className={styles.menu} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen(false)
                setConfirming(true)
              }}
            >
              <Icon name="trash" size={15} />
              Ta bort kund
            </button>
          </div>
        </>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
          marginTop: 16,
          paddingTop: 14,
          borderTop: '1px solid var(--c-line)',
        }}
      >
        <KV label="Bokningar" value={<span className="num">{vm.bookings}</span>} />
        <KV label="Personal" value={<span className="num">{vm.staff}</span>} />
        <KV label="Senast" value={<span style={{ fontSize: 12.5 }}>{vm.lastLabel}</span>} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 12, flexWrap: 'wrap' }}>
        {vm.themeLabel && <span style={CHIP}>{vm.themeLabel}</span>}
        <span style={CHIP}>{vm.variantLabel}</span>
        <span
          style={{
            ...CHIP,
            color: vm.level === 3 ? 'var(--c-gold-600)' : 'var(--c-ink-3)',
            background: vm.level === 3 ? 'var(--c-gold-100)' : 'var(--c-paper-2)',
          }}
        >
          Nivå {vm.level}
        </span>
      </div>

      {confirming ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
            padding: '10px 12px',
            background: 'var(--c-danger-bg)',
            borderRadius: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span style={{ fontSize: 12.5, color: 'var(--c-ink)', flex: 1 }}>
            Ta bort <b>{vm.name}</b>? Mjuk — data + historik sparas.
          </span>
          <button
            type="button"
            className="pbtn pbtn--ghost pbtn--sm"
            disabled={pending}
            onClick={(e) => {
              e.stopPropagation()
              setConfirming(false)
            }}
          >
            Avbryt
          </button>
          <button
            type="button"
            className="pbtn pbtn--sm"
            disabled={pending}
            style={{ background: 'var(--c-danger)', color: '#fff' }}
            onClick={(e) => {
              e.stopPropagation()
              remove()
            }}
          >
            {pending ? 'Tar bort…' : 'Bekräfta'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Button
            variant="ghost"
            size="sm"
            icon="arrowRight"
            href={`/salonger/${vm.id}`}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            Öppna
          </Button>
          <a
            href={vm.storefrontUrl}
            target="_blank"
            rel="noreferrer"
            className="pbtn pbtn--subtle pbtn--sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="external" size={15} />
            Storefront
          </a>
        </div>
      )}
    </div>
  )
}

function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: 'var(--c-ink-3)',
          fontWeight: 600,
          fontFamily: 'var(--font-ui)',
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 3, fontWeight: 600, color: 'var(--c-ink)' }}>{value}</div>
    </div>
  )
}
