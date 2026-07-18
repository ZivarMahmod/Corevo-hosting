'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ShopProductRow, ShopOrderRow, ShippingOptionRow } from '@/lib/admin/shop/types'
import { SHOP_PAYMENT_METHODS, type ShopPaymentMethod } from '@/lib/storefront/shop/types'
import { centsToKronorInput } from '@/lib/admin/format'
import {
  SHOP_ORDER_STATUSES,
  SHOP_ORDER_STATUS_LABELS,
  formatCents,
} from '@/lib/admin/shop/types'
import {
  createShopProduct,
  updateShopProduct,
  toggleShopProductActive,
  deleteShopProduct,
  setShopOrderStatus,
  setShopOrderTracking,
  refundShopOrderAction,
  createShippingOption,
  updateShippingOption,
  deleteShippingOption,
  setShopPaymentMethods,
} from '@/lib/admin/shop/actions'
import type { ActionState } from '@/lib/admin/actions'
import type { MediaAssetRow } from '@/lib/admin/media/types'
import { ImagePicker } from './ImagePicker'
import { TenantScope, TenantField } from './TenantScope'
import {
  Badge,
  Button,
  Card,
  Callout,
  Drawer,
  EmptyState,
  Field,
  PageHead,
  PillToggle,
  RowEditButton,
  Table,
  inputStyle,
  selectStyle,
  statusTone,
  useToast,
} from '@/components/portal/ui'

// ── Fulfilment display label ────────────────────────────────────────────────
const FULFILMENT_LABELS: Record<string, string> = {
  ship: 'Posta hem',
  pickup_within_days: 'Hämta i butik',
  order_in_then_pickup: 'Beställ hem till butik',
}

// ── Root component ──────────────────────────────────────────────────────────
export function ShopAdmin({
  products,
  orders,
  fulfilment,
  tenantName,
  assets,
  tenantId,
  // goal-64 — KASSAN. Kunden äger sina leveransval och sina betalsätt. Default [] så
  // varje befintlig anropare fortsätter fungera oförändrat.
  shippingOptions = [],
  paymentMethods = [],
  /** Tar kundens Stripe FAKTISKT emot pengar? Styr bara HJÄLPTEXTEN här (kassan gatar
   *  på riktigt) — men en toggle utan besked om varför den inte syns är en fälla. */
  stripeReady = false,
  /** Finns PAYPAL_CLIENT_ID/SECRET i miljön? Saknas → PayPal går inte att visa i kassan. */
  paypalReady = false,
}: {
  products: ShopProductRow[]
  orders: ShopOrderRow[]
  fulfilment: string
  tenantName: string
  assets: MediaAssetRow[]
  /** Set ONLY by the super-admin kundkort (/salonger/[id]) — scopes every form's hidden tenantId for the dual-guard. */
  tenantId?: string
  shippingOptions?: ShippingOptionRow[]
  paymentMethods?: ShopPaymentMethod[]
  stripeReady?: boolean
  paypalReady?: boolean
}) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ShopProductRow | null>(null)
  const [openOrder, setOpenOrder] = useState<ShopOrderRow | null>(null)

  return (
    <TenantScope tenantId={tenantId}>
    <div>
      <PageHead
        eyebrow={tenantName}
        title="Webshop"
        lede={`Leveranssätt: ${FULFILMENT_LABELS[fulfilment] ?? fulfilment}`}
      >
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
          Ny produkt
        </Button>
      </PageHead>

      <Callout tone="gold" icon="link">
        Aktiva produkter visas i din webshop. Ändringar slår igenom utan kod eller deploy.
      </Callout>

      {/* ── Produkter ── */}
      <div style={{ marginTop: 24 }}>
        <h2 className="h2" style={{ marginBottom: 12 }}>
          Produkter
        </h2>
        <Card pad={0}>
          {products.length === 0 ? (
            <EmptyState
              title="Inga produkter ännu"
              text={
                <>
                  Lägg till din första produkt med <strong>Ny produkt</strong> — namn, pris och
                  lagerstatus.
                </>
              }
            />
          ) : (
            <Table
              cols={['Produkt', 'Pris', 'Lager', 'Status', '']}
              rows={products.map((p) => [
                <ProductCell
                  key="namn"
                  product={p}
                  imageUrl={assets.find((a) => a.id === p.image_asset_id)?.url ?? null}
                />,
                <span key="pris" className="num" style={{ fontWeight: 600 }}>
                  {formatCents(p.price_cents, p.currency)}
                </span>,
                <StockCell key="lager" product={p} />,
                <ActiveToggle key="status" product={p} />,
                <RowEditButton
                  key="edit"
                  onClick={() => setEditing(p)}
                  ariaLabel={`Redigera ${p.name}`}
                />,
              ])}
            />
          )}
        </Card>
      </div>

      {/* ── Leverans & betalning (goal-64) ── */}
      <ShippingSection options={shippingOptions} />
      <PaymentSection
        selected={paymentMethods}
        stripeReady={stripeReady}
        paypalReady={paypalReady}
      />

      {/* ── Översikt (lean analytics) ── */}
      {orders.length > 0 ? <ShopAnalytics orders={orders} /> : null}

      {/* ── Ordrar ── */}
      <div style={{ marginTop: 32 }}>
        <h2 className="h2" style={{ marginBottom: 12 }}>
          Ordrar
        </h2>
        <OrdersSection orders={orders} onOpen={setOpenOrder} />
      </div>

      {creating && <CreateDrawer assets={assets} onClose={() => setCreating(false)} />}
      {editing && (
        <EditDrawer
          key={editing.id}
          product={editing}
          assets={assets}
          onClose={() => setEditing(null)}
        />
      )}
      {openOrder && (
        <OrderDetailDrawer key={openOrder.id} order={openOrder} onClose={() => setOpenOrder(null)} />
      )}
    </div>
    </TenantScope>
  )
}

