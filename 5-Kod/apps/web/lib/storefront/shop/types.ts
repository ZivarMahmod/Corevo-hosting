// Webshop-modul — SHARED types + pure helpers (multi-bransch spår 5).
//
// PURE, NO I/O, NO 'server-only'. This file is imported by BOTH the server loader
// (load-shop.ts) AND the client CTA ('use client' ShopCta.tsx). It therefore must
// never import a 'server-only' module (e.g. the Supabase server client) — that
// would crash `next build` the moment a client component pulls a type from here.
// Only types + framework-agnostic helpers live here (same split as skin/types.ts).
//
// CONFIG-FIRST (beslut 14.5 / §15): the shop is ONE module with fulfilment
// VARIANTS, not a fork. The variant + its params live in tenant_modules.config;
// this module parses that jsonb into a typed ShopConfig the storefront can branch
// on. The DB tables (0032) are variant-agnostic; only presentation + the order
// snapshot differ per variant.

/** The three fulfilment variants (mirrors modules.variant_schema.fulfilment.enum
 *  in migration 0031 and the shop_orders.fulfilment CHECK in 0032). */
export const SHOP_FULFILMENTS = ['ship', 'pickup_within_days', 'order_in_then_pickup'] as const
export type ShopFulfilment = (typeof SHOP_FULFILMENTS)[number]

/** Human labels per variant (Swedish storefront copy). Kept here so the section
 *  and any admin reuse the same wording without a second source of truth. */
export const SHOP_FULFILMENT_LABELS: Record<ShopFulfilment, string> = {
  ship: 'Posta hem',
  pickup_within_days: 'Hämta i butik',
  order_in_then_pickup: 'Beställ hem till butik',
}

/**
 * BETALSÄTTEN (goal-64). Alla 12 Claude Design-paket ritar samma fem val, och
 * hinttexterna står som `verbatim` i vartenda manifest — de ÄR designen, inte
 * pynt. Därför bor de HÄR, en gång, och varje mall läser dem: ändras en text
 * ändras den i alla tolv, och ingen mall kan hitta på en egen.
 *
 * id = det som lagras i shop_orders.payment_method (CHECK i 0057).
 */
export const SHOP_PAYMENT_METHODS = [
  { id: 'card', label: 'Kort', hint: 'Visa, Mastercard och Amex. Dras direkt.', mark: 'VISA · MC' },
  { id: 'swish', label: 'Swish', hint: 'Du får en förfrågan i Swish-appen.', mark: 'Swish' },
  {
    id: 'klarna',
    label: 'Klarna',
    hint: 'Faktura eller delbetalning — du väljer hos Klarna.',
    mark: 'Klarna.',
  },
  { id: 'paypal', label: 'PayPal', hint: 'Du skickas till PayPal för att slutföra.', mark: 'PayPal' },
  { id: 'applepay', label: 'Apple Pay', hint: 'Bekräfta med Face ID.', mark: ' Pay' },
] as const

export type ShopPaymentMethod = (typeof SHOP_PAYMENT_METHODS)[number]['id']
export type ShopPaymentMethodSpec = (typeof SHOP_PAYMENT_METHODS)[number]

export const SHOP_PAYMENT_METHOD_IDS: readonly ShopPaymentMethod[] = SHOP_PAYMENT_METHODS.map(
  (m) => m.id,
)

/** Betalsätt → dess spec (label + verbatim hinttext). Okänt id → undefined. */
export function paymentMethodSpec(id: string): ShopPaymentMethodSpec | undefined {
  return SHOP_PAYMENT_METHODS.find((m) => m.id === id)
}

/**
 * Vilka betalsätt som går via KUNDENS Stripe-koppling. Kort/Swish/Klarna är
 * `payment_method_types` i Stripe Checkout; Apple Pay rider på `card` (Stripe tänder
 * plånboken automatiskt när domänen är verifierad) — den listas separat för kunden
 * eftersom designen gör det, men rälsen är samma.
 */
export const STRIPE_PAYMENT_METHODS: readonly ShopPaymentMethod[] = [
  'card',
  'swish',
  'klarna',
  'applepay',
]

