'use client'

// CALYTRIX ÄGER SIN PRODUKTSIDA (goal-62, Zivars lag: mallen äger ALLT som syns).
//
// Detta är INTE den delade /shop/[id]-vyn i annan färg — det är calytrix EGEN yta:
// SKYLTFÖNSTRET. En enda vara, iscensatt med packbordets gest (se calytrix.cart.tsx,
// facit för tonen): fotot står som en STOR 4:5-bild på en lutad vinröd platta mot ett
// mörkt plommonbord, och all fakta bor i en ljus marginalspalt bredvid — som floristens
// anteckning intill varan. Onyx, mina eller zigge får ALDRIG den här sidan.
//
// FUNKTIONEN är orörd och delad (vektor-regeln): samma loadShopProduct-data via props,
// samma AddToCart (icke-compact: variantval + qty + kvitto-toast), samma priser via
// formatShopPrice. Byter kunden mall imorgon följer köp-rälsen med — bara scenen byts.
//
// ZIVARS ELEMENT (uiverse-komponentbibliotek.md) — ANATOMIN lånad, koden aldrig:
//   rad 8214  bildkort m. överlagrad hälsning → fotoscenen: lapp i bildens hörn som
//             lyfter med plattan vid hover/fokus (deras hörn-blob-rörelse, vårt uttryck)
//   rad 5170  .cir-checks (ifyllda rutor)     → leveranslöftet som checklista
//   rad 14857 cutout-kupongen                 → vård-kortet: skötselråd som urklippt lapp
//   rad 4972  .cir-tabs (Week/Month)          → flikarna Beskrivning / Skötsel / Leverans
//
// TEXTREGEL: leveranslöftet kommer ENBART ur fulfilmentPromise(config) +
// SHOP_FULFILMENT_LABELS — vi hittar ALDRIG på egna löften om leverans/lager.
// Vård-kortets skötselråd är mallens scen-copy (allmän blomstervård, inget affärslöfte).

import Link from 'next/link'
import { useId, useState, type KeyboardEvent } from 'react'
import { AddToCart } from '@/components/storefront/shop/AddToCart'
import {
  formatShopPrice,
  fulfilmentPromise,
  SHOP_FULFILMENT_LABELS,
  type ShopConfig,
  type ShopProduct,
} from '@/lib/storefront/shop/types'
import s from './calytrix-product.module.css'

export type CalytrixProductProps = {
  config: ShopConfig
  product: ShopProduct
  /** Modul-gaten är sidans jobb (page.tsx) — vi får bara veta OM butiken är pausad
   *  och ritar då en ärlig stängd-rad i stället för köp-kontrollerna. */
  paused: boolean
}

type TabId = 'beskrivning' | 'skotsel' | 'leverans'

