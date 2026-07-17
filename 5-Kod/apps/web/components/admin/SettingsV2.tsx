'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/portal/ui'
import {
  SETTINGS_GROUPS,
  settingsSearchEntries,
  type SettingsCategory,
  type SettingsCategoryId,
} from '@/lib/admin/settings-map'
import styles from './settings-v2.module.css'

export type SettingsV2Status = {
  label: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
}

export function SettingsNavigation({
  categories,
  statuses,
  selectedId,
  onChoose,
  className,
}: {
  categories: SettingsCategory[]
  statuses?: Partial<Record<SettingsCategoryId, SettingsV2Status>>
  selectedId: SettingsCategoryId
  onChoose: (category: SettingsCategory) => void
  className?: string
}) {
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLocaleLowerCase('sv')
  const searchEntries = useMemo(() => settingsSearchEntries(categories), [categories])
  const hits = useMemo(
    () =>
      normalized
        ? searchEntries.filter((entry) =>
            `${entry.label} ${entry.hint} ${entry.keywords}`
              .toLocaleLowerCase('sv')
              .includes(normalized),
          )
        : [],
    [normalized, searchEntries],
  )

  function choose(category: SettingsCategory) {
    setQuery('')
    onChoose(category)
  }

  return (
    <aside className={`${styles.nav} ${className ?? ''}`} data-accept="settings-nav">
      <h1>Inställningar</h1>
      <label className={styles.search} data-accept="settings-search">
        <Icon name="search" size={15} />
        <span className={styles.srOnly}>Sök i inställningar</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Sök — öppettider, pris, behörighet…"
        />
      </label>

      {normalized ? (
        <div className={styles.hits} aria-live="polite">
          {hits.length ? (
            hits.slice(0, 7).map((hit) => (
              <button
                key={hit.id}
                type="button"
                onClick={() => choose({ ...hit.category, href: hit.href })}
              >
                <strong>{hit.label}</strong>
                <span>{hit.hint}</span>
              </button>
            ))
          ) : (
            <p>Inget hittat — testa ”pris”, ”frånvaro”, ”lösenord”…</p>
          )}
        </div>
      ) : (
        SETTINGS_GROUPS.map((group) => (
          <div key={group} className={styles.group}>
            <h2>{group}</h2>
            {categories
              .filter((category) => category.group === group)
              .map((category) => {
                const status = statuses?.[category.id]
                const warns = status?.tone === 'warning' || status?.tone === 'danger'
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={selectedId === category.id ? styles.active : undefined}
                    onClick={() => choose(category)}
                  >
                    <span className={styles.iconBox}><Icon name={category.icon} size={14} /></span>
                    <span className={styles.navCopy}>
                      <strong>{category.label}</strong>
                      <span>{category.hint}</span>
                    </span>
                    {warns && status ? (
                      <span
                        className={`${styles.warningDot} ${status.tone === 'danger' ? styles.dangerDot : ''}`}
                        title={status.label}
                      />
                    ) : null}
                  </button>
                )
              })}
          </div>
        ))
      )}
    </aside>
  )
}

export function SettingsV2({
  categories,
  statuses,
  initialCategory = 'roller',
  rolesContent,
}: {
  categories: SettingsCategory[]
  statuses: Record<SettingsCategoryId, SettingsV2Status>
  initialCategory?: SettingsCategoryId
  rolesContent?: React.ReactNode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const selectedFromUrl = categories.find(
    (category) => category.id === searchParams.get('kategori'),
  )?.id ?? null
  const selectedId = selectedFromUrl ?? initialCategory
  const mobilePaneOpen = selectedFromUrl !== null
  const selected = categories.find((category) => category.id === selectedId) ?? categories[0]!

  function choose(category: SettingsCategory) {
    if (category.id !== 'roller') {
      router.push(category.href)
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.set('kategori', category.id)
    router.push(`/admin/installningar?${params.toString()}`, { scroll: false })
  }

  function closeMobilePane() {
    router.replace('/admin/installningar', { scroll: false })
  }

  return (
    <section className={styles.root} aria-label="Inställningar" data-accept="settings-shell">
      <SettingsNavigation
        categories={categories}
        statuses={statuses}
        selectedId={selected.id}
        onChoose={choose}
        className={mobilePaneOpen ? styles.mobileHidden : undefined}
      />

      <div className={`${styles.paneWrap} ${mobilePaneOpen ? styles.mobilePaneOpen : ''}`} data-accept="settings-pane">
        <div className={styles.pane}>
          <button
            type="button"
            className={styles.mobileBack}
            onClick={closeMobilePane}
          >
            <Icon name="arrowLeft" size={15} /> Tillbaka till inställningar
          </button>

          <div className={styles.heading}>
            <div>
              <h2>{selected.label}</h2>
              <p>{selected.hint}</p>
            </div>
            <span className={`${styles.statusChip} ${styles[`tone_${statuses[selected.id].tone}`]}`}>
              {statuses[selected.id].label}
            </span>
          </div>

          {selected.id === 'bokningsregler' ? (
            <>
              <p className={styles.monoLabel}>ONLINEBOKNING</p>
              <div className={styles.modeGrid}>
                {[
                  ['På', 'Kunder bokar själva på din sida, dygnet runt.'],
                  ['Pausad', 'Sidan visas men nya bokningar är stängda.'],
                  ['Av', 'Bokningen syns inte på den publika sidan.'],
                ].map(([label, copy]) => {
                  const active = statuses.bokningsregler.label === label
                  return (
                    <Link key={label} href={selected.href} className={active ? styles.modeActive : styles.modeCard}>
                      <span className={styles.radio}>{active ? <span /> : null}</span>
                      <span><strong>{label}</strong><small>{copy}</small></span>
                    </Link>
                  )
                })}
              </div>
              <div className={styles.infoBox}>
                <span>ⓘ</span>
                <p>
                  Öppettiderna på din sida redigeras under <Link href="/admin/sida?flik=kontakt">Redigera sidan → Kontakt</Link>.
                  Vilka tider som går att boka styrs av <Link href="/admin/scheman">Scheman</Link>.
                </p>
              </div>
            </>
          ) : selected.id === 'roller' && rolesContent ? (
            rolesContent
          ) : (
            <>
              <p className={styles.monoLabel}>INSTÄLLNINGAR</p>
              <div className={styles.rows}>
                <Link href={selected.href}>
                  <span>
                    <strong>{selected.label}</strong>
                    <small>{selected.hint}. Ändra på ytans enda ägande sida.</small>
                  </span>
                  <span className={styles.rowAction}>Öppna <Icon name="chevronRight" size={14} /></span>
                </Link>
              </div>
              {selected.id === 'sekretess' ? (
                <div className={styles.dangerZone}>
                  <p className={styles.dangerLabel}>FAROZON</p>
                  <div><span><strong>Radera kunddata</strong><small>Anonymisering kräver extra bekräftelse.</small></span><Link href="/admin/kunder">Öppna…</Link></div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