/**
 * Ett betalsätts FAKTISKA tillgänglighet. Ett betalsätt som inte är konfigurerat får
 * ALDRIG renderas — hellre färre val än en knapp som ljuger. Ren funktion (testbar):
 *
 *   • kort/swish/klarna/applepay → kundens Stripe måste vara påslagen OCH ta betalt.
 *   • paypal                     → PAYPAL_CLIENT_ID/SECRET måste finnas i miljön.
 *     Zivar har VALT PayPal, men kontot finns inte än: integrationen är byggd och
 *     gatad på nycklarna, så den tänds utan ny kod den dagen de läggs in.
 */
export type PaymentAvailability = { stripeReady: boolean; paypalReady: boolean }

export function availablePaymentMethods(
  configured: readonly ShopPaymentMethod[],
  avail: PaymentAvailability,
): ShopPaymentMethod[] {
  return configured.filter((m) =>
    m === 'paypal' ? avail.paypalReady : STRIPE_PAYMENT_METHODS.includes(m) && avail.stripeReady,
  )
}

/** Ett leveransval kunden kan välja i kassan (shop_shipping_options, 0057).
 *  costCents = 0 → visas som "Fritt" (designens ord). */
export type ShippingOption = {
  id: string
  key: string
  name: string
  description: string | null
  costCents: number
}

/** Fraktpriset för ett valt alternativ — display only. Servern slår ALLTID upp priset
 *  ur DB på nytt i confirm_shop_order (klientens siffra litas aldrig på). Okänt id →
 *  0 (kassan visar aldrig ett påhittat pris). */
export function shippingCostCents(options: readonly ShippingOption[], id: string | null): number {
  if (!id) return 0
  return options.find((o) => o.id === id)?.costCents ?? 0
}

/** Fraktens etikett: 0 kr är "Fritt" i alla tolv mallar, inte "0 kr". */
export function formatShippingPrice(cents: number, currency = 'SEK'): string {
  return cents === 0 ? 'Fritt' : formatShopPrice(cents, currency)
}

/**
 * ORDERSUMMERINGEN (goal-64): total = delsumma + frakt − rabatt + moms.
 * Samma formel som confirm_shop_order räknar server-side — den här är för DISPLAY.
 * Rabattkoder är inte byggda än (discount = 0), men räkningen går genom fältet.
 */
export type OrderTotals = {
  subtotalCents: number
  shippingCents: number
  discountCents: number
  taxCents: number
  totalCents: number
}

export function orderTotals(parts: {
  subtotalCents: number
  shippingCents?: number
  discountCents?: number
  taxCents?: number
}): OrderTotals {
  const subtotalCents = Math.max(0, parts.subtotalCents)
  const shippingCents = Math.max(0, parts.shippingCents ?? 0)
  const discountCents = Math.max(0, parts.discountCents ?? 0)
  const taxCents = Math.max(0, parts.taxCents ?? 0)
  return {
    subtotalCents,
    shippingCents,
    discountCents,
    taxCents,
    totalCents: Math.max(0, subtotalCents + shippingCents - discountCents + taxCents),
  }
}

/** Parsed tenant_modules.config for the shop module. Defaults mirror 0031's
 *  default_config.
 *
 *  goal-64: `payment` var en PARKAD hook (rälsen pausad, ingen kassa renderade ett
 *  betalsteg). Nu är rälsen på: `paymentMethods` är kundens VALDA betalsätt
 *  (config.payment_methods) — tom lista = butiken tar inte betalt online och kassan
 *  faller tillbaka på "betala vid leverans/upphämtning", precis som förut. */
export type ShopConfig = {
  fulfilment: ShopFulfilment
  pickupDays: number
  leadDays: number
  currency: string
  /** Betal-hook (legacy) — behålls för bakåtkompatibilitet med gammal config-jsonb. */
  payment: { provider: string | null; enabled: boolean }
  /** goal-64: kundens påslagna betalsätt. Tom = inget online-betalsteg. */
  paymentMethods: ShopPaymentMethod[]
}

/** A buyable variant (köp-räls: the unit added to cart). `available` = stock −
 *  reserved_qty as computed by the loader; null = untracked (unlimited). */
export type ShopVariant = {
  id: string
  name: string
  priceCents: number
  currency: string
  available: number | null
  imageUrl: string | null
}

