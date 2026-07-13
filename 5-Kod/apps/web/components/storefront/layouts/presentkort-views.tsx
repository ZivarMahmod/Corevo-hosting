'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import { useCart } from '../shop/CartProvider'
import {
  formatGiftPrice,
  GIFT_DELIVERY_LABELS,
  type GiftDeliveryMode,
} from '@/lib/storefront/presentkort/types'
import type { ThemePresentkortViewProps } from './florist/types'
import styles from './presentkort-views.module.css'

type GiftState = {
  amount: number
  amountLabel: string
  amounts: number[]
  currency: string
  mode: GiftDeliveryMode
  modes: GiftDeliveryMode[]
  added: boolean
  pickAmount: (amount: number) => void
  pickMode: (mode: GiftDeliveryMode) => void
  add: () => void
}

function useGiftState({ config }: ThemePresentkortViewProps): GiftState | null {
  const { addLine } = useCart()
  const amounts = config.amountPresets
  const modes = config.deliveryModes
  const [amount, setAmount] = useState(amounts[0] ?? 0)
  const [mode, setMode] = useState<GiftDeliveryMode>(modes[0] ?? 'digital')
  const [added, setAdded] = useState(false)

  if (!amounts.includes(amount)) return null

  const amountLabel = formatGiftPrice(amount, config.currency)
  return {
    amount,
    amountLabel,
    amounts,
    currency: config.currency,
    mode,
    modes,
    added,
    pickAmount(next) {
      setAmount(next)
      setAdded(false)
    },
    pickMode(next) {
      setMode(next)
      setAdded(false)
    },
    add() {
      addLine(
        {
          variantId: `gift:${amount}:${mode}`,
          productId: 'giftcard',
          productName: `Presentkort ${amountLabel}`,
          variantName: GIFT_DELIVERY_LABELS[mode],
          priceCents: amount * 100,
          currency: config.currency,
          imageUrl: null,
          maxQty: null,
          kind: 'giftcard',
          giftAmount: amount,
          giftDeliveryMode: mode,
        },
        1,
      )
      setAdded(true)
    },
  }
}

const button = (extra?: string) => `${styles.button} ${extra ?? ''}`
const grid = `${styles.grid}`
const title = `${styles.title}`

function Empty({ paused }: { paused: boolean }) {
  return (
    <p role="status" className={styles.notice}>
      {paused ? 'Presentkort är pausade just nu.' : 'Det finns inga valbara belopp just nu.'}
    </p>
  )
}

function AmountButtons({
  gift,
  className,
  style,
  selected,
}: {
  gift: GiftState
  className?: string
  style: (on: boolean) => CSSProperties
  selected?: (on: boolean) => ReactNode
}) {
  return gift.amounts.map((amount) => {
    const on = amount === gift.amount
    return (
      <button
        key={amount}
        type="button"
        className={button(className)}
        style={style(on)}
        aria-pressed={on}
        onClick={() => gift.pickAmount(amount)}
      >
        {selected?.(on) ?? formatGiftPrice(amount, gift.currency)}
      </button>
    )
  })
}

