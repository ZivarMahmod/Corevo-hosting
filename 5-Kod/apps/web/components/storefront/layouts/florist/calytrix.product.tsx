// CALYTRIX — PRODUKTSIDAN (goal-64). Mallen äger formen; modulen äger funktionen.
//
// .dc.html har ingen egen produktsida (allt köps direkt ur rutnätet). Sidan är därför
// byggd i filens EGNA grammatik, lyft ur `showButik` + `showVarukorg`: 4:5-fotot i en
// vit kantad platta till vänster, faktaspalten till höger med 56px serif-namn, priset i
// plommon, leveranslöftet som rader över hårlinjer och köp-knappen som filens inramade
// versalknapp. Inga rundade hörn, ingen skugga, inget nytt formspråk.
//
// FUNKTIONEN är orörd och delad (vektor-regeln): samma loadShopProduct-data via props,
// samma <AddToCart> (variantval + antal + kvitto-toast), samma priser via formatShopPrice.
// TEXTREGEL: leveranslöftet kommer ENBART ur fulfilmentPromise(config) +
// SHOP_FULFILMENT_LABELS — vi hittar ALDRIG på egna löften om leverans eller lager.
//
// SYNKRON komponent (ingen async, ingen 'use client') — AddToCart är klientkomponenten,
// och den gränsen ligger där den redan låg.

import Link from 'next/link'
import { AddToCart } from '@/components/storefront/shop/AddToCart'
import {
  formatShopPrice,
  fulfilmentPromise,
  SHOP_FULFILMENT_LABELS,
} from '@/lib/storefront/shop/types'
import type { ThemeProductViewProps } from './types'
import s from './calytrix-product.module.css'

export function CalytrixProduct({ config, product, paused }: ThemeProductViewProps) {
  const paragraphs = (product.description ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  const label = SHOP_FULFILMENT_LABELS[config.fulfilment]
  const promise = fulfilmentPromise(config)

  return (
    <section className={s.cxProduct} data-module="shop" data-fulfilment={config.fulfilment}>
      <p className={s.cxBack}>
        <Link href="/shop">← Hela butiken</Link>
      </p>

      <div className={s.cxSplit}>
        <div className={s.cxPhotoWrap}>
          <span
            className={s.cxPhoto}
            role="img"
            aria-label={product.imageAlt ?? product.name}
            style={product.imageUrl ? { backgroundImage: `url(${product.imageUrl})` } : undefined}
          />
        </div>

        <div className={s.cxInfo}>
          <p className={s.cxEyebrow}>{label}</p>
          <h1 className={s.cxTitle}>{product.name}</h1>
          <p className={s.cxPrice}>{formatShopPrice(product.priceCents, product.currency)}</p>

          {paragraphs.length > 0 ? (
            <div className={s.cxDesc}>
              {paragraphs.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </div>
          ) : null}

          {/* Leveranslöftet: filens fakta-rader över hårlinjer. Bara configens sanning. */}
          <dl className={s.cxFacts}>
            <div className={s.cxFactRow}>
              <dt>Leverans</dt>
              <dd>{label}</dd>
            </div>
            <div className={s.cxFactRow}>
              <dt>Så går det till</dt>
              <dd>{promise}</dd>
            </div>
          </dl>

          {paused ? (
            <p role="status" className={s.cxPaused}>
              Butiken är tillfälligt stängd för nya beställningar. Vi öppnar igen snart.
            </p>
          ) : (
            <div className={s.cxBuy}>
              <AddToCart product={product} fulfilment={config.fulfilment} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