/** One storefront-facing product (subset of shop_products needed to render). */
export type ShopProduct = {
  id: string
  name: string
  description: string | null
  priceCents: number
  currency: string
  /** null = untracked (unlimited); 0 = sold out; >0 = in stock. */
  stock: number | null
  imageUrl: string | null
  imageAlt: string | null
  /** Köpbara varianter (alltid ≥1 efter 0042-seeden). */
  variants: ShopVariant[]
  /**
   * goal-64 (migration 0057) — fälten de 12 Claude Design-mallarna KRÄVDE och motorn saknade.
   * Alla är render-on-present: null → mallen renderar INGET. Aldrig en påhittad kategori
   * eller badge — en fejkad "Bästsäljare" är en lögn om kundens sortiment.
   */
  /** Butikens filterchips (calytrix "Rosor", kalla "Serum", siluett "Styling"). null = ofiltrerad. */
  category: string | null
  /** Märket över bilden ("Bästsäljare" · "DROP 27" · "FÅ KVAR"). null = inget märke. */
  badge: string | null
  /** Föregående pris → blomstertorgets kurstavla räknar ▲/▼/— ur det. null = ingen rörelse. */
  compareAtPriceCents: number | null
  /** true → priset skrivs "fr. 950 kr" (aurora p6, eloria c5 — "Floristens val"). */
  priceFrom: boolean
}

/** Everything the ShopSection needs after the loader runs. */
export type ShopData = {
  config: ShopConfig
  products: ShopProduct[]
  /**
   * De DISTINKTA kategorier kunden FAKTISKT har (härledda ur produkterna, sorterade).
   * TOM lista = mallen renderar INGA chips. Vi hittar aldrig på en kategori: designens
   * `cats = ['Alla','Buketter','Rosor',…]` var mockdata; sanningen är kundens sortiment.
   * OBS: listan är alltid HELA sortimentets kategorier, även när `activeCategory` filtrerar —
   * annars skulle chip-raden krympa bort under besökarens fingrar.
   */
  categories: string[]
  /** Vald kategori ur `/shop?kategori=Rosor`. null = "Alla"/"Allt" (ofiltrerat). */
  activeCategory: string | null
}

/**
 * Prisrörelse för en produkt — blomstertorgets kurstavla ("Pioner 149 kr ▲").
 *
 * Designens `tickerRows` bar en HÅRDKODAD pil. Nu härleds den ur verkligheten: jämför
 * dagens pris med `compare_at_price_cents` (gårdagens/ordinarie). Delad hjälpare så att
 * ingen mall räknar själv — då skulle två mallar kunna ge samma produkt olika pil.
 *
 *   priset har GÅTT UPP (compare < pris)  → 'up'    ▲
 *   priset har GÅTT NER (compare > pris)  → 'down'  ▼
 *   lika eller inget jämförelsepris       → 'flat'  —
 */
export function priceMovement(p: Pick<ShopProduct, 'priceCents' | 'compareAtPriceCents'>): 'up' | 'down' | 'flat' {
  const cmp = p.compareAtPriceCents
  if (cmp == null) return 'flat'
  if (p.priceCents > cmp) return 'up'
  if (p.priceCents < cmp) return 'down'
  return 'flat'
}

/** Pilglyfen för en prisrörelse. Delad så alla mallar ritar SAMMA tecken (filen är LAG). */
export const PRICE_MOVEMENT_ARROW: Record<'up' | 'down' | 'flat', string> = {
  up: '▲',
  down: '▼',
  flat: '—',
}

/** En kategori-chip i butikens filterrad. `active` = det urval besökaren står i just nu. */
export type ShopCategoryChip = { label: string; href: string; active: boolean }

/**
 * Butikens filterchips — LOGIKEN, delad. FORMEN ägs av mallen (den sätter klasserna).
 *
 * Vektor-regeln: modulen äger funktionen (vilka kategorier som finns, vart en chip leder,
 * vilken som är vald), mallen äger formen (calytrix segmenterade rektanglar, sivsav
 * piller, siluett understruken versal …). Utan den här delade härledningen skulle sju
 * mallar var för sig kunna få urvalet att peka fel.
 *
 * `allLabel` är mallens EGET ord för det ofiltrerade urvalet — designen säger "Alla"
 * (calytrix) respektive "Allt" (kalla/siluett/snitt/solsalt/sivsav/lunaria). Den chipen
 * saknar kategori-query och leder tillbaka till hela sortimentet.
 *
 * TOM kategori-lista → TOM chip-lista → mallen renderar ingen rad. Vi hittar aldrig på
 * en kategori som kunden inte har.
 */
