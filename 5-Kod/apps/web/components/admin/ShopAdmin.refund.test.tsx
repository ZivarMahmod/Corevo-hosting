/**
 * @vitest-environment happy-dom
 */

import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ShopAdmin } from './ShopAdmin'
import type { ShopOrderRow } from '@/lib/admin/shop/types'

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}))

vi.mock('@/lib/admin/shop/actions', () => ({
  createShopProduct: async () => ({}),
  updateShopProduct: async () => ({}),
  toggleShopProductActive: async () => ({}),
  deleteShopProduct: async () => ({}),
  setShopOrderStatus: async () => ({}),
  setShopOrderTracking: async () => ({}),
  refundShopOrderAction: async () => ({}),
  createShippingOption: async () => ({}),
  updateShippingOption: async () => ({}),
  deleteShippingOption: async () => ({}),
  setShopPaymentMethods: async () => ({}),
}))

vi.mock('@/components/portal/ui', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Button: ({
    children,
    disabled,
    onClick,
    type,
  }: {
    children: ReactNode
    disabled?: boolean
    onClick?: () => void
    type?: 'button' | 'submit'
  }) => (
    <button type={type ?? 'button'} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Callout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Drawer: ({ children, title }: { children: ReactNode; title: string }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  EmptyState: ({ title, text }: { title: string; text: ReactNode }) => (
    <div>
      {title}
      {text}
    </div>
  ),
  Field: ({ children, label }: { children: ReactNode; label: string }) => (
    <label>
      {label}
      {children}
    </label>
  ),
  PageHead: ({ children, title }: { children: ReactNode; title: string }) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
  PillToggle: ({ children }: { children: ReactNode }) => <button>{children}</button>,
  RowEditButton: ({
    ariaLabel,
    onClick,
  }: {
    ariaLabel: string
    onClick: () => void
  }) => <button aria-label={ariaLabel} onClick={onClick}>Visa</button>,
  Table: ({ rows }: { rows: ReactNode[][] }) => (
    <div>{rows.flat().map((cell, index) => <div key={index}>{cell}</div>)}</div>
  ),
  inputStyle: {},
  selectStyle: {},
  statusTone: () => 'neutral',
  useToast: () => ({ notify: mocks.notify }),
}))

vi.mock('./ImagePicker', () => ({
  ImagePicker: () => <input type="hidden" />,
}))
vi.mock('./TenantScope', () => ({
  TenantField: () => null,
  TenantScope: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

const baseOrder = {
  id: '123e4567-e89b-42d3-a456-426614174002',
  customer_name: 'Testkund',
  customer_email: 'kund@example.test',
  customer_phone: null,
  fulfilment: 'ship',
  status: 'confirmed',
  payment_status: 'paid',
  total_cents: 10000,
  currency: 'SEK',
  note: null,
  ship_address: null,
  tracking_number: null,
  carrier: null,
  shipped_at: null,
  created_at: '2026-07-29T12:00:00.000Z',
  items: [{ product_name: 'Produkt', quantity: 1, unit_price_cents: 10000 }],
  refund_status: null,
} satisfies ShopOrderRow

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

async function renderRefund(status: NonNullable<ShopOrderRow['refund_status']>) {
  const order: ShopOrderRow = {
    ...baseOrder,
    payment_status: status === 'succeeded' ? 'refunded' : 'paid',
    refund_status: status,
  }
  await act(async () => {
    root.render(
      <ShopAdmin
        products={[]}
        orders={[order]}
        fulfilment="ship"
        tenantName="Goal 92"
        assets={[]}
      />,
    )
  })
  const open = container.querySelector(
    `button[aria-label="Visa order ${order.id}"]`,
  ) as HTMLButtonElement | null
  if (!open) throw new Error('orderknappen saknas')
  await act(async () => open.click())
}

describe('ShopAdmin refundstatus', () => {
  it.each([
    ['pending', 'Återbetalning pågår'],
    ['succeeded', 'Återbetald'],
    ['failed', 'Återbetalning misslyckades'],
  ] as const)('visar %s explicit och döljer direkt-refundknappen', async (status, label) => {
    await renderRefund(status)
    expect(container.textContent).toContain(label)
    expect(container.textContent).not.toContain('Återbetala order')
  })
})
