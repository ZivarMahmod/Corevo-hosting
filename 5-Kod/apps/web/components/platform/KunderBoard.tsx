'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { Badge, Icon, useToast, type BadgeTone } from '@/components/portal/ui'
import { setTenantStatus } from '@/lib/platform/actions'
import type { TenantDisplayStatus } from '@/lib/platform/tenants'
import styles from './kunder-v2.module.css'

export type KundCardVM = {
  id: string
  slug: string
  name: string
  markColor: string
  owner: string | null
  themeLabel?: string | null
  variantLabel?: string
  level?: 1 | 2 | 3
  bookings: number
  completed: number
  staff: number
  displayStatus: TenantDisplayStatus
  lastLabel: string
  storefrontUrl: string
}

type FilterKey = 'all' | TenantDisplayStatus

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Alla' },
  { key: 'active', label: 'Aktiv' },
  { key: 'suspended', label: 'Pausad' },
  { key: 'onboarding', label: 'Onboarding' },
]

const STATUS_META: Record<TenantDisplayStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Aktiv', tone: 'success' },
  suspended: { label: 'Pausad', tone: 'warning' },
  onboarding: { label: 'Onboarding', tone: 'info' },
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function storefrontHost(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export function buildKunderCsv(rows: KundCardVM[]): string {
  const header = [
    'Namn',
    'Subdomän',
    'Ägare',
    'Status',
    'Bokningar',
    'Genomförda',
    'Personal',
    'Senast',
    'Tema',
    'Variant',
    'Nivå',
  ]
  const data = rows.map((tenant) => [
    tenant.name,
    storefrontHost(tenant.storefrontUrl),
    tenant.owner ?? '',
    STATUS_META[tenant.displayStatus].label,
    String(tenant.bookings),
    String(tenant.completed),
    String(tenant.staff),
    tenant.lastLabel,
    tenant.themeLabel ?? '',
    tenant.variantLabel ?? '',
    tenant.level ? `Nivå ${tenant.level}` : '',
  ])
  return [header, ...data]
    .map((row) => row.map((value) => csvEscape(String(value))).join(','))
    .join('\r\n')
}

export function KunderBoard({
  tenants,
  children,
}: {
  tenants: KundCardVM[]
  children: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { notify } = useToast()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [armedId, setArmedId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>())
  const menuItemRef = useRef<HTMLButtonElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const restoreConfirmFocus = useRef(false)
  const latestPathname = useRef(pathname)
  const deleteRequest = useRef(0)
  latestPathname.current = pathname
  const hasSelection = /^\/kunder\/(?:[^/]+)$/.test(pathname)
  const isCreating = pathname === '/kunder/ny'

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase()
    return tenants.filter((tenant) => {
      if (filter !== 'all' && tenant.displayStatus !== filter) return false
      if (!term) return true
      return (
        tenant.name.toLowerCase().includes(term) ||
        tenant.slug.toLowerCase().includes(term) ||
        (tenant.owner ?? '').toLowerCase().includes(term)
      )
    })
  }, [filter, query, tenants])

  function clearArmTimer() {
    if (armTimer.current) clearTimeout(armTimer.current)
    armTimer.current = null
  }

  function disarm(restoreFocus: boolean) {
    const previousId = armedId
    clearArmTimer()
    setArmedId(null)
    if (restoreFocus && previousId) {
      requestAnimationFrame(() => triggerRefs.current.get(previousId)?.focus())
    }
  }

  function arm(tenantId: string) {
    clearArmTimer()
    setMenuId(null)
    setArmedId(tenantId)
    armTimer.current = setTimeout(() => {
      setArmedId(null)
      armTimer.current = null
      triggerRefs.current.get(tenantId)?.focus()
    }, 10_000)
  }

  useEffect(() => () => clearArmTimer(), [])
  useEffect(() => {
    if (menuId) menuItemRef.current?.focus()
  }, [menuId])
  useEffect(() => {
    if (armedId) confirmButtonRef.current?.focus()
  }, [armedId])
  useEffect(() => {
    if (pending || !restoreConfirmFocus.current) return
    restoreConfirmFocus.current = false
    confirmButtonRef.current?.focus()
  }, [pending])
  useEffect(() => {
    clearArmTimer()
    setMenuId(null)
    setArmedId(null)
  }, [pathname])

  function exportCsv() {
    const blob = new Blob(['\ufeff' + buildKunderCsv(visible)], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'kunder.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function invalidateDeleteForNavigation(event: ReactMouseEvent<HTMLElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (!(event.target instanceof Element)) return
    const href = event.target.closest('a')?.getAttribute('href')
    if (!href?.startsWith('/kunder')) return
    const targetPathname = href.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || '/'
    const currentPathname = pathname.replace(/\/+$/, '') || '/'
    if (targetPathname !== currentPathname) deleteRequest.current += 1
  }

  function remove(tenant: KundCardVM) {
    clearArmTimer()
    const requestId = ++deleteRequest.current
    const requestPathname = pathname
    const form = new FormData()
    form.set('tenantId', tenant.id)
    form.set('status', 'deleted')
    startTransition(async () => {
      const belongsToCurrentView = () =>
        deleteRequest.current === requestId && latestPathname.current === requestPathname
      const retry = (message: string) => {
        notify(message, 'warning')
        if (!belongsToCurrentView()) return
        restoreConfirmFocus.current = true
        arm(tenant.id)
      }

      let result
      try {
        result = await setTenantStatus({}, form)
      } catch {
        retry('Kunde inte ta bort kunden. Försök igen.')
        return
      }
      if (result.error) {
        retry(result.error)
      } else {
        notify(result.success ?? 'Kunden är borttagen.', 'success')
        if (belongsToCurrentView()) setArmedId(null)
        if (belongsToCurrentView() && requestPathname === `/kunder/${tenant.id}`) {
          router.push('/kunder')
        }
        router.refresh()
      }
    })
  }

  return (
    <div
      className={`workbench ${styles.board}`}
      data-mobile-view={hasSelection ? 'card' : 'list'}
      data-create={isCreating || undefined}
      onClickCapture={invalidateDeleteForNavigation}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        if (armedId && !pending) disarm(true)
        else if (menuId) {
          const previousId = menuId
          setMenuId(null)
          requestAnimationFrame(() => triggerRefs.current.get(previousId)?.focus())
        }
      }}
    >
      <aside className={styles.list} aria-label="Kunder">
        <div className={styles.listHead}>
          <div className={styles.listTitleRow}>
            <div>
              <div className={styles.listTitle}>Kunder</div>
              <div className={styles.stat}>{tenants.length} kunder</div>
            </div>
            <Link href="/kunder/ny" className={styles.newBtn}>
              + Onboarda
            </Link>
          </div>

          <label className={styles.search}>
            <Icon name="search" size={15} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Sök kund, ägare, subdomän…"
              aria-label="Sök kund"
              autoCapitalize="none"
            />
          </label>

          <div className={styles.listTools}>
            <div className={styles.chips}>
              {FILTERS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={filter === item.key}
                  className={`${styles.chip} ${filter === item.key ? styles.chipOn : ''}`}
                  onClick={() => setFilter(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button type="button" className={styles.exportBtn} onClick={exportCsv}>
              <Icon name="upload" size={14} />
              CSV
            </button>
          </div>
        </div>

        <div className={styles.rows}>
          {visible.length === 0 ? (
            <div className={styles.empty}>Ingen kund matchar.</div>
          ) : (
            visible.map((tenant) => {
              const selected = pathname === `/kunder/${tenant.id}`
              const menuOpen = menuId === tenant.id
              const armed = armedId === tenant.id
              return (
                <div key={tenant.id} className={`${styles.row} ${selected ? styles.rowOn : ''}`}>
                  <Link
                    href={`/kunder/${tenant.id}`}
                    className={styles.rowLink}
                    aria-current={selected ? 'page' : undefined}
                  >
                    <span
                      className={styles.avatar}
                      style={{ background: tenant.markColor }}
                      aria-hidden="true"
                    >
                      {tenant.name.charAt(0).toUpperCase()}
                    </span>
                    <span className={styles.rowMain}>
                      <span className={styles.rowName}>
                        <b>{tenant.name}</b>
                        <Badge tone={STATUS_META[tenant.displayStatus].tone} dot={false}>
                          {STATUS_META[tenant.displayStatus].label}
                        </Badge>
                      </span>
                      <span className={styles.rowSub}>{tenant.slug}.corevo.se</span>
                      <span className={styles.rowOwner}>{tenant.owner ?? '—'}</span>
                    </span>
                    <span className={styles.rowMeta}>
                      <span className={styles.rowLast}>{tenant.lastLabel}</span>
                      <span className={styles.rowVisits}>{tenant.bookings} bokningar</span>
                    </span>
                  </Link>

                  <div className={styles.rowActions}>
                    <a
                      href={tenant.storefrontUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.iconButton}
                      aria-label={`Öppna storefront för ${tenant.name}`}
                    >
                      <Icon name="external" size={15} />
                    </a>
                    <button
                      ref={(node) => {
                        if (node) triggerRefs.current.set(tenant.id, node)
                        else triggerRefs.current.delete(tenant.id)
                      }}
                      type="button"
                      className={styles.iconButton}
                      aria-label={`Fler åtgärder för ${tenant.name}`}
                      aria-expanded={menuOpen}
                      aria-controls={menuOpen ? `tenant-actions-${tenant.id}` : undefined}
                      onClick={() => setMenuId(menuOpen ? null : tenant.id)}
                    >
                      <Icon name="moreH" size={16} />
                    </button>
                  </div>

                  {menuOpen ? (
                    <>
                      <button
                        type="button"
                        className={styles.menuScrim}
                        tabIndex={-1}
                        aria-label="Stäng åtgärdsmeny"
                        onClick={() => {
                          setMenuId(null)
                          requestAnimationFrame(() => triggerRefs.current.get(tenant.id)?.focus())
                        }}
                      />
                      <div
                        id={`tenant-actions-${tenant.id}`}
                        className={styles.menu}
                        onBlur={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget)) setMenuId(null)
                        }}
                      >
                        <button
                          ref={menuItemRef}
                          type="button"
                          onClick={() => arm(tenant.id)}
                        >
                          <Icon name="trash" size={14} />
                          Ta bort kund
                        </button>
                      </div>
                    </>
                  ) : null}

                  {armed ? (
                    <div
                      className={styles.confirm}
                      role="alertdialog"
                      aria-label="Bekräfta borttagning"
                      aria-describedby={`delete-description-${tenant.id}`}
                    >
                      <span id={`delete-description-${tenant.id}`}>
                        Ta bort <b>{tenant.name}</b>? Data och historik sparas.
                      </span>
                      <button type="button" disabled={pending} onClick={() => disarm(true)}>
                        Avbryt
                      </button>
                      <button
                        ref={confirmButtonRef}
                        type="button"
                        className={styles.confirmDanger}
                        disabled={pending}
                        onClick={() => remove(tenant)}
                      >
                        {pending ? 'Tar bort…' : 'Bekräfta borttagning'}
                      </button>
                    </div>
                  ) : null}
                </div>
              )
            })
          )}
        </div>
      </aside>
      {children}
    </div>
  )
}