export function shopCategoryChips(
  data: Pick<ShopData, 'categories' | 'activeCategory'>,
  allLabel: string,
  basePath = '/shop',
): ShopCategoryChip[] {
  if (data.categories.length === 0) return []
  return [
    { label: allLabel, href: basePath, active: data.activeCategory == null },
    ...data.categories.map((c) => ({
      label: c,
      href: `${basePath}?kategori=${encodeURIComponent(c)}`,
      active: data.activeCategory === c,
    })),
  ]
}

/**
 * goal-64 — KORGEN BÄR MER ÄN PRODUKTER.
 *
 * Alla 12 Claude Design-paket lägger presentkort i varukorgen, och Calytrix lägger
 * kursplatser där. En korgrad är därför inte längre synonym med en produktvariant.
 *
 *   'product'  — en shop_product_variants-rad (allt som fanns före goal-64).
 *   'giftcard' — ett presentkort på ett av kundens KONFIGURERADE belopp.
 *   'event'    — en kursplats på ett tenant_events-tillfälle (håller `capacity`).
 *
 * DEFAULT 'product': en rad utan `kind` (t.ex. en korg som redan ligger i någons
 * localStorage) beter sig exakt som förut. Produkt-korgen får inte ändra beteende.
 */
export const CART_LINE_KINDS = ['product', 'giftcard', 'event'] as const
export type CartLineKind = (typeof CART_LINE_KINDS)[number]

/** One line in the client-side cart (browse-fasen lever klient-sida; ordern föds
 *  vid kassa-start, 0042-arkitektur). Snapshottar pris/namn för stabil rendering;
 *  servern re-summerar ALLTID totalen (klient-pris litas aldrig på). */
export type CartLine = {
  /**
   * RADENS NYCKEL — korgens identitet, inte nödvändigtvis en variant.
   *
   * kind='product'  → variantens uuid (skickas som variant_id till reserve-RPC:n).
   * kind='giftcard' → syntetisk nyckel, t.ex. "gift:500:digital" (två olika belopp
   *                   är två rader; samma belopp igen slås ihop — precis som mockens
   *                   `id: 'gift' + amount`).
   * kind='event'    → "event:<uuid>".
   *
   * För icke-produkter är detta ALDRIG ett variant-id och skickas aldrig som ett:
   * reserveOrder grenar på `kind` och servern slår upp priset själv. Fältet heter
   * fortfarande variantId för att korgens befintliga API (setQty/removeLine) och de
   * korgar som redan ligger i localStorage ska överleva ordagrant.
   */
  variantId: string
  productId: string
  productName: string
  variantName: string
  /** Snapshot för RENDERING. Servern re-summerar alltid — priset här litas aldrig på. */
  priceCents: number
  currency: string
  quantity: number
  imageUrl: string | null
  /** available vid add-tillfället (null = ospårat). Klient-hint, servern är sanning.
   *  För en kursplats = lediga platser; presentkort har inget lager → null. */
  maxQty: number | null
  /** Utelämnad ⇒ 'product' (bakåtkompatibelt med sparade korgar). */
  kind?: CartLineKind
  /** kind='giftcard': valt belopp i HELA KRONOR. Ett VAL, inte ett pris — servern
   *  validerar det mot kundens konfigurerade lista och räknar ut ören själv. */
  giftAmount?: number
  /** kind='giftcard': 'digital' | 'in_store' (Auroras giftModes). */
  giftDeliveryMode?: 'digital' | 'in_store'
  giftRecipientName?: string
  giftRecipientEmail?: string
  giftMessage?: string
  /** kind='event': tillfällets uuid. Priset är kursens, aldrig klientens. */
  eventId?: string
}

/** Radens typ, med default. EN sanning — alla grenar läser den här, aldrig `l.kind`
 *  direkt (då blir undefined en egen fjärde sort och någon gren glöms bort). */
