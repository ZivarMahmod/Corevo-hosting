'use client'

import { useActionState, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { ShopProductRow, ShopOrderRow } from '@/lib/admin/shop/types'
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
} from '@/lib/admin/shop/actions'
import type { ActionState } from '@/lib/admin/actions'
import type { MediaAssetRow } from '@/lib/admin/media/types'
import { ImagePicker } from './ImagePicker'
import {
  Badge,
  Button,
  Card,
  Callout,
  Drawer,
  Icon,
  PageHead,
  Table,
  useToast,
} from '@/components/portal/ui'

// ── Shared input style (mirrors ServicesManager) ────────────────────────────
const inputStyle: CSSProperties = {
  padding: '9px 12px',
  borderRadius: 10,
  border: '1px solid var(--c-line)',
  background: 'var(--c-paper)',
  color: 'var(--c-ink)',
  fontFamily: 'var(--font-ui)',
  fontSize: 14,
  width: '100%',
}

const selectStyle: CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="eyebrow">{label}</span>
      {children}
    </label>
  )
}

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
}: {
  products: ShopProductRow[]
  orders: ShopOrderRow[]
  fulfilment: string
  tenantName: string
  assets: MediaAssetRow[]
}) {
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<ShopProductRow | null>(null)

  return (
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
            <div style={{ padding: 22 }}>
              <p className="eyebrow" style={{ marginBottom: 6 }}>
                Inga produkter ännu
              </p>
              <p className="body" style={{ margin: 0, maxWidth: 460, color: 'var(--c-ink-2)' }}>
                Lägg till din första produkt med{' '}
                <strong>Ny produkt</strong> — namn, pris och lagerstatus.
              </p>
            </div>
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
                <button
                  key="edit"
                  type="button"
                  onClick={() => setEditing(p)}
                  aria-label={`Redigera ${p.name}`}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--c-ink-3)',
                    cursor: 'pointer',
                    padding: 4,
                    display: 'inline-grid',
                    placeItems: 'center',
                  }}
                >
                  <Icon name="edit" size={17} />
                </button>,
              ])}
            />
          )}
        </Card>
      </div>

      {/* ── Ordrar ── */}
      <div style={{ marginTop: 32 }}>
        <h2 className="h2" style={{ marginBottom: 12 }}>
          Ordrar
        </h2>
        <OrdersSection orders={orders} />
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
    </div>
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
        <input type="hidden" name="id" value={product.id} />
        <input type="hidden" name="active" value={String(!product.active)} />
        <button
          type="submit"
          disabled={pending}
          aria-label={product.active ? `Dölj ${product.name}` : `Visa ${product.name}`}
          aria-pressed={product.active}
          style={{
            width: 42,
            height: 24,
            borderRadius: 999,
            border: 'none',
            cursor: pending ? 'default' : 'pointer',
            background: product.active ? 'var(--c-forest)' : 'var(--c-line-strong)',
            position: 'relative',
            flex: 'none',
            opacity: pending ? 0.6 : 1,
            transition: 'background var(--dur-fast)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 3,
              left: product.active ? 21 : 3,
              width: 18,
              height: 18,
              borderRadius: 999,
              background: '#fff',
              transition: 'left var(--dur-fast)',
            }}
          />
        </button>
      </form>
      <Badge tone={product.active ? 'success' : 'neutral'}>
        {product.active ? 'Aktiv' : 'Av'}
      </Badge>
    </div>
  )
}

// ── Orders section ──────────────────────────────────────────────────────────

function OrdersSection({ orders }: { orders: ShopOrderRow[] }) {
  if (orders.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p className="eyebrow" style={{ marginBottom: 6 }}>
            Inga ordrar ännu
          </p>
          <p style={{ fontSize: 13, color: 'var(--c-ink-3)', margin: 0 }}>
            När kunder beställer från din webshop visas ordarna här. Du kan följa status
            och uppdatera varje order från den här vyn.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card pad={0}>
      <Table
        cols={['Kund', 'Leveranssätt', 'Status', 'Belopp', 'Datum']}
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
        ])}
      />
    </Card>
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
        <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center' }}>
          <form action={delAction}>
            <input type="hidden" name="id" value={product.id} />
            <Button variant="ghost" type="submit" icon="trash" disabled={deleting}>
              {deleting ? '…' : 'Ta bort'}
            </Button>
          </form>
          <div style={{ flex: 1 }} />
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <button
            type="submit"
            form={formId}
            disabled={saving}
            className="pbtn pbtn--primary pbtn--md"
          >
            <Icon name="check" size={17} />
            {saving ? 'Sparar…' : 'Spara'}
          </button>
        </div>
      }
    >
      <form action={saveAction} id={formId} style={{ display: 'grid', gap: 14 }}>
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