function Aurora({ config, paused, tenantName }: ThemePresentkortViewProps) {
  const gift = useGiftState({ config, paused, tenantName })
  return (
    <section className={styles.section} data-gift-theme="aurora" style={{ maxWidth: 960, margin: '0 auto', padding: '72px 28px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <p style={{ margin: '0 0 10px', color: '#B85C48', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Presentkort</p>
        <h1 className={title} style={{ margin: '0 0 12px', fontFamily: "'Lora'", fontWeight: 500, fontSize: 48, color: '#3A2A24' }}>Ge bort blomsterglädje</h1>
        <p style={{ margin: '0 auto', maxWidth: 440, color: '#7A6257', fontSize: 16, lineHeight: 1.7 }}>Giltigt ett år, för allt i studion — buketter, kurser och bröllop.</p>
      </div>
      {gift ? <div className={grid} style={{ gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}>
        <div style={{ background: '#F3DED4', padding: 20 }}><div style={{ border: '1px solid #B85C48', padding: '48px 32px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 6px', fontFamily: "'Lora'", fontStyle: 'italic', fontSize: 34, color: '#8A3E2E' }}>{tenantName}</p>
          <p style={{ margin: '0 0 26px', fontSize: 11.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#7A6257' }}>presentkort</p>
          <p style={{ margin: 0, fontFamily: "'Lora'", fontWeight: 500, fontSize: 44, color: '#3A2A24' }}>{gift.amountLabel}</p>
          <p style={{ margin: '20px 0 0', fontFamily: "'Lora'", fontStyle: 'italic', fontSize: 14, color: '#B85C48' }}>gäller i tolv månader</p>
        </div></div>
        <div>{paused ? <Empty paused /> : <>
          <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: 13 }}>Välj belopp</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}><AmountButtons gift={gift} className={styles.aurora} style={(on) => ({ cursor: 'pointer', border: `1px solid ${on ? '#B85C48' : '#EAD8CD'}`, background: on ? '#B85C48' : '#fff', color: on ? '#fff' : '#3A2A24', padding: '13px 24px', fontWeight: 700, fontSize: 15 })} /></div>
          <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: 13 }}>Hur ska det levereras?</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>{gift.modes.map((mode) => { const on = gift.mode === mode; return <button key={mode} type="button" className={button(styles.aurora)} aria-pressed={on} onClick={() => gift.pickMode(mode)} style={{ cursor: 'pointer', border: `1px solid ${on ? '#B85C48' : '#EAD8CD'}`, background: on ? '#B85C48' : '#fff', color: on ? '#fff' : '#3A2A24', padding: '13px 24px', fontWeight: 700, fontSize: 14 }}>{GIFT_DELIVERY_LABELS[mode]}</button> })}</div>
          <button type="button" className={button(styles.auroraBuy)} onClick={gift.add} style={{ border: 'none', cursor: 'pointer', background: '#B85C48', color: '#fff', fontWeight: 700, fontSize: 15, padding: '16px 36px' }}>{gift.added ? 'I korgen ✓' : `Lägg i korgen — ${gift.amountLabel}`}</button>
        </>}</div>
      </div> : <Empty paused={paused} />}
    </section>
  )
}