export function cartLineKind(line: Pick<CartLine, 'kind'>): CartLineKind {
  return line.kind ?? 'product'
}

/** Sum of a cart's line subtotals in minor units (display only — server re-sums). */
export function cartSubtotalCents(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0)
}

/** Total item count (for the cart badge). */
export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}

/** Add a line to the cart (pure). Merges into an existing line by variantId and
 *  caps the quantity at `maxQty` (available stock) when known. */
export function mergeCartLine(lines: CartLine[], line: Omit<CartLine, 'quantity'>, qty: number): CartLine[] {
  const existing = lines.find((l) => l.variantId === line.variantId)
  if (!existing) return [...lines, { ...line, quantity: Math.max(1, qty) }]
  const cap = line.maxQty ?? Infinity
  return lines.map((l) =>
    l.variantId === line.variantId ? { ...l, quantity: Math.min(l.quantity + qty, cap) } : l,
  )
}

/** Set a line's quantity (pure). Caps at maxQty, drops the line at 0/negative. */
export function setCartQty(lines: CartLine[], variantId: string, qty: number): CartLine[] {
  return lines
    .map((l) =>
      l.variantId === variantId ? { ...l, quantity: Math.max(0, Math.min(qty, l.maxQty ?? Infinity)) } : l,
    )
    .filter((l) => l.quantity > 0)
}

/**
 * goal-64 — KORGRADEN → RESERVE-RADEN (EN översättning, delad av alla kassor).
 *
 * Kassan skickar ett VAL till servern, aldrig ett pris: ett variant-id, ett belopps-
 * val eller ett tillfälles-id. reserve_shop_order (0059) slår upp priset själv ur
 * variantens price_cents / kundens konfigurerade belopp / kursens price_cents. Skulle
 * någon manipulera korgen i localStorage får de exakt ingenting — priset härifrån
 * används aldrig.
 *
 * Ligger här (pure) och inte i respektive kassa: det finns två kassor idag
 * (app/butik/kassa + calytrix), och en mall som bygger en tredje ska inte kunna
 * uppfinna en egen översättning som tappar `kind` och tyst gör presentkortet till en
 * produktrad utan variant.
 */
export type ReserveItem = {
  variantId?: string
  quantity: number
  kind?: CartLineKind
  giftAmount?: number
  giftDeliveryMode?: 'digital' | 'in_store'
  giftRecipientName?: string
  giftRecipientEmail?: string
  giftMessage?: string
  eventId?: string
}

export function cartLineToReserveItem(l: CartLine): ReserveItem {
  const kind = cartLineKind(l)
  if (kind === 'giftcard') {
    return {
      kind,
      quantity: 1, // ett presentkort = ett kort (utfärdandet nycklas per orderrad)
      giftAmount: l.giftAmount,
      giftDeliveryMode: l.giftDeliveryMode,
      giftRecipientName: l.giftRecipientName,
      giftRecipientEmail: l.giftRecipientEmail,
      giftMessage: l.giftMessage,
    }
  }
  if (kind === 'event') {
    return { kind, quantity: l.quantity, eventId: l.eventId }
  }
  return { kind: 'product', variantId: l.variantId, quantity: l.quantity }
}

const DEFAULT_SHOP_CONFIG: ShopConfig = {
  paymentMethods: [], // goal-64: inget betalsätt är på förrän kunden slår på det.
  fulfilment: 'ship',
  pickupDays: 3,
  leadDays: 7,
  currency: 'SEK',
  payment: { provider: null, enabled: false },
}

function asFulfilment(raw: unknown): ShopFulfilment {
  return (SHOP_FULFILMENTS as readonly string[]).includes(raw as string)
    ? (raw as ShopFulfilment)
    : DEFAULT_SHOP_CONFIG.fulfilment
}

