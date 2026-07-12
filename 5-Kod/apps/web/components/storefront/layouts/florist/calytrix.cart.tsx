'use client'

// CALYTRIX ÄGER SIN VARUKORG (goal-62, Zivars lag: mallen äger ALLT som syns).
//
// Detta är INTE den delade CartPageContents i annan färg — det är calytrix EGEN yta:
// PACKBORDET. Calytrix identitet är "butiken som hjälte" (plommon & vinrött, mörk
// dramatik, varan lyfts på skuggor). Korgen iscensätter det: varorna ligger som en
// PLOCKLISTA på ett mörkt plommonbord, med en handskriven summering i marginalen —
// som floristens anteckning på ett ordersblock. Onyx, mina eller zigge får ALDRIG
// den här sidan; deras korgar byggs i deras egna filer.
//
// FUNKTIONEN är orörd och delad (vektor-regeln): useCart är samma hook, samma
// localStorage, samma setQty/removeLine, samma priser via formatShopPrice. Byter
// kunden mall imorgon följer korgens INNEHÅLL med — bara scenen byts.
import Link from 'next/link'
import { useCart } from '@/components/storefront/shop/CartProvider'
import { formatShopPrice } from '@/lib/storefront/shop/types'
import s from './calytrix-cart.module.css'

export function CalytrixCart() {
  const { lines, subtotalCents, setQty, removeLine } = useCart()
  const currency = lines[0]?.currency ?? 'SEK'

  if (lines.length === 0) {
    return (
      <div className={s.scene}>
        <div className={s.emptyBoard}>
          {/* Tomt packbord: snöret och saxen ligger framme, men inget att binda.
              Ritat inline (CSP: inga fjärr-assets) — anatomin ur uiverse-kortens
              ikon-först-tomlägen, uttrycket ur calytrix palett. */}
          <svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true" className={s.emptyIcon}>
            <circle cx="32" cy="30" r="17" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path d="M32 13v-7M32 47v7M15 30H8m48 0h-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M25 30c0-4 3-7 7-7s7 3 7 7-3 7-7 7-7-3-7-7Z" fill="currentColor" opacity="0.25" />
          </svg>
          <p className={s.emptyKicker}>Packbordet är tomt</p>
          <p className={s.emptyText}>Inget att binda ännu — buketterna väntar i butiken.</p>
          <Link href="/shop" className={s.emptyCta}>
            In i butiken
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={s.scene}>
      {/* ── Plocklistan: varje vara är en RAD PÅ BORDET, numrerad som på ett
             ordersblock. Bilden står lutad mot en plommonplatta (samma gest som
             butikens produktkort — varan lyfter). ── */}
      <ol className={s.board}>
        {lines.map((l, i) => (
          <li key={l.variantId} className={s.slip}>
            <span className={s.slipNo} aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>

            <Link href={`/shop/${l.productId}`} className={s.slipPhotoLink} aria-label={`${l.productName} — visa produkt`}>
              <span className={s.slipPhotoPlate}>
                {l.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imageUrl} alt="" className={s.slipPhoto} />
                ) : null}
              </span>
            </Link>

            <div className={s.slipBody}>
              <Link href={`/shop/${l.productId}`} className={s.slipName}>
                {l.productName}
              </Link>
              {l.variantName ? <span className={s.slipVariant}>{l.variantName}</span> : null}
              <span className={s.slipUnit}>{formatShopPrice(l.priceCents, l.currency)} / st</span>

              <div className={s.slipControls}>
                <div className={s.qty} role="group" aria-label={`Antal — ${l.productName}`}>
                  <button
                    type="button"
                    className={s.qtyBtn}
                    aria-label="Minska antal"
                    disabled={l.quantity <= 1}
                    onClick={() => setQty(l.variantId, l.quantity - 1)}
                  >
                    −
                  </button>
                  <span className={s.qtyVal} aria-live="polite">
                    {l.quantity}
                  </span>
                  <button
                    type="button"
                    className={s.qtyBtn}
                    aria-label="Öka antal"
                    disabled={l.maxQty != null && l.quantity >= l.maxQty}
                    onClick={() => setQty(l.variantId, l.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <button type="button" className={s.remove} onClick={() => removeLine(l.variantId)}>
                  Stryk
                </button>
              </div>
            </div>

            <span className={s.slipTotal}>{formatShopPrice(l.priceCents * l.quantity, l.currency)}</span>
          </li>
        ))}
      </ol>

      {/* ── Ordersblocket: summeringen som floristens marginalanteckning —
             vinröd regel, display-siffra, kassan som enda utväg. ── */}
      <aside className={s.note} aria-label="Summering">
        <p className={s.noteKicker}>Att binda</p>
        <dl className={s.noteRows}>
          <div className={s.noteRow}>
            <dt>
              {lines.reduce((a, l) => a + l.quantity, 0)}{' '}
              {lines.reduce((a, l) => a + l.quantity, 0) === 1 ? 'vara' : 'varor'}
            </dt>
            <dd>{formatShopPrice(subtotalCents, currency)}</dd>
          </div>
        </dl>
        <p className={s.noteFine}>Frakt och moms räknas i kassan.</p>
        <Link href="/kassa" className={s.noteCta}>
          Till kassan
        </Link>
        <Link href="/shop" className={s.noteBack}>
          ← Fortsätt handla
        </Link>
      </aside>
    </div>
  )
}
