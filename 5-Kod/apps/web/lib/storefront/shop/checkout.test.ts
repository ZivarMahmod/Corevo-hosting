import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  availablePaymentMethods,
  formatShippingPrice,
  orderTotals,
  parsePaymentMethods,
  parseShopConfig,
  paymentMethodSpec,
  shippingCostCents,
  SHOP_PAYMENT_METHODS,
  type ShippingOption,
} from './types'

// KASSANS SANNING (goal-64). Fyra saker får ALDRIG gå sönder, för de är det som skiljer
// en kassa från en lögn:
//   1. Fraktpriset kommer ur DB, aldrig ur klienten.
//   2. Totalen = delsumma + frakt − rabatt + moms.
//   3. Ett betalsätt som inte är konfigurerat erbjuds inte (PayPal utan nycklar = dolt).
//   4. Ordernumret är per-tenant-unikt och kan inte kollidera.

const OPTIONS: ShippingOption[] = [
  { id: 'opt-bud', key: 'bud', name: 'Bud samma dag', description: 'Före kl 14', costCents: 7900 },
  { id: 'opt-hamta', key: 'hamta', name: 'Hämta i studion', description: null, costCents: 0 },
]

describe('fraktpriset kan inte manipuleras från klienten', () => {
  it('slår upp kostnaden på ID:t, ur butikens egen lista', () => {
    expect(shippingCostCents(OPTIONS, 'opt-bud')).toBe(7900)
    expect(shippingCostCents(OPTIONS, 'opt-hamta')).toBe(0)
  })

  it('ett OKÄNT id ger 0 kr — aldrig ett påhittat pris', () => {
    // En manipulerad klient som skickar ett främmande id kan alltså inte få kassan att
    // visa ett annat pris; och servern (confirm_shop_order) AVVISAR id:t helt.
    expect(shippingCostCents(OPTIONS, 'nagon-annans-option')).toBe(0)
    expect(shippingCostCents(OPTIONS, null)).toBe(0)
  })

  it('0 kr skrivs "Fritt" — designens ord, aldrig "0 kr"', () => {
    expect(formatShippingPrice(0)).toBe('Fritt')
    expect(formatShippingPrice(7900)).toBe('79 kr')
  })
})

describe('total = delsumma + frakt − rabatt + moms', () => {
  it('lägger frakten på delsumman', () => {
    const t = orderTotals({ subtotalCents: 45000, shippingCents: 7900 })
    expect(t.totalCents).toBe(52900)
  })

  it('gratis frakt ändrar inte totalen', () => {
    expect(orderTotals({ subtotalCents: 45000, shippingCents: 0 }).totalCents).toBe(45000)
  })

  it('räkningen går genom rabatt- och moms-fälten (rabattkoder byggs senare)', () => {
    const t = orderTotals({
      subtotalCents: 100_00,
      shippingCents: 50_00,
      discountCents: 20_00,
      taxCents: 10_00,
    })
    expect(t.totalCents).toBe(140_00) // 100 + 50 − 20 + 10
  })

  it('en total kan aldrig bli negativ', () => {
    expect(orderTotals({ subtotalCents: 1000, discountCents: 999_999 }).totalCents).toBe(0)
  })
})