function asPositiveInt(raw: unknown, fallback: number): number {
  return typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

/**
 * Defensively coerce the raw tenant_modules.config jsonb into a typed ShopConfig.
 * Robust to missing/partial config (a freshly activated draft has only the 0031
 * default; a malformed row degrades to DEFAULT_SHOP_CONFIG). The payment hook is
 * always read as disabled unless an explicit `payment.enabled === true` appears —
 * and even then the storefront does not render a pay step (rails paused).
 */
export function parseShopConfig(raw: unknown): ShopConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_SHOP_CONFIG }
  const src = raw as Record<string, unknown>
  const pay = (src.payment && typeof src.payment === 'object' ? src.payment : {}) as Record<
    string,
    unknown
  >
  return {
    fulfilment: asFulfilment(src.fulfilment),
    pickupDays: asPositiveInt(src.pickup_days, DEFAULT_SHOP_CONFIG.pickupDays),
    leadDays: asPositiveInt(src.lead_days, DEFAULT_SHOP_CONFIG.leadDays),
    currency: typeof src.currency === 'string' && src.currency ? src.currency : 'SEK',
    payment: {
      provider: typeof pay.provider === 'string' ? pay.provider : null,
      enabled: pay.enabled === true,
    },
    // goal-64: kundens påslagna betalsätt (config.payment_methods: string[]). Okända
    // strängar filtreras BORT — en trasig/manipulerad config kan aldrig få kassan att
    // erbjuda ett betalsätt motorn inte har en räls för.
    paymentMethods: parsePaymentMethods(src.payment_methods),
  }
}

/** jsonb-arrayen → validerade betalsätt (dubletter bort, okända bort, mallens ordning). */
export function parsePaymentMethods(raw: unknown): ShopPaymentMethod[] {
  if (!Array.isArray(raw)) return []
  const wanted = new Set(raw.filter((v): v is string => typeof v === 'string'))
  // Ordningen tas ur SHOP_PAYMENT_METHODS, inte ur configen: designen listar alltid
  // Kort · Swish · Klarna · PayPal · Apple Pay i den ordningen.
  return SHOP_PAYMENT_METHOD_IDS.filter((id) => wanted.has(id))
}

/** Format a minor-unit price (e.g. 14900) as a storefront string ("149 kr").
 *  Pure + currency-aware (SEK → "kr" suffix; otherwise ISO code prefix). */
export function formatShopPrice(cents: number, currency = 'SEK'): string {
  const major = (cents / 100).toLocaleString('sv-SE', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  return currency === 'SEK' ? `${major} kr` : `${major} ${currency}`
}

/**
 * EN PRODUKTS pris som besökaren ska läsa det — inklusive "från"-prefixet.
 *
 * Aurora ("Floristens val", p6) och Eloria ("No. V — Stilla farväl", c5) skriver
 * `fr. 349 kr` / `från 950 kr`: priset är ett GOLV, inte ett fast pris. Det är en egenskap
 * hos PRODUKTEN (shop_products.price_from), inte hos mallen — därför bor prefixet här och
 * inte i en mall. Alla mallar som visar ett produktpris ska kalla den här, aldrig
 * formatShopPrice direkt, annars ljuger halva sviten om samma produkt.
 */
export function formatProductPrice(
  p: Pick<ShopProduct, 'priceCents' | 'currency' | 'priceFrom'>,
): string {
  const price = formatShopPrice(p.priceCents, p.currency)
  return p.priceFrom ? `fr. ${price}` : price
}

/** The short fulfilment promise shown under the shop header, derived from the
 *  resolved config + variant params. Pure — used by the server section. */
export function fulfilmentPromise(config: ShopConfig): string {
  switch (config.fulfilment) {
    case 'ship':
      return 'Vi postar hem din beställning.'
    case 'pickup_within_days':
      return `Handla online och hämta i butik inom ${config.pickupDays} ${
        config.pickupDays === 1 ? 'dag' : 'dagar'
      }.`
    case 'order_in_then_pickup':
      return `Beställ hem varan till butiken — klar för upphämtning inom ca ${config.leadDays} ${
        config.leadDays === 1 ? 'dag' : 'dagar'
      }.`
  }
}

/** Variant-aware CTA label for a product (what the button promises the buyer). */
export function shopCtaLabel(fulfilment: ShopFulfilment): string {
  switch (fulfilment) {
    case 'ship':
      return 'Lägg i kundvagn'
    case 'pickup_within_days':
      return 'Reservera för upphämtning'
    case 'order_in_then_pickup':
      return 'Beställ till butik'
  }
}