export function CalytrixProduct({ config, product, paused }: CalytrixProductProps) {
  // Samma styckesdelning som den delade sidan — beskrivningen är data, inte scen.
  const paragraphs = (product.description ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  // Flikarna visar BARA verkligt innehåll: utan beskrivning finns ingen
  // Beskrivning-flik. Skötsel (mallens vård-kort) och Leverans (löftet ur configen)
  // har alltid innehåll.
  const tabs: { id: TabId; label: string }[] = [
    ...(paragraphs.length > 0 ? [{ id: 'beskrivning' as const, label: 'Beskrivning' }] : []),
    { id: 'skotsel' as const, label: 'Skötsel' },
    { id: 'leverans' as const, label: 'Leverans' },
  ]
  // (noUncheckedIndexedAccess: initialen härleds ur samma villkor som tabs-listan
  //  i stället för tabs[0] — TS kan inte se att listan aldrig är tom.)
  const [active, setActive] = useState<TabId>(paragraphs.length > 0 ? 'beskrivning' : 'skotsel')
  const baseId = useId()
  const tabId = (id: TabId) => `${baseId}-tab-${id}`
  const panelId = (id: TabId) => `${baseId}-panel-${id}`

  // Roving tabindex + piltangenter (WAI-ARIA tabs): vald flik är den enda i
  // tabb-ordningen; vänster/höger flyttar både val och fokus.
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const idx = tabs.findIndex((t) => t.id === active)
    const dir = e.key === 'ArrowRight' ? 1 : -1
    const next = tabs[(idx + dir + tabs.length) % tabs.length]
    if (!next) return
    setActive(next.id)
    document.getElementById(tabId(next.id))?.focus()
    e.preventDefault()
  }

  const fulfilLabel = SHOP_FULFILMENT_LABELS[config.fulfilment]
  const promise = fulfilmentPromise(config)

  // Ifylld ruta (rad 5170-anatomin): ritad inline (CSP: inga fjärr-assets),
  // bocken i currentColor så CSS äger färgen.
  const Check = (
    <span className={s.checkBox} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )

  return (
    <section className="section" data-module="shop" data-calytrix="product">
      <div className={s.scene}>
        <p className={s.back}>
          <Link href="/shop" className={s.backLink}>
            ← Hela butiken
          </Link>
        </p>

        {/* ── SKYLTFÖNSTRET: mörkt plommonbord till vänster (varan störst),
               floristens ljusa marginalanteckning till höger. ── */}
        <div className={s.window}>
          <div className={s.stage}>
            <p className={s.stageKicker}>— Ur sortimentet</p>
            <figure className={s.plateWrap}>
              {/* Plattan lutar som på packbordet — hover/fokus rätar den (varan lyfter).
                  Hälsningslappen (rad 8214-gesten) är ALLTID läsbar, aldrig hover-only. */}
              <div className={s.plate}>
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt={product.imageAlt ?? product.name} className={s.photo} />
                ) : (
                  <span className={s.photoEmpty} aria-hidden="true">
                    {/* Samma blomsymbol som packbordets tomläge — samma butik. */}
                    <svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <circle cx="32" cy="30" r="17" />
                      <path d="M32 13v-7M32 47v7M15 30H8m48 0h-7" strokeLinecap="round" />
                      <path d="M25 30c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7Z" fill="currentColor" opacity="0.25" stroke="none" />
                    </svg>
                  </span>
                )}
                {/* Hälsningen bär leveranssättet — riktig data (SHOP_FULFILMENT_LABELS),
                    aria-hidden eftersom samma uppgift läses i checklistan intill. */}
                <span className={s.greet} aria-hidden="true">
                  {fulfilLabel}
                </span>
              </div>
            </figure>
          </div>

          <div className={s.margin}>
            <p className={s.kicker}>— Ur butiken</p>
            <h1 className={s.title}>{product.name}</h1>
            <p className={s.price}>{formatShopPrice(product.priceCents, product.currency)}</p>

            {/* Leveranslöftet som ifylld checklista (rad 5170-anatomin). Texterna är
                ENBART configens sanning — aldrig påhittade löften. */}
            <ul className={s.checks}>
              <li className={s.checkRow}>
                {Check}
                <span>{fulfilLabel}</span>
              </li>
              <li className={s.checkRow}>
                {Check}
                <span>{promise}</span>
              </li>
            </ul>

            {paused ? (
              <p role="status" className={s.paused}>
                Webshoppen är tillfälligt stängd för nya beställningar. Vi öppnar igen snart.
              </p>
            ) : (
              <div className={s.buy}>
                <AddToCart product={product} fulfilment={config.fulfilment} />
              </div>
            )}
          </div>
        </div>

        {/* ── DOSSIERN: flikarna (rad 4972-anatomin — fyllt val, rak calytrix-form). ── */}
        <div className={s.dossier}>
          <div role="tablist" aria-label={`Mer om ${product.name}`} className={s.tabs} onKeyDown={onTabKey}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={tabId(t.id)}
                aria-selected={active === t.id}
                aria-controls={panelId(t.id)}
                tabIndex={active === t.id ? 0 : -1}
                className={s.tab}
                onClick={() => setActive(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {paragraphs.length > 0 ? (
            <div
              role="tabpanel"
              id={panelId('beskrivning')}
              aria-labelledby={tabId('beskrivning')}
              hidden={active !== 'beskrivning'}
              className={s.panel}
            >
              {paragraphs.map((text, i) => (
                <p key={i} className={s.body}>
                  {text}
                </p>
              ))}
            </div>
          ) : null}

          <div
            role="tabpanel"
            id={panelId('skotsel')}
            aria-labelledby={tabId('skotsel')}
            hidden={active !== 'skotsel'}
            className={s.panel}
          >
            {/* Vård-kortet (rad 14857-anatomin): skötselråden som en URKLIPPT lapp —
                saxklippt överkant, lätt lutning, som riven ur floristens block.
                Allmän blomstervård, inga affärslöften. */}
            <aside className={s.careCard} aria-label="Skötselråd">
              <p className={s.careKicker}>Vård-kort</p>
              <ul className={s.careList}>
                <li>Snitta stjälkarna snett och sätt blommorna direkt i ljummet vatten.</li>
                <li>Byt vattnet varannan dag och snitta om stjälkarna.</li>
                <li>Undvik direkt solljus, värmekällor och drag.</li>
              </ul>
            </aside>
          </div>

          <div
            role="tabpanel"
            id={panelId('leverans')}
            aria-labelledby={tabId('leverans')}
            hidden={active !== 'leverans'}
            className={s.panel}
          >
            <p className={s.deliverLabel}>{fulfilLabel}</p>
            <p className={s.body}>{promise}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
