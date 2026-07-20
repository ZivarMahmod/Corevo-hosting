'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icon, Modal } from '@/components/portal/ui'
import { MOBILE_SEARCH_EVENT } from '@/components/portal/mobile-search-event'
import { searchBookings, type BookingHit } from '@/lib/admin/calendar-actions'
import { isAvbokad } from './BookingDrawer'
import styles from './calendar.module.css'

/** Sök i kalendern (goal-66).
 *
 *  Den gamla bokningslistan hade en sökruta. När listan ersattes av kalendern försvann
 *  den — och med den svaret på frisörens vanligaste fråga: "när kommer Anna?" Utan sök
 *  är enda vägen att bläddra vecka för vecka. Den här rutan tar tillbaka det.
 *
 *  En träff är en GENVÄG, inte en vy: klick → kalendern hoppar till den dagen och öppnar
 *  bokningen. Man landar där arbetet görs, inte i en sökresultatsida man måste lämna. */

export function CalendarSearch({
  tz,
  mobileSheet = false,
}: {
  tz: string
  mobileSheet?: boolean
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<BookingHit[] | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const box = useRef<HTMLDivElement>(null)

  // Debounce: en frisör skriver "anna" på en halv sekund. Utan fördröjning blir det
  // fyra sökningar; med 250 ms blir det en.
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setHits(null)
      return
    }
    const t = setTimeout(() => {
      startTransition(async () => setHits(await searchBookings(term)))
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  // Klick utanför stänger träfflistan — annars ligger den kvar över kalendern man
  // just försökte klicka i.
  useEffect(() => {
    if (!hits) return
    function onDown(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setHits(null)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [hits])

  function open(hit: BookingHit) {
    setHits(null)
    setQ('')
    setSheetOpen(false)
    router.push(`/admin/bokningar?vy=dag&datum=${hit.date}&open=${hit.id}`)
  }

  function closeSheet() {
    setSheetOpen(false)
    setHits(null)
    setQ('')
  }

  const searchField = (
    <div className={`${styles.search}${mobileSheet ? ` ${styles.searchSheet}` : ''}`} ref={box}>
      <div className={styles.searchControl}>
        <Icon name="search" size={15} />
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Sök kund…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setHits(null)
              setQ('')
            }
          }}
          aria-label="Sök efter en kunds bokningar"
        />
      </div>

      {mobileSheet && (
        <p className={styles.mobileSearchHint}>
          Skriv minst två tecken. Välj en träff för att gå direkt till bokningen.
        </p>
      )}

      {hits !== null && (
        <div className={styles.searchDrop} role="listbox" aria-label="Sökträffar">
          {pending && <p className={styles.searchNote}>Söker…</p>}

          {!pending && hits.length === 0 && (
            <p className={styles.searchNote}>
              Ingen bokning på ”{q.trim()}” — varken de senaste 30 dagarna eller framåt.
            </p>
          )}

          {hits.map((h) => (
            <button
              key={h.id}
              type="button"
              role="option"
              aria-selected="false"
              className={styles.searchHit}
              onClick={() => open(h)}
            >
              <span className={styles.searchHitName}>
                {h.customerName}
                {/* En avbokad träff döljs inte — den ÄR ofta svaret ("hen avbokade").
                    Men den måste märkas, annars läser man den som en aktiv tid. */}
                {isAvbokad(h.status) && <em className={styles.searchHitDim}>avbokad</em>}
              </span>
              <span className={styles.searchHitMeta}>
                {new Intl.DateTimeFormat('sv-SE', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: tz,
                }).format(new Date(h.startTs))}
                {' · '}
                {h.serviceName}
                {h.staffTitle ? ` · ${h.staffTitle}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // Mobil: triggern bor i BOTTENNAVEN bredvid FAB:en (Topnav, Zivar 2026-07-18) —
  // navens knapp skickar fönster-eventet, arket ägs och renderas här.
  useEffect(() => {
    if (!mobileSheet) return
    const open = () => setSheetOpen(true)
    window.addEventListener(MOBILE_SEARCH_EVENT, open)
    return () => window.removeEventListener(MOBILE_SEARCH_EVENT, open)
  }, [mobileSheet])

  if (!mobileSheet) return searchField

  return (
    <>
      {sheetOpen && (
        <Modal
          title="Sök i kalendern"
          sub="Kund eller bokning"
          onClose={closeSheet}
          ariaLabel="Sök i kalendern"
          anchor="top"
        >
          {searchField}
        </Modal>
      )}
    </>
  )
}