// ── Lean analytics + kund-översikt (härledd ur orders, ingen ny tabell) ──────
/**
 * LEVERANSVALEN (goal-64). Kunden lägger upp sina egna leveranssätt — namn, beskrivning,
 * pris, ordning, av/på — och kassan visar EXAKT dem. Före det här kunde motorn bara visa
 * en förvald fulfilment-rad och shipping_cents var alltid 0, så en mall som ritade en
 * fraktrad ljög om totalen.
 *
 * Priset skrivs i kronor; servern lagrar öre och slår upp det på nytt när ordern läggs —
 * det som står här ÄR det kunden betalar. 0 kr visas som "Fritt" på sajten.
 */
function ShippingSection({ options }: { options: ShippingOptionRow[] }) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ShippingOptionRow | null>(null)

  return (
    <div style={{ marginTop: 32 }}>
      <h2 className="h2" style={{ marginBottom: 4 }}>
        Leveranssätt
      </h2>
      <p className="muted" style={{ marginBottom: 12 }}>
        Det kunden får välja mellan i kassan. Priset läggs på ordersumman. 0 kr visas som
        &quot;Fritt&quot;. Inga leveranssätt → kassan hoppar över steget och frakten är 0.
      </p>
      <Card pad={0}>
        {options.length === 0 ? (
          <EmptyState
            title="Inga leveranssätt ännu"
            text={
              <>
                Lägg till t.ex. <strong>Bud samma dag (79 kr)</strong> och{' '}
                <strong>Hämta i butik (0 kr)</strong>.
              </>
            }
          />
        ) : (
          <Table
            cols={['Leveranssätt', 'Pris', 'Status', '']}
            rows={options.map((o) => [
              <div key="namn">
                <div style={{ fontWeight: 600 }}>{o.name}</div>
                {o.description ? <div className="muted">{o.description}</div> : null}
              </div>,
              <span key="pris" className="num" style={{ fontWeight: 600 }}>
                {o.cost_cents === 0 ? 'Fritt' : formatCents(o.cost_cents)}
              </span>,
              <Badge key="status" tone={o.active ? statusTone('active') : undefined}>
                {o.active ? 'Aktiv' : 'Avstängd'}
              </Badge>,
              <RowEditButton
                key="edit"
                onClick={() => setEditing(o)}
                ariaLabel={`Redigera ${o.name}`}
              />,
            ])}
          />
        )}
      </Card>
      <div style={{ marginTop: 12 }}>
        <Button icon="plus" onClick={() => setCreating(true)}>
          Nytt leveranssätt
        </Button>
      </div>

      {creating ? (
        <ShippingDrawer option={null} onClose={() => setCreating(false)} />
      ) : null}
      {editing ? (
        <ShippingDrawer option={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  )
}

/** Ett leveransval: skapa ELLER redigera (samma fält — bara action:en skiljer). */
function ShippingDrawer({
  option,
  onClose,
}: {
  option: ShippingOptionRow | null
  onClose: () => void
}) {
  const { notify } = useToast()
  const [createState, createAction, creating] = useActionState(createShippingOption, {} as ActionState)
  const [updateState, updateAction, updating] = useActionState(updateShippingOption, {} as ActionState)
  const [deleteState, deleteAction] = useActionState(deleteShippingOption, {} as ActionState)
  const state = option ? updateState : createState
  const busy = option ? updating : creating

  useEffect(() => {
    const msg = state.success ?? deleteState.success
    if (msg) {
      notify(msg)
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, deleteState.success])

  return (
    <Drawer
      onClose={onClose}
      title={option ? 'Redigera leveranssätt' : 'Nytt leveranssätt'}
      sub="Det kunden väljer mellan i kassan. Priset läggs på ordersumman."
      ariaLabel={option ? 'Redigera leveranssätt' : 'Nytt leveranssätt'}
    >
      <form action={option ? updateAction : createAction}>
        <TenantField />
        {option ? <input type="hidden" name="id" value={option.id} /> : null}

        <Field label="Namn">
          <input
            name="name"
            defaultValue={option?.name ?? ''}
            required
            maxLength={120}
            placeholder="Bud samma dag (före kl 14)"
            style={inputStyle}
          />
        </Field>
        <Field label="Beskrivning (valfritt)">
          <input
            name="description"
            defaultValue={option?.description ?? ''}
            maxLength={240}
            placeholder="Beställ före kl 14, levereras 16–21"
            style={inputStyle}
          />
        </Field>
        <Field label="Pris (kr) — 0 = Fritt">
          <input
            name="cost"
            type="text"
            inputMode="decimal"
            defaultValue={option ? centsToKronorInput(option.cost_cents) : '0'}
            style={inputStyle}
          />
        </Field>
        <Field label="Sortering">
          <input
            name="sort_order"
            type="number"
            min={0}
            defaultValue={option?.sort_order ?? 0}
            style={inputStyle}
          />
        </Field>
        {option ? (
          <Field label="Aktiv">
            <input type="checkbox" name="active" defaultChecked={option.active} />
          </Field>
        ) : null}

        {state.error ? <Callout tone="warning">{state.error}</Callout> : null}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Sparar…' : 'Spara'}
          </Button>
        </div>
      </form>

      {option ? (
        // Radering är säker: shop_orders.shipping_option_id är ON DELETE SET NULL och
        // beloppet står kvar på ordern — ett lagt kvitto ändrar sig aldrig i efterhand.
        <form action={deleteAction} style={{ marginTop: 24 }}>
          <TenantField />
          <input type="hidden" name="id" value={option.id} />
          <Button type="submit" variant="ghost" icon="trash">
            Ta bort
          </Button>
          {deleteState.error ? <Callout tone="warning">{deleteState.error}</Callout> : null}
        </form>
      ) : null}
    </Drawer>
  )
}

/**
 * BETALSÄTTEN (goal-64). Kunden väljer vad butiken tar emot; kassan visar bara det som
 * ALLTID också har en kopplad räls. En påslagen toggle utan koppling är ett önskemål, och
 * vi säger det rakt ut i stället för att visa en knapp i kassan som inte fungerar.
 */
function PaymentSection({
  selected,
  stripeReady,
  paypalReady,
}: {
  selected: ShopPaymentMethod[]
  stripeReady: boolean
  paypalReady: boolean
}) {
  const { notify } = useToast()
  const [state, action, pending] = useActionState(setShopPaymentMethods, {} as ActionState)

  useEffect(() => {
    if (state.success) notify(state.success)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <div style={{ marginTop: 32 }}>
      <h2 className="h2" style={{ marginBottom: 4 }}>
        Betalsätt
      </h2>
      <p className="muted" style={{ marginBottom: 12 }}>
        Kassan visar bara betalsätt som är påslagna OCH kopplade. Inget påslaget → kunden
        betalar vid leverans/upphämtning.
      </p>
      <Card>
        <form action={action}>
          <TenantField />
          {SHOP_PAYMENT_METHODS.filter((method) => method.id !== 'paypal' || paypalReady).map((m) => {
            // Kort/Swish/Klarna/Apple Pay går via kundens Stripe; PayPal via plattformens.
            const connected = m.id === 'paypal' ? paypalReady : stripeReady
            return (
              <label
                key={m.id}
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}
              >
                <input
                  type="checkbox"
                  name="method"
                  value={m.id}
                  defaultChecked={selected.includes(m.id)}
                  style={{ marginTop: 4 }}
                />
                <span>
                  <strong>{m.label}</strong>{' '}
                  {connected ? null : (
                    <Badge>
                      {m.id === 'paypal' ? 'PayPal-nycklar saknas' : 'Stripe ej kopplad'}
                    </Badge>
                  )}
                  <br />
                  <span className="muted">{m.hint}</span>
                </span>
              </label>
            )
          })}

          {state.error ? <Callout tone="warning">{state.error}</Callout> : null}

          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Sparar…' : 'Spara betalsätt'}
          </Button>
        </form>
      </Card>
    </div>
  )
}

function ShopAnalytics({ orders }: { orders: ShopOrderRow[] }) {
  const real = orders.filter((o) => o.status !== 'cancelled')
  const revenue = real.reduce((s, o) => s + o.total_cents, 0)
  const currency = orders[0]?.currency ?? 'SEK'
  const customers = new Set(orders.map((o) => o.customer_email ?? o.customer_name ?? o.id)).size
  // topp-produkter (antal sålda) ur orderrader.
  const byProduct = new Map<string, number>()
  for (const o of real) for (const it of o.items) byProduct.set(it.product_name, (byProduct.get(it.product_name) ?? 0) + it.quantity)
  const top = [...byProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)

  return (
    <div style={{ marginTop: 24, display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
      <Stat label="Ordrar" value={String(real.length)} />
      <Stat label="Omsättning" value={formatCents(revenue, currency)} />
      <Stat label="Kunder" value={String(customers)} />
      <Card>
        <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>
          Toppsäljare
        </span>
        {top.length === 0 ? (
          <span style={{ fontSize: 13, color: 'var(--c-ink-3)' }}>—</span>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {top.map(([name, qty]) => (
              <li key={name}>
                {name} <span style={{ color: 'var(--c-ink-3)' }}>×{qty}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
        {label}
      </span>
      <span className="num" style={{ fontSize: 22, fontWeight: 700 }}>
        {value}
      </span>
    </Card>
  )
}

// ── Product table cells ─────────────────────────────────────────────────────

function ProductCell({
  product,
  imageUrl,
}: {
  product: ShopProductRow
  imageUrl?: string | null
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          style={{
            width: 36,
            height: 36,
            objectFit: 'cover',
            border: '1px solid var(--c-line)',
            borderRadius: 8,
            flex: 'none',
          }}
        />
      )}
      <div>
        <b style={{ fontWeight: 600 }}>{product.name}</b>
        {product.description && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--c-ink-3)',
              marginTop: 2,
              maxWidth: 260,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {product.description}
          </div>
        )}
      </div>
    </div>
  )
}

function StockCell({ product }: { product: ShopProductRow }) {
  if (product.stock === null) {
    return <span style={{ fontSize: 12.5, color: 'var(--c-ink-3)' }}>Obegränsat</span>
  }
  if (product.stock === 0) {
    // Specialfall: 'Slut' är lager-logik (inte en status-sträng) — statusTone gäller ej här.
    return <Badge tone="warning">Slut</Badge>
  }
  return (
    <span className="num" style={{ fontSize: 13 }}>
      {product.stock}
    </span>
  )
}

function ActiveToggle({ product }: { product: ShopProductRow }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    toggleShopProductActive,
    {},
  )

  useEffect(() => {
    if (state.success) {
      notify(
        product.active
          ? `${product.name} dold i webshopen`
          : `${product.name} syns nu i webshopen`,
        'success',
      )
      router.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <form action={formAction} style={{ display: 'inline-flex' }}>
        <TenantField />
        <input type="hidden" name="id" value={product.id} />
        <input type="hidden" name="active" value={String(!product.active)} />
        <PillToggle
          type="submit"
          active={product.active}
          disabled={pending}
          ariaLabel={product.active ? `Dölj ${product.name}` : `Visa ${product.name}`}
        >
          {product.active ? 'Dölj' : 'Visa'}
        </PillToggle>
      </form>
      {/* Boolean aktiv-flagga (ingen status-sträng) — statusTone gäller ej här. */}
      <Badge tone={product.active ? 'success' : 'neutral'}>
        {product.active ? 'Aktiv' : 'Av'}
      </Badge>
    </div>
  )
}

// ── Orders section ──────────────────────────────────────────────────────────

function OrdersSection({ orders, onOpen }: { orders: ShopOrderRow[]; onOpen: (o: ShopOrderRow) => void }) {
  if (orders.length === 0) {
    return (
      <Card pad={0}>
        <EmptyState
          title="Inga ordrar ännu"
          text="När kunder beställer från din webshop visas ordarna här. Du kan följa status och uppdatera varje order från den här vyn."
        />
      </Card>
    )
  }

  return (
    <Card pad={0}>
      <Table
        cols={['Kund', 'Leveranssätt', 'Status', 'Belopp', 'Datum', '']}
        rows={orders.map((o) => [
          <OrderCustomerCell key="kund" order={o} />,
          <span key="lev" style={{ fontSize: 13 }}>
            {FULFILMENT_LABELS[o.fulfilment] ?? o.fulfilment}
          </span>,
          <OrderStatusCell key="status" order={o} />,
          <span key="belopp" className="num" style={{ fontWeight: 600 }}>
            {formatCents(o.total_cents, o.currency)}
          </span>,
          <span key="datum" style={{ fontSize: 12, color: 'var(--c-ink-3)', whiteSpace: 'nowrap' }}>
            {new Date(o.created_at).toLocaleDateString('sv-SE')}
          </span>,
          <RowEditButton
            key="visa"
            icon="chevronRight"
            onClick={() => onOpen(o)}
            ariaLabel={`Visa order ${o.id}`}
          />,
        ])}
      />
    </Card>
  )
}

// ── Order detail drawer (rader, kund, leveransadress, spårning, refund) ──────
function OrderDetailDrawer({ order, onClose }: { order: ShopOrderRow; onClose: () => void }) {
  const { notify } = useToast()
  const router = useRouter()
  const [track, trackAction, tracking] = useActionState<ActionState, FormData>(setShopOrderTracking, {})
  const [refund, refundAction, refunding] = useActionState<ActionState, FormData>(refundShopOrderAction, {})

  useEffect(() => {
    if (track.success) {
      notify('Spårning sparad.', 'success')
      router.refresh()
    }
    if (track.error) notify(track.error, 'warning')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track.success, track.error])

  useEffect(() => {
    if (refund.success) {
      notify('Återbetalning genomförd.', 'success')
      router.refresh()
      onClose()
    }
    if (refund.error) notify(refund.error, 'warning')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refund.success, refund.error])

  const trackFormId = `order-track-${order.id}`

  return (
    <Drawer
      title={`Order #${order.id.slice(0, 8)}`}
      sub={`${FULFILMENT_LABELS[order.fulfilment] ?? order.fulfilment} · ${new Date(order.created_at).toLocaleString('sv-SE')}`}
      accent={<Badge tone={statusTone(order.payment_status)}>{order.payment_status}</Badge>}
      onClose={onClose}
      ariaLabel={`Order ${order.id}`}
    >
      <div style={{ display: 'grid', gap: 18 }}>
        {/* Kund */}
        <div>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
            Kund
          </span>
          <div style={{ fontWeight: 600 }}>{order.customer_name ?? '—'}</div>
          {order.customer_email && <div style={{ fontSize: 13, color: 'var(--c-ink-3)' }}>{order.customer_email}</div>}
          {order.customer_phone && <div style={{ fontSize: 13, color: 'var(--c-ink-3)' }}>{order.customer_phone}</div>}
          {order.ship_address && <div style={{ fontSize: 13, marginTop: 4 }}>{order.ship_address}</div>}
        </div>

        {/* Rader */}
        <div>
          <span className="eyebrow" style={{ display: 'block', marginBottom: 6 }}>
            Produkter
          </span>
          {order.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '3px 0' }}>
              <span>
                {it.product_name} × {it.quantity}
              </span>
              <span className="num">{formatCents(it.unit_price_cents * it.quantity, order.currency)}</span>
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 8,
              paddingTop: 8,
              borderTop: '1px solid var(--c-line)',
              fontWeight: 700,
            }}
          >
            <span>Totalt</span>
            <span className="num">{formatCents(order.total_cents, order.currency)}</span>
          </div>
        </div>

        {order.note && (
          <div>
            <span className="eyebrow" style={{ display: 'block', marginBottom: 4 }}>
              Meddelande
            </span>
            <p style={{ margin: 0, fontSize: 13 }}>{order.note}</p>
          </div>
        )}

        {/* Spårning */}
        <form action={trackAction} id={trackFormId} style={{ display: 'grid', gap: 10 }}>
          <TenantField />
          <input type="hidden" name="id" value={order.id} />
          <span className="eyebrow">Leverans / spårning</span>
          <Field label="Transportör">
            <input name="carrier" defaultValue={order.carrier ?? ''} placeholder="t.ex. PostNord" style={inputStyle} />
          </Field>
          <Field label="Spårningsnummer">
            <input name="tracking_number" defaultValue={order.tracking_number ?? ''} placeholder="—" style={inputStyle} />
          </Field>
          <Button variant="ghost" type="submit" icon="check" disabled={tracking}>
            {tracking ? 'Sparar…' : 'Spara spårning'}
          </Button>
        </form>

        {/* Refund (bara betald order; betal-rälsen pausad → knappen syns när paid) */}
        {order.payment_status === 'paid' && (
          <form action={refundAction} style={{ borderTop: '1px solid var(--c-line)', paddingTop: 14 }}>
            <TenantField />
            <input type="hidden" name="id" value={order.id} />
            <Button variant="ghost" type="submit" icon="undo" disabled={refunding}>
              {refunding ? 'Återbetalar…' : 'Återbetala order'}
            </Button>
          </form>
        )}
      </div>
    </Drawer>
  )
}

function OrderCustomerCell({ order }: { order: ShopOrderRow }) {
  const name = order.customer_name ?? '—'
  const email = order.customer_email
  return (
    <div>
      <b style={{ fontWeight: 600 }}>{name}</b>
      {email && (
        <div style={{ fontSize: 12, color: 'var(--c-ink-3)', marginTop: 2 }}>{email}</div>
      )}
    </div>
  )
}

function OrderStatusCell({ order }: { order: ShopOrderRow }) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    setShopOrderStatus,
    {},
  )

  useEffect(() => {
    if (state.success) {
      notify('Orderstatus uppdaterad.', 'success')
      router.refresh()
    }
    if (state.error) {
      notify(state.error, 'warning')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.error])

  return (
    <form action={formAction} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <TenantField />
      <input type="hidden" name="id" value={order.id} />
      <select
        name="status"
        defaultValue={order.status}
        disabled={pending}
        onChange={(e) => {
          const form = e.currentTarget.closest('form') as HTMLFormElement | null
          if (form) form.requestSubmit()
        }}
        style={{
          ...selectStyle,
          width: 'auto',
          fontSize: 12,
          padding: '4px 8px',
          opacity: pending ? 0.6 : 1,
        }}
        aria-label={`Orderstatus för order ${order.id}`}
      >
        {SHOP_ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {SHOP_ORDER_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </form>
  )
}

// ── Create Drawer ───────────────────────────────────────────────────────────

function CreateDrawer({
  assets,
  onClose,
}: {
  assets: MediaAssetRow[]
  onClose: () => void
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createShopProduct,
    {},
  )

  useEffect(() => {
    if (state.success) {
      notify('Produkt skapad.', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  const formId = 'create-shop-product'

  return (
    <Drawer
      title="Ny produkt"
      sub="Namn och pris styr vad kunden ser i din webshop."
      onClose={onClose}
      ariaLabel="Ny produkt"
      footer={
        <form
          action={formAction}
          id={formId}
          style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}
        >
          <TenantField />
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" type="submit" icon="check" disabled={pending}>
            {pending ? 'Sparar…' : 'Lägg till produkt'}
          </Button>
        </form>
      }
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Namn">
          <input form={formId} name="name" required style={inputStyle} placeholder="Produktnamn" />
        </Field>
        <Field label="Beskrivning">
          <textarea
            form={formId}
            name="description"
            rows={3}
            placeholder="Valfri beskrivning"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>
        <Field label="Pris (kr)">
          <input
            form={formId}
            name="price"
            type="text"
            inputMode="decimal"
            placeholder="0"
            className="num"
            style={inputStyle}
          />
        </Field>
        <Field label="Lager (lämna tomt = obegränsat)">
          <input
            form={formId}
            name="stock"
            type="number"
            min="0"
            step="1"
            placeholder="—"
            className="num"
            style={inputStyle}
          />
        </Field>
        <Field label="Sorteringsordning">
          <input
            form={formId}
            name="sort_order"
            type="number"
            defaultValue={0}
            step="1"
            className="num"
            style={inputStyle}
          />
        </Field>
        {/* goal-64: fälten mallarna renderar. Tomma → mallen ritar dem inte alls. */}
        <Field label="Kategori (blir butikens filterknappar)">
          <input
            form={formId}
            name="category"
            type="text"
            placeholder="t.ex. Buketter, Serum, Styling"
            style={inputStyle}
          />
        </Field>
        <Field label="Märke (visas över bilden)">
          <input
            form={formId}
            name="badge"
            type="text"
            placeholder="t.ex. Bästsäljare, Få kvar"
            style={inputStyle}
          />
        </Field>
        <Field label="Jämförelsepris (kr) — tidigare pris, styr prispilen">
          <input
            form={formId}
            name="compare_at_price"
            type="text"
            inputMode="decimal"
            placeholder="—"
            className="num"
            style={inputStyle}
          />
        </Field>
        <Field label="Från-pris">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
            <input form={formId} name="price_from" type="checkbox" />
            Priset är ett startpris — visas som &quot;fr. 349 kr&quot;
          </label>
        </Field>
        <ImagePicker name="image_asset_id" assets={assets} formId={formId} label="Produktbild" />
        {state.error && (
          <p className="auth-error" role="alert" style={{ margin: 0 }}>
            {state.error}
          </p>
        )}
      </div>
    </Drawer>
  )
}

// ── Edit Drawer ─────────────────────────────────────────────────────────────

function EditDrawer({
  product,
  assets,
  onClose,
}: {
  product: ShopProductRow
  assets: MediaAssetRow[]
  onClose: () => void
}) {
  const { notify } = useToast()
  const router = useRouter()
  const [save, saveAction, saving] = useActionState<ActionState, FormData>(
    updateShopProduct,
    {},
  )
  const [del, delAction, deleting] = useActionState<ActionState, FormData>(
    deleteShopProduct,
    {},
  )
  // Tvåstegsbekräftelse: "Ta bort" raderade tidigare på ETT klick — granne med
  // "Spara" i samma footer. Klick 1 armerar (knappen blir "Säker? Ta bort
  // permanent" i varningston + en Ångra), klick 2 skickar delete-formuläret.
  // Drawern remountas per produkt (key=product.id) så armeringen kan aldrig
  // läcka mellan produkter. Samma mönster som ServicesManager/StaffRoster.
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (save.success) {
      notify('Produkt uppdaterad.', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.success])

  useEffect(() => {
    if (del.success) {
      notify('Produkt borttagen.', 'success')
      router.refresh()
      onClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [del.success])

  const formId = `edit-shop-product-${product.id}`

  return (
    <Drawer
      title={product.name}
      sub={product.active ? 'Syns i webshopen' : 'Dold i webshopen'}
      accent={
        <Badge tone={product.active ? 'success' : 'neutral'}>
          {product.active ? 'Aktiv' : 'Av'}
        </Badge>
      }
      onClose={onClose}
      ariaLabel={`Redigera ${product.name}`}
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center', flexWrap: 'wrap' }}>
          <form action={delAction} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
            <TenantField />
            <input type="hidden" name="id" value={product.id} />
            {confirmDelete ? (
              <>
                <Button
                  variant="ghost"
                  type="submit"
                  icon="trash"
                  disabled={deleting}
                  style={{ color: 'var(--c-danger)' }}
                >
                  {deleting ? '…' : 'Säker? Ta bort permanent'}
                </Button>
                <Button variant="ghost" type="button" onClick={() => setConfirmDelete(false)}>
                  Ångra
                </Button>
              </>
            ) : (
              <Button variant="ghost" type="button" icon="trash" onClick={() => setConfirmDelete(true)}>
                Ta bort
              </Button>
            )}
          </form>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button variant="primary" type="submit" form={formId} icon="check" disabled={saving}>
            {saving ? 'Sparar…' : 'Spara'}
          </Button>
        </div>
      }
    >
      <form action={saveAction} id={formId} style={{ display: 'grid', gap: 14 }}>
        <TenantField />
        <input type="hidden" name="id" value={product.id} />
        <Field label="Namn">
          <input name="name" defaultValue={product.name} required style={inputStyle} />
        </Field>
        <Field label="Beskrivning">
          <textarea
            name="description"
            defaultValue={product.description ?? ''}
            rows={3}
            placeholder="Valfri beskrivning"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </Field>
        <Field label="Pris (kr)">
          <input
            name="price"
            type="text"
            inputMode="decimal"
            defaultValue={product.price_cents / 100}
            className="num"
            style={inputStyle}
          />
        </Field>
        <Field label="Lager (lämna tomt = obegränsat)">
          <input
            name="stock"
            type="number"
            min="0"
            step="1"
            defaultValue={product.stock ?? ''}
            placeholder="—"
            className="num"
            style={inputStyle}
          />
        </Field>
        <Field label="Sorteringsordning">
          <input
            name="sort_order"
            type="number"
            defaultValue={product.sort_order}
            step="1"
            className="num"
            style={inputStyle}
          />
        </Field>
        {/* goal-64: samma fyra fält som i skapa-formuläret — annars gick de bara att sätta
            en gång och aldrig ändra (eller ta bort igen). Tomt fält → null → mallen tiger. */}
        <Field label="Kategori (blir butikens filterknappar)">
          <input
            name="category"
            type="text"
            defaultValue={product.category ?? ''}
            placeholder="t.ex. Buketter, Serum, Styling"
            style={inputStyle}
          />
        </Field>
        <Field label="Märke (visas över bilden)">
          <input
            name="badge"
            type="text"
            defaultValue={product.badge ?? ''}
            placeholder="t.ex. Bästsäljare, Få kvar"
            style={inputStyle}
          />
        </Field>
        <Field label="Jämförelsepris (kr) — tidigare pris, styr prispilen">
          <input
            name="compare_at_price"
            type="text"
            inputMode="decimal"
            defaultValue={
              product.compare_at_price_cents == null ? '' : product.compare_at_price_cents / 100
            }
            placeholder="—"
            className="num"
            style={inputStyle}
          />
        </Field>
        <Field label="Från-pris">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
            <input name="price_from" type="checkbox" defaultChecked={product.price_from} />
            Priset är ett startpris — visas som &quot;fr. 349 kr&quot;
          </label>
        </Field>
        <ImagePicker
          name="image_asset_id"
          assets={assets}
          formId={formId}
          defaultAssetId={product.image_asset_id}
          label="Produktbild"
        />
      </form>

      {(save.error || del.error) && (
        <p className="auth-error" role="alert" style={{ marginTop: 12 }}>
          {save.error ?? del.error}
        </p>
      )}
    </Drawer>
  )
}
