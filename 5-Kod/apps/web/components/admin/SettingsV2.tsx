'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Icon } from '@/components/portal/ui'
import {
  SETTINGS_GROUPS,
  type SettingsCategory,
  type SettingsCategoryId,
} from '@/lib/admin/settings-map'
import styles from './settings-v2.module.css'

export type SettingsV2Status = {
  label: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
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
  const [selectedId, setSelectedId] = useState<SettingsCategoryId>(initialCategory)
  const [query, setQuery] = useState('')
  const [mobilePaneOpen, setMobilePaneOpen] = useState(false)
  const selected = categories.find((category) => category.id === selectedId) ?? categories[0]!
  const normalized = query.trim().toLocaleLowerCase('sv')
  const hits = useMemo(
    () =>
      normalized
        ? categories.filter((category) =>
            `${category.label} ${category.hint} ${category.keywords}`
              .toLocaleLowerCase('sv')
              .includes(normalized),
          )
        : [],
    [categories, normalized],
  )

  function choose(id: SettingsCategoryId) {
    setSelectedId(id)
    setQuery('')
    setMobilePaneOpen(true)
    const params = new URLSearchParams(searchParams.toString())
    params.set('kategori', id)
    router.push(`/admin/installningar?${params.toString()}`, { scroll: false })
  }

  useEffect(() => {
    const fromUrl = searchParams.get('kategori') as SettingsCategoryId | null
    if (fromUrl && categories.some((category) => category.id === fromUrl)) setSelectedId(fromUrl)
  }, [categories, searchParams])

  return (
    <section className={styles.root} aria-label="Inställningar" data-accept="settings-shell">
      <aside className={`${styles.nav} ${mobilePaneOpen ? styles.mobileHidden : ''}`} data-accept="settings-nav">
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
              hits.slice(0, 7).map((category) => (
                <button key={category.id} type="button" onClick={() => choose(category.id)}>
                  <strong>{category.label}</strong>
                  <span>{category.hint}</span>
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
                  const status = statuses[category.id]
                  const warns = status.tone === 'warning' || status.tone === 'danger'
                  return (
                    <button
                      key={category.id}
                      type="button"
                      className={selected.id === category.id ? styles.active : undefined}
                      onClick={() => choose(category.id)}
                    >
                      <span className={styles.iconBox}><Icon name={category.icon} size={14} /></span>
                      <span className={styles.navCopy}>
                        <strong>{category.label}</strong>
                        <span>{category.hint}</span>
                      </span>
                      {warns ? (
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

      <div className={`${styles.paneWrap} ${mobilePaneOpen ? styles.mobilePaneOpen : ''}`} data-accept="settings-pane">
        <div className={styles.pane}>
          <button
            type="button"
            className={styles.mobileBack}
            onClick={() => setMobilePaneOpen(false)}
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