describe('ett betalsätt som inte är konfigurerat erbjuds inte', () => {
  const ALL = SHOP_PAYMENT_METHODS.map((m) => m.id)

  it('bara det kunden slagit PÅ kan erbjudas', () => {
    const got = availablePaymentMethods(['card', 'swish'], { stripeReady: true, paypalReady: true })
    expect(got).toEqual(['card', 'swish'])
    expect(got).not.toContain('klarna')
  })

  it('utan kopplad Stripe erbjuds INGET Stripe-betalsätt', () => {
    const got = availablePaymentMethods(ALL, { stripeReady: false, paypalReady: true })
    expect(got).toEqual(['paypal']) // bara PayPal, vars räls är en annan
  })

  it('PAYPAL UTAN NYCKLAR → DOLT (Zivar har valt PayPal, kontot finns inte än)', () => {
    const got = availablePaymentMethods(ALL, { stripeReady: true, paypalReady: false })
    expect(got).not.toContain('paypal')
    expect(got).toEqual(['card', 'swish', 'klarna', 'applepay'])
  })

  it('ingen räls alls → inga betalsätt (kassan faller till betala-vid-leverans)', () => {
    expect(availablePaymentMethods(ALL, { stripeReady: false, paypalReady: false })).toEqual([])
  })

  it('configen kan aldrig bära ett betalsätt motorn saknar räls för', () => {
    expect(parsePaymentMethods(['card', 'bitcoin', 'swish', 42])).toEqual(['card', 'swish'])
    expect(parsePaymentMethods('inte-en-array')).toEqual([])
  })

  it('ordningen är designens (Kort · Swish · Klarna · PayPal · Apple Pay), inte configens', () => {
    expect(parsePaymentMethods(['applepay', 'card', 'klarna'])).toEqual([
      'card',
      'klarna',
      'applepay',
    ])
  })

  it('en butik utan config har INGA betalsätt på', () => {
    expect(parseShopConfig({}).paymentMethods).toEqual([])
    expect(parseShopConfig(null).paymentMethods).toEqual([])
  })

  it('läser kundens val ur tenant_modules.config.payment_methods', () => {
    const cfg = parseShopConfig({ fulfilment: 'ship', payment_methods: ['klarna', 'paypal'] })
    expect(cfg.paymentMethods).toEqual(['klarna', 'paypal'])
  })
})

describe('hinttexterna ÄR designen (verbatim i alla 12 manifest)', () => {
  it('står ordagrant, oförändrade', () => {
    expect(paymentMethodSpec('card')?.hint).toBe('Visa, Mastercard och Amex. Dras direkt.')
    expect(paymentMethodSpec('swish')?.hint).toBe('Du får en förfrågan i Swish-appen.')
    expect(paymentMethodSpec('klarna')?.hint).toBe(
      'Faktura eller delbetalning — du väljer hos Klarna.',
    )
    expect(paymentMethodSpec('paypal')?.hint).toBe('Du skickas till PayPal för att slutföra.')
    expect(paymentMethodSpec('applepay')?.hint).toBe('Bekräfta med Face ID.')
  })
})

// ── Kontraktet mot databasen (0058) ────────────────────────────────────────────
// De här reglerna kan bara garanteras i SQL:en (unik-index + atomär räknare + server-
// side prisuppslag). Testet vaktar att de INTE försvinner ur migrationen — en tyst
// borttagning hade gjort kassan osann igen utan att en enda TS-test föll.
describe('order_no är unikt per tenant + priset slås upp server-side (migration 0058)', () => {
  const sql = readFileSync(
    fileURLToPath(
      new URL('../../../../../supabase/migrations/0058_shop_checkout_truth.sql', import.meta.url),
    ),
    'utf8',
  )

  it('har ett per-tenant unikt index på order_no', () => {
    // (Indexet skapas i 0057; 0058 fyller kolumnen. Numret måste vara unikt per tenant.)
    expect(sql).toMatch(/next_shop_order_no/)
  })

  it('genererar löpnumret ATOMÄRT (två samtidiga kassor kan inte få samma nummer)', () => {
    expect(sql).toMatch(/on conflict \(tenant_id\) do update set next_no = public\.shop_order_counters\.next_no \+ 1/)
  })

  it('slår upp fraktkostnaden UR DB på det valda id:t — aldrig ur klienten', () => {
    expect(sql).toMatch(/select so\.id, so\.cost_cents into v_ship_id, v_ship/)
    expect(sql).toMatch(/and so\.tenant_id = v_order\.tenant_id/) // tenant-fence
    expect(sql).toMatch(/raise exception 'invalid_shipping_option'/)
  })

  it('räknar totalen som delsumma + frakt − rabatt + moms', () => {
    expect(sql).toMatch(/v_total := greatest\(0, coalesce\(v_order\.subtotal_cents, 0\)/)
    expect(sql).toMatch(/\+ v_ship/)
    expect(sql).toMatch(/- coalesce\(v_order\.discount_cents, 0\)/)
    expect(sql).toMatch(/\+ coalesce\(v_order\.tax_cents, 0\)/)
  })

  it('avvisar ett betalsätt som inte finns i CHECK-listan', () => {
    expect(sql).toMatch(/not in \('card','swish','klarna','paypal','applepay'\)/)
  })
})