function Blomstertorget({ config, paused, tenantName }: ThemePresentkortViewProps) {
  const gift = useGiftState({ config, paused, tenantName })
  const serial = `${config.codePrefix || '1962-'}${gift ? 1000 + (gift.amount % 997) : ''}`
  return <section className={styles.section} data-gift-theme="blomstertorget" style={{ maxWidth: 720, margin: '0 auto', padding: '36px 28px 0' }}>
    <h1 className={title} style={{ margin: '0 0 6px', fontFamily: "'Archivo'", fontWeight: 900, fontSize: 44, textTransform: 'uppercase' }}>Presentkort</h1>
    <p style={{ margin: '0 0 30px', fontStyle: 'italic', fontSize: 16, color: '#6E6A61' }}>Ett värdebevis, gott som kontanter vid ståndet. Gäller i tolv månader.</p>
    {gift ? <><div style={{ border: '3px solid #191714', padding: 8, marginBottom: 30 }}><div style={{ border: '1px solid #191714', padding: 36, textAlign: 'center' }}>
      <p style={{ margin: '0 0 4px', fontFamily: "'Archivo'", fontWeight: 900, fontSize: 26, textTransform: 'uppercase' }}>{tenantName}</p>
      <p style={{ margin: '0 0 24px', fontStyle: 'italic', fontSize: 14, color: '#6E6A61' }}>värdebevis · nr {serial}</p>
      <p style={{ margin: 0, fontFamily: "'Archivo'", fontWeight: 900, fontSize: 52, color: '#C1272D' }}>{gift.amountLabel}</p>
      <p style={{ margin: '22px 0 0', fontFamily: "'Archivo'", fontWeight: 600, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6E6A61' }}>Inlöses vid ståndet eller i tidningens kassa · giltigt i tolv månader</p>
    </div></div>{paused ? <Empty paused /> : <>
      <p style={{ margin: '0 0 12px', fontFamily: "'Archivo'", fontWeight: 800, fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Valör</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}><AmountButtons gift={gift} className={styles.torget} style={(on) => ({ cursor: 'pointer', whiteSpace: 'nowrap', border: '2px solid #191714', background: on ? '#191714' : 'transparent', color: on ? '#F5F1E8' : '#191714', fontFamily: "'Archivo'", fontWeight: 800, fontSize: 13, padding: '11px 22px' })} /></div>
      <button type="button" className={button(styles.torgetBuy)} onClick={gift.add} style={{ border: 'none', cursor: 'pointer', background: '#C1272D', color: '#F5F1E8', fontFamily: "'Archivo'", fontWeight: 800, fontSize: 12.5, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '14px 28px' }}>{gift.added ? 'I korgen ✓' : `Lägg i korg — ${gift.amountLabel}`}</button>
    </>}</> : <Empty paused={paused} />}
  </section>
}

function Calytrix({ config, paused, tenantName }: ThemePresentkortViewProps) {
  const gift = useGiftState({ config, paused, tenantName })
  return <section className={styles.section} data-gift-theme="calytrix" style={{ maxWidth: 1100, margin: '0 auto', padding: '56px 28px 40px' }}>
    <h1 className={title} style={{ margin: '0 0 6px', fontFamily: "'Instrument Serif'", fontWeight: 400, fontSize: 56, color: '#241019' }}>Presentkort</h1>
    <p style={{ margin: '0 0 44px', color: '#6e4f5c', fontSize: 16, maxWidth: 520, lineHeight: 1.6 }}>Digitalt presentkort som skickas direkt via mejl — gäller hela sortimentet i 12 månader.</p>
    {gift ? <div className={grid} style={{ gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}>
      <div style={{ background: '#4a0e2e', padding: '44px 40px', textAlign: 'center' }}><p style={{ margin: '0 0 4px', fontFamily: "'Instrument Serif'", fontSize: 30, color: '#fff' }}>{tenantName.toUpperCase()}</p><p style={{ margin: '0 0 30px', color: '#e8d9de', fontSize: 11.5, letterSpacing: '0.24em', textTransform: 'uppercase' }}>Digitalt presentkort</p><p style={{ margin: 0, fontFamily: "'Instrument Serif'", fontSize: 52, color: '#fff' }}>{gift.amountLabel}</p><p style={{ margin: '26px 0 0', color: 'rgba(255,255,255,0.6)', fontSize: 12.5, letterSpacing: '0.08em' }}>GILTIGT 12 MÅN · KOD SKICKAS VIA MEJL</p></div>
      <div>{paused ? <Empty paused /> : <><p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 12.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Välj belopp</p><div style={{ display: 'inline-flex', flexWrap: 'wrap', border: '1px solid #241019', background: '#fff', marginBottom: 22 }}><AmountButtons gift={gift} className={styles.calytrix} style={(on) => ({ border: 'none', cursor: 'pointer', fontSize: 14.5, fontWeight: 700, padding: '12px 20px', borderRight: '1px solid #e8d9de', color: on ? '#fff' : '#241019', background: on ? '#7d1f46' : '#fff' })} /></div>
        <div style={{ marginBottom: 26 }}><label htmlFor="calytrix-gift-email" style={{ display: 'block', fontWeight: 700, fontSize: 12.5, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>Mottagarens mejl</label><input id="calytrix-gift-email" type="email" placeholder="namn@mail.se" className={styles.input} style={{ width: '100%', boxSizing: 'border-box', border: '2px solid #241019', padding: '12px 14px', fontFamily: "'Instrument Sans'", fontSize: 14.5, background: '#fbf6f4' }} /></div>
        <button type="button" className={button(styles.calytrixBuy)} onClick={gift.add} style={{ cursor: 'pointer', border: '2px solid #241019', color: '#241019', background: 'transparent', fontWeight: 700, fontSize: 14, padding: '13px 30px', letterSpacing: '0.03em' }}>{gift.added ? 'I KORGEN ✓' : `LÄGG I KORG — ${gift.amountLabel}`}</button></>}</div>
    </div> : <Empty paused={paused} />}
  </section>
}

function Eloria({ config, paused, tenantName }: ThemePresentkortViewProps) {
  const gift = useGiftState({ config, paused, tenantName })
  return <section className={styles.section} data-gift-theme="eloria" style={{ maxWidth: 620, margin: '64px auto 0', padding: '0 28px', textAlign: 'center' }}>
    <p style={{ margin: '0 0 8px', color: '#7A5D1E', fontSize: 12, letterSpacing: '0.26em', textTransform: 'uppercase' }}>Presentkort</p><h1 className={title} style={{ margin: '0 0 20px', fontFamily: "'Cormorant Garamond'", fontWeight: 500, fontSize: 52, color: '#182A20' }}>En gåva med värdighet</h1><p style={{ margin: '0 auto 48px', maxWidth: 420, color: '#6B5548', fontSize: 15.5, lineHeight: 1.75 }}>Tryckt på bomullspapper, lackat med vårt sigill och skickat i kuvert — eller digitalt, om tiden är knapp.</p>
    {gift ? <><div style={{ background: '#182A20', padding: 12, marginBottom: 44 }}><div style={{ border: '1px solid #D9BE7B', padding: '52px 32px' }}><p style={{ margin: 0, fontFamily: "'Cormorant Garamond'", fontWeight: 500, fontSize: 26, letterSpacing: '0.3em', color: '#FBF3EE', textTransform: 'uppercase', paddingLeft: '0.3em' }}>{tenantName}</p><p style={{ margin: '8px 0 30px', fontFamily: "'Cormorant Garamond'", fontStyle: 'italic', fontSize: 15, color: '#D9BE7B' }}>presentkort</p><p style={{ margin: 0, fontFamily: "'Cormorant Garamond'", fontSize: 48, color: '#FBF3EE' }}>{gift.amountLabel}</p></div></div>
      {paused ? <Empty paused /> : <><div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', marginBottom: 40, borderTop: '1px solid #E8D9C9', borderBottom: '1px solid #E8D9C9' }}><AmountButtons gift={gift} style={(on) => ({ background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'Cormorant Garamond'", fontSize: on ? 24 : 19, fontStyle: on ? 'normal' : 'italic', color: on ? '#182A20' : '#B5A28F', padding: '16px 26px' })} /></div><button type="button" className={button(styles.eloriaBuy)} onClick={gift.add} style={{ border: 'none', cursor: 'pointer', background: '#182A20', color: '#FBF3EE', fontSize: 12, fontWeight: 600, letterSpacing: '0.26em', textTransform: 'uppercase', padding: '17px 44px' }}>{gift.added ? 'Tillagd ✓' : 'Lägg till beställning'}</button></>}</> : <Empty paused={paused} />}
  </section>
}

function Lunaria({ config, paused, tenantName }: ThemePresentkortViewProps) {
  const gift = useGiftState({ config, paused, tenantName })
  return <section className={styles.section} data-gift-theme="lunaria" style={{ maxWidth: 920, margin: '0 auto', padding: '52px 36px 0' }}><h1 className={title} style={{ margin: '0 0 40px', textAlign: 'center', fontFamily: "'Poiret One'", fontSize: 52, letterSpacing: '0.08em', color: '#ECE6D6' }}>Presentkort</h1>{gift ? <div className={grid} style={{ gridTemplateColumns: '1fr 1fr', gap: 44, alignItems: 'center' }}><div style={{ border: '1px solid #C6A664', padding: 12 }}><div style={{ border: '1px solid #345', background: '#17304C', padding: '44px 32px', textAlign: 'center' }}><p style={{ margin: '0 0 4px', fontFamily: "'Poiret One'", fontSize: 26, letterSpacing: '0.2em', color: '#C6A664' }}>{tenantName.toUpperCase()}</p><p style={{ margin: '0 0 34px', fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#7C8AA0' }}>Presentkort</p><p style={{ margin: 0, fontFamily: "'Poiret One'", fontSize: 48, letterSpacing: '0.04em', color: '#ECE6D6' }}>{gift.amountLabel}</p><p style={{ margin: '24px 0 0', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7C8AA0' }}>Giltigt 12 mån · sänds digitalt</p></div></div><div>{paused ? <Empty paused /> : <><p style={{ margin: '0 0 16px', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C6A664' }}>Välj valör</p><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}><AmountButtons gift={gift} className={styles.lunaria} style={(on) => ({ cursor: 'pointer', fontSize: 14, letterSpacing: '0.08em', color: on ? '#10233A' : '#C6A664', background: on ? '#C6A664' : 'transparent', border: '1px solid #C6A664', padding: '12px 22px' })} /></div><button type="button" className={button(styles.lunariaBuy)} onClick={gift.add} style={{ border: 'none', cursor: 'pointer', fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#10233A', background: '#C6A664', padding: '14px 28px' }}>{gift.added ? 'I korgen ✓' : `Lägg i korg — ${gift.amountLabel}`}</button></>}</div></div> : <Empty paused={paused} />}</section>
}

function Onyx({ config, paused, tenantName }: ThemePresentkortViewProps) {
  const gift = useGiftState({ config, paused, tenantName })
  return <section className={styles.section} data-gift-theme="onyx" style={{ padding: '72px 56px', maxWidth: 920 }}><p style={{ margin: '0 0 10px', fontFamily: "'IBM Plex Mono'", fontSize: 12, letterSpacing: '0.14em', color: '#C9973F' }}>GIFT CARD</p><h1 className={title} style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 52, letterSpacing: '-0.02em' }}>Presentkort</h1><p style={{ margin: '0 0 44px', color: '#9C968C', fontSize: 16, maxWidth: 480, lineHeight: 1.7 }}>Svart kort, guldtryck, valfritt belopp. För den som hellre väljer själv.</p>{gift ? <div className={grid} style={{ gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center' }}><div style={{ border: '1px solid #C9973F', background: '#1C1C1C', padding: '44px 36px' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 52 }}><p style={{ margin: 0, fontWeight: 700, fontSize: 18, letterSpacing: '0.12em' }}>{tenantName}<span style={{ color: '#C9973F' }}>.</span></p><p style={{ margin: 0, fontFamily: "'IBM Plex Mono'", fontSize: 10.5, letterSpacing: '0.12em', color: '#6B655B' }}>GIFT CARD</p></div><p style={{ margin: 0, fontFamily: "'IBM Plex Mono'", fontSize: 40, color: '#C9973F' }}>{gift.amountLabel}</p><p style={{ margin: '16px 0 0', fontFamily: "'IBM Plex Mono'", fontSize: 10.5, letterSpacing: '0.1em', color: '#6B655B' }}>GILTIGT 12 MÅN · KOD VIA MEJL</p></div><div>{paused ? <Empty paused /> : <><p style={{ margin: '0 0 16px', fontFamily: "'IBM Plex Mono'", fontSize: 11, letterSpacing: '0.14em', color: '#9C968C' }}>BELOPP</p><div className={grid} style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}><AmountButtons gift={gift} className={styles.onyx} style={(on) => ({ cursor: 'pointer', textAlign: 'center', border: `1px solid ${on ? '#C9973F' : '#2E2E2E'}`, background: on ? '#C9973F' : 'transparent', color: on ? '#121212' : '#F2EFEA', padding: '13px 0', fontFamily: "'IBM Plex Mono'", fontSize: 12.5 })} /></div><button type="button" className={button(styles.onyxBuy)} onClick={gift.add} style={{ border: 'none', cursor: 'pointer', background: '#C9973F', color: '#121212', fontWeight: 700, fontSize: 14, letterSpacing: '0.06em', padding: '16px 32px' }}>{gift.added ? 'I KASSE ✓' : `+ LÄGG I KASSE — ${gift.amountLabel}`}</button></>}</div></div> : <Empty paused={paused} />}</section>
}

type SalonSpec = {
  variant: 'kalla' | 'siluett' | 'snitt'
  titleFont: string
  titleSize: number
  titleColor: string
  cardBg: string
  cardBorder?: string
  cardRadius?: number
  markColor: string
  accent: string
  muted: string
  buttonBg: string
  buttonColor: string
  body: string
  cta: string
}

function SalonGift(props: ThemePresentkortViewProps & { spec: SalonSpec }) {
  const { paused, tenantName, spec } = props
  const gift = useGiftState(props)
  return <section className={styles.section} data-gift-theme={spec.variant} style={{ maxWidth: 940, margin: '0 auto', padding: '56px 32px 0' }}><h1 className={title} style={{ margin: '0 0 40px', textAlign: spec.variant === 'kalla' ? 'center' : 'left', fontFamily: spec.titleFont, fontWeight: spec.variant === 'siluett' ? 400 : undefined, fontSize: spec.titleSize, textTransform: spec.variant === 'snitt' ? 'uppercase' : undefined, color: spec.titleColor }}>Presentkort{spec.variant === 'snitt' ? <span style={{ color: spec.accent }}>.</span> : null}</h1>{gift ? <div className={grid} style={{ gridTemplateColumns: '1fr 1fr', gap: 44, alignItems: 'center' }}><div style={{ background: spec.cardBg, border: spec.cardBorder, borderRadius: spec.cardRadius, padding: '48px 32px', textAlign: 'center' }}><p style={{ margin: '0 0 6px', fontFamily: spec.titleFont, fontSize: 24, letterSpacing: '0.14em', textTransform: 'uppercase', color: spec.markColor }}>{tenantName}{spec.variant === 'snitt' ? <span style={{ color: spec.accent }}>.</span> : null}</p><p style={{ margin: '0 0 34px', fontWeight: 700, fontSize: 10.5, letterSpacing: '0.3em', textTransform: 'uppercase', color: spec.accent }}>Presentkort</p><p style={{ margin: 0, fontFamily: spec.titleFont, fontStyle: spec.variant === 'siluett' ? 'italic' : undefined, fontSize: spec.variant === 'snitt' ? 58 : 52, color: spec.markColor }}>{gift.amountLabel}</p><p style={{ margin: '26px 0 0', fontSize: 12.5, color: spec.muted }}>Giltigt 12 månader · {spec.variant === 'snitt' ? 'Gäller allt i studion' : 'Skickas digitalt'}</p></div><div>{paused ? <Empty paused /> : <><p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: 11.5, letterSpacing: '0.22em', textTransform: 'uppercase', color: spec.titleColor }}>Välj belopp</p><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 26 }}><AmountButtons gift={gift} className={styles[spec.variant]} style={(on) => ({ cursor: 'pointer', fontWeight: 700, fontSize: 14.5, color: on ? spec.buttonColor : spec.titleColor, background: on ? spec.buttonBg : spec.variant === 'snitt' ? '#1D1D1A' : '#fff', border: `1px solid ${on ? spec.buttonBg : spec.variant === 'snitt' ? '#3A3A33' : '#DAD7C8'}`, borderRadius: spec.cardRadius ? 6 : undefined, padding: '12px 22px' })} /></div><p style={{ margin: '0 0 26px', fontSize: 14.5, lineHeight: 1.7, color: spec.muted }}>{spec.body}</p><button type="button" className={button(styles[`${spec.variant}Buy`])} onClick={gift.add} style={{ border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: spec.buttonColor, background: spec.buttonBg, borderRadius: spec.cardRadius ? 6 : undefined, padding: '15px 28px' }}>{gift.added ? 'I korgen ✓' : `${spec.cta} — ${gift.amountLabel}`}</button></>}</div></div> : <Empty paused={paused} />}</section>
}

function SivSav({ config, paused, tenantName }: ThemePresentkortViewProps) {
  const gift = useGiftState({ config, paused, tenantName })
  return <section className={styles.section} data-gift-theme="sivsav" style={{ maxWidth: 940, margin: '0 auto', padding: '64px 40px 0' }}><p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#7C8B6B' }}>Presentkort</p><h1 className={title} style={{ margin: '0 0 40px', fontFamily: "'Fraunces'", fontWeight: 400, fontSize: 52, letterSpacing: '-0.01em' }}>Ge bort blomster</h1>{gift ? <div className={grid} style={{ gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center' }}><div style={{ background: '#E4E7DA', borderRadius: 24, padding: '48px 36px', textAlign: 'center' }}><p style={{ margin: '0 0 6px', fontFamily: "'Fraunces'", fontWeight: 500, fontSize: 26, color: '#33352E' }}>{tenantName}</p><p style={{ margin: '0 0 30px', fontWeight: 600, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7C8B6B' }}>Presentkort</p><p style={{ margin: 0, fontFamily: "'Fraunces'", fontWeight: 500, fontSize: 46, color: '#33352E' }}>{gift.amountLabel}</p><p style={{ margin: '20px 0 0', fontSize: 12.5, color: '#8A8B7C' }}>Giltigt 12 månader · skickas digitalt</p></div><div>{paused ? <Empty paused /> : <><p style={{ margin: '0 0 14px', fontWeight: 600, fontSize: 13, color: '#33352E' }}>Välj belopp</p><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 26 }}><AmountButtons gift={gift} className={styles.sivsav} style={(on) => ({ cursor: 'pointer', fontWeight: 600, fontSize: 15, color: on ? '#F4F1EA' : '#33352E', background: on ? '#33352E' : 'transparent', border: `1px solid ${on ? '#33352E' : '#DAD7C8'}`, borderRadius: 999, padding: '12px 22px' })} /></div><button type="button" className={button(styles.sivsavBuy)} onClick={gift.add} style={{ border: 'none', cursor: 'pointer', background: '#33352E', color: '#F4F1EA', fontWeight: 600, fontSize: 15, borderRadius: 999, padding: '14px 30px' }}>{gift.added ? 'I korgen ✓' : `Lägg i korg — ${gift.amountLabel}`}</button></>}</div></div> : <Empty paused={paused} />}</section>
}

function SolSalt({ config, paused, tenantName }: ThemePresentkortViewProps) {
  const gift = useGiftState({ config, paused, tenantName })
  return <section className={styles.section} data-gift-theme="solsalt" style={{ maxWidth: 940, margin: '0 auto', padding: '48px 32px 0' }}><h1 className={title} style={{ margin: '0 0 36px', fontFamily: "'DM Serif Display'", fontSize: 50, color: '#1E2B49' }}>Presentkort</h1>{gift ? <div className={grid} style={{ gridTemplateColumns: '1fr 1fr', gap: 44, alignItems: 'center' }}><div style={{ background: '#1F4F9C', borderRadius: 24, padding: '44px 32px', textAlign: 'center' }}><p style={{ margin: '0 0 4px', fontFamily: "'DM Serif Display'", fontSize: 26, color: '#FAF3E1' }}>{tenantName}</p><p style={{ margin: '0 0 30px', fontWeight: 700, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#F2C349' }}>Presentkort</p><p style={{ margin: 0, fontFamily: "'DM Serif Display'", fontSize: 50, color: '#FAF3E1' }}>{gift.amountLabel}</p><p style={{ margin: '22px 0 0', fontSize: 12, color: '#CBDCF6' }}>Giltigt 12 månader · skickas digitalt</p></div><div>{paused ? <Empty paused /> : <><p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: 13, color: '#1E2B49' }}>Välj belopp</p><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}><AmountButtons gift={gift} className={styles.solsalt} style={(on) => ({ cursor: 'pointer', fontWeight: 700, fontSize: 15, color: on ? '#FAF3E1' : '#1E2B49', background: on ? '#1F4F9C' : 'transparent', border: `1.5px solid ${on ? '#1F4F9C' : '#A9C3EE'}`, borderRadius: 999, padding: '12px 22px' })} /></div><button type="button" className={button(styles.solsaltBuy)} onClick={gift.add} style={{ border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#FAF3E1', background: '#1F4F9C', borderRadius: 999, padding: '14px 28px' }}>{gift.added ? 'I korgen ✓' : `Lägg i korg — ${gift.amountLabel}`}</button></>}</div></div> : <Empty paused={paused} />}</section>
}

export const AuroraPresentkort = Aurora
export const BlomstertorgetPresentkort = Blomstertorget
export const CalytrixPresentkort = Calytrix
export const EloriaPresentkort = Eloria
export const LunariaPresentkort = Lunaria
export const OnyxPresentkort = Onyx
export const KallaPresentkort = (props: ThemePresentkortViewProps) => <SalonGift {...props} spec={{ variant: 'kalla', titleFont: "'Marcellus'", titleSize: 52, titleColor: '#22302B', cardBg: '#1D5E54', cardRadius: 8, markColor: '#EDF2EC', accent: '#A9C4B8', muted: '#5F6B60', buttonBg: '#1D5E54', buttonColor: '#EDF2EC', body: '900 kr räcker till Källritualen — vår vanligaste gåva. Kortet skickas digitalt eller hämtas i ett kuvert av gräspapper.', cta: 'Lägg i varukorg' }} />
export const SiluettPresentkort = (props: ThemePresentkortViewProps) => <SalonGift {...props} spec={{ variant: 'siluett', titleFont: "'Bodoni Moda'", titleSize: 58, titleColor: '#131313', cardBg: '#131313', markColor: '#F6F4EF', accent: '#6741D9', muted: '#6E685D', buttonBg: '#131313', buttonColor: '#F6F4EF', body: 'Räcker till en klippning, en balayage eller en väldigt lycklig människa. Skickas som pdf inom en timme.', cta: 'Lägg i kasse' }} />
export const SnittPresentkort = (props: ThemePresentkortViewProps) => <SalonGift {...props} spec={{ variant: 'snitt', titleFont: "'Anton'", titleSize: 64, titleColor: '#EFEDE6', cardBg: '#1D1D1A', cardBorder: '1px solid #3A3A33', markColor: '#EFEDE6', accent: '#D6F344', muted: '#A39F93', buttonBg: '#D6F344', buttonColor: '#141412', body: '800 kr täcker ett klipp med råge. Skickas som pdf inom en timme, eller hämtas i studion i svart kuvert.', cta: 'Lägg i korg' }} />
export const SivSavPresentkort = SivSav
export const SolSaltPresentkort = SolSalt
