import 'server-only'
import { accentForeground } from '@corevo/ui'

// Swedish transactional email templates — "biljett"-look (barbershop-editorial
// redesign, kanon: 4-Dokument-Underlag/01-acceptans/Frisörbokningsformulär redesign/
// design_handoff_bokningsflode — §"Confirmation e-mail" + EMAIL PREVIEW-blocket).
//
// Email is NOT the app: clients strip <link>, ignore CSS variables and won't load
// web fonts. So globals.css classes / var(--color-*) tokens DO NOT reach inboxes.
// Brand is carried by INLINE styles only, using the design-system HEX MIRROR
// (ink #211C17, paper #F3EDDF, surface #FDFBF5, line2 #D2C4A9 — README token table)
// and graceful stacks: serif via Georgia (Caslon named first for the rare client
// that has it), mono via 'Courier New'/ui-monospace. Table layout + 520px container
// for max email-client compatibility.
//
// Per-salon brand (goal-14, mechanism reused verbatim): accentColor paints the
// eyebrow, ticket price and CTA (accentForeground() keeps the CTA label legible);
// logoUrl replaces the serif wordmark at the top; slogan renders as the address/
// tagline line in the footer. "Drivs av Corevo" stays small under the card.
// accentColor falls back to Corevo gold.
//
// Times are rendered in the salong's timezone with Intl (Workers-safe), so the
// customer sees the local time of their booking.

export type BookingEmailData = {
  tenantName: string
  serviceName: string
  startISO: string
  timeZone: string
  staffTitle?: string | null
  /** Public self-service manage/cancel link (HMAC-token URL); omit/null = no link. */
  manageUrl?: string | null
  /** Fresh guest-to-account claim URL, minted only in delivery memory. */
  accountClaimUrl?: string | null
  /** Hours-before-start the guest may still cancel; null/absent = no cutoff line. */
  cancelCutoffHours?: number | null
  /** Per-salon brand (goal-14). Absent → Corevo gold + wordmark + no slogan. */
  accentColor?: string | null
  logoUrl?: string | null
  slogan?: string | null
  /** Additive (redesign): guest first name → "Vi ses, {firstName}!"; absent → neutral heading. */
  firstName?: string | null
  /** Additive (redesign): pre-formatted price ("369 kr") → "Pris (på plats)"-rad i biljetten; absent → no row. */
  priceLabel?: string | null
  /** Additive (redesign): bransch-noun for the staff row ("Barberare"/"Frisör"…); absent → "Hos". */
  staffNoun?: string | null
}

// ── Ticket palette (inline-only HEX mirror of the redesign token table) ───────
const C = {
  ink: '#211C17', // primary text + dark top-bar + ticket frame
  ink2: '#6A5F52', // secondary text / lede
  ink3: '#9E9284', // muted meta / mono labels
  paper: '#F3EDDF', // email card (warm cream)
  surface: '#FDFBF5', // ticket stub (near-white warm)
  line: '#E4DAC6', // hairline dividers
  line2: '#D2C4A9', // card border + dashed ticket dividers
  forest: '#2E5A46', // success only (✓ Betald)
  gold: '#F5A623', // platform fallback accent (per-salon accentColor wins)
  pageBg: '#E8E1D2', // page behind the card
} as const

const SERIF = `'Libre Caslon Display', Georgia, 'Times New Roman', serif`
const SANS = `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
const MONO = `'Courier New', ui-monospace, monospace`

// Mono uppercase label (ticket rows, footer rows) — the redesign's signature detail.
const LABEL = `font-family:${MONO};font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:${C.ink3}`
const VALUE = `font-family:${SANS};font-size:14px;font-weight:600;color:${C.ink}`

/** "{longDate} · kl. {time}" i salongens tidszon (biljettens Tid-rad). */
function fmt(startISO: string, timeZone: string): string {
  try {
    const d = new Date(startISO)
    const date = new Intl.DateTimeFormat('sv-SE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone,
    }).format(d)
    const time = new Intl.DateTimeFormat('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(d)
    return `${date} · kl. ${time}`
  } catch {
    return startISO
  }
}

export function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

export type EmailBrandFields = {
  accentColor?: string | null
  logoUrl?: string | null
  slogan?: string | null
}

/**
 * Resolve a salon's accent into a {bg, legible-fg} pair. A valid #rgb/#rrggbb wins;
 * anything missing/malformed falls back to Corevo gold. accentForeground() picks
 * dark vs white text so CTA labels stay readable on any accent.
 */
function resolveAccent(accentColor?: string | null): { accent: string; accentFg: string } {
  const raw = accentColor?.trim()
  const accent = raw && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw : C.gold
  return { accent, accentFg: accentForeground(accent) ?? C.ink }
}

/** Brand mark at the top: the salon logo (plain <img>) or the salon's WORDMARK in
 *  serif (24px, per the ticket design). The <img> renders ONLY for an absolute
 *  http(s):// logo URL — a blank, relative or otherwise non-absolute value falls
 *  back to the wordmark so the email never shows a broken-image icon (e.g. logo_url
 *  set but R2_PUBLIC_BASE_URL missing → a bare key would render broken). */
function brandHeader(tenantName: string, logoUrl?: string | null): string {
  const logo = logoUrl?.trim()
  if (logo && /^https?:\/\//i.test(logo)) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td>
      <img src="${esc(logo)}" alt="${esc(tenantName)}" style="display:block;max-height:46px;max-width:220px;border:0;outline:none;text-decoration:none" />
    </td></tr></table>`
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr>
      <td style="font-family:${SERIF};font-size:24px;line-height:1.1;color:${C.ink}">${esc(tenantName)}</td>
    </tr></table>`
}

/**
 * Ticket-look email chrome. Exported (additive) so other notification senders
 * (e.g. google-review.ts) reuse the exact same shell instead of diverging.
 *
 * Card max 520px on the warm page bg: 6px ink top-bar → wordmark/logo → mono accent
 * eyebrow → serif heading → body → footer (salon name + slogan/address) — and
 * "Drivs av Corevo" in mono under the card.
 *
 * - `eyebrow`: small mono uppercase label above the heading, in the salon accent.
 * - `bodyHtml`: pre-rendered inner HTML (already escaped where needed).
 * - `brand`: per-salon accent / logo / slogan (goal-14); omit for Corevo defaults.
 */
export function shell(
  title: string,
  bodyHtml: string,
  tenantName: string,
  eyebrow?: string,
  brand?: EmailBrandFields,
): string {
  const { accent } = resolveAccent(brand?.accentColor)
  const header = brandHeader(tenantName, brand?.logoUrl)
  const eyebrowHtml = eyebrow
    ? `<p style="margin:0 0 11px;font-family:${MONO};font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${accent}">${esc(eyebrow)}</p>`
    : ''
  const slogan = brand?.slogan?.trim()
  const sloganHtml = slogan
    ? `<tr><td style="padding-top:2px;font-family:${SANS};font-size:12px;color:${C.ink2}">${esc(slogan)}</td></tr>`
    : ''
  return `<!doctype html><html lang="sv"><body style="margin:0;padding:0;background:${C.pageBg};font-family:${SANS};color:${C.ink};-webkit-font-smoothing:antialiased">
  <div style="max-width:520px;margin:0 auto;padding:28px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};border:1px solid ${C.line2}">
      <tr>
        <td style="height:6px;background:${C.ink};line-height:6px;font-size:6px">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:30px 30px 26px">
          ${header}
          ${eyebrowHtml}
          <h1 style="margin:0 0 14px;font-family:${SERIF};font-size:27px;line-height:1.06;font-weight:400;color:${C.ink}">${esc(title)}</h1>
          ${bodyHtml}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid ${C.line}">
            <tr><td style="padding-top:16px;font-family:${SANS};font-size:13px;font-weight:600;color:${C.ink}">${esc(tenantName)}</td></tr>
            ${sloganHtml}
          </table>
        </td>
      </tr>
    </table>
    <p style="text-align:center;font-family:${MONO};font-size:10px;letter-spacing:.08em;color:${C.ink3};margin:16px 0 0">Drivs av Corevo</p>
  </div></body></html>`
}

/** Pull the brand fields out of a BookingEmailData for the shell. */
function brandOf(d: BookingEmailData): EmailBrandFields {
  return { accentColor: d.accentColor, logoUrl: d.logoUrl, slogan: d.slogan }
}

/** One label/value ticket row (mono uppercase label + 600-weight value). */
function ticketRow(label: string, valueHtml: string): string {
  return `<tr><td style="${LABEL};padding:6px 16px 6px 0;vertical-align:top;white-space:nowrap">${esc(label)}</td><td style="${VALUE};padding:6px 0">${valueHtml}</td></tr>`
}

/** A footer band inside the ticket (2px dashed top divider): mono label left, value right. */
function ticketFooter(label: string, valueHtml: string): string {
  return `<tr><td style="padding:12px 18px;border-top:2px dashed ${C.line2}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="${LABEL}">${esc(label)}</td>
        <td style="text-align:right">${valueHtml}</td>
      </tr></table>
    </td></tr>`
}

/** "Pris (på plats)"-footer i accentfärg — renders only when a priceLabel is present. */
function priceFooter(d: BookingEmailData, accent: string): string {
  const price = d.priceLabel?.trim()
  if (!price) return ''
  return ticketFooter(
    'Pris (på plats)',
    `<span style="font-family:${MONO};font-size:15px;font-weight:600;color:${accent}">${esc(price)}</span>`,
  )
}

/**
 * The ticket/stub: 1.5px ink frame on the warm surface, serif salon wordmark header
 * over a 2px dashed divider, then Behandling / {staffNoun} / Tid rows, plus an
 * optional footer band (price / paid amount) behind another dashed divider.
 */
function ticket(d: BookingEmailData, footerHtml = ''): string {
  const when = fmt(d.startISO, d.timeZone)
  const staffLabel = d.staffNoun?.trim() || 'Hos'
  const staff = d.staffTitle ? ticketRow(staffLabel, esc(d.staffTitle)) : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1.5px solid ${C.ink};background:${C.surface}">
    <tr><td style="padding:14px 18px;border-bottom:2px dashed ${C.line2};font-family:${SERIF};font-size:18px;color:${C.ink}">${esc(d.tenantName)}</td></tr>
    <tr><td style="padding:9px 18px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${ticketRow('Behandling', esc(d.serviceName))}
        ${staff}
        ${ticketRow('Tid', esc(when))}
      </table>
    </td></tr>
    ${footerHtml}
  </table>`
}

function lead(text: string): string {
  return `<p style="margin:0 0 20px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.ink2}">${text}</p>`
}

function note(text: string): string {
  return `<p style="margin:22px 0 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.ink2}">${text}</p>`
}

// Self-service manage block (NOTIF-GUEST): a square accent CTA linking to the public
// avboka page, plus an optional mono "senast X timmar innan"-line. Rendered only when
// a manageUrl is present; stays graceful (empty string) when absent. CTA uses the
// salon accent + a legible foreground via accentForeground() (goal-14).
function manageBlock(
  manageUrl: string | null | undefined,
  cancelCutoffHours: number | null | undefined,
  accent: string,
  accentFg: string,
): string {
  const url = manageUrl?.trim()
  if (!url) return ''
  const cutoff =
    typeof cancelCutoffHours === 'number' && Number.isFinite(cancelCutoffHours) && cancelCutoffHours > 0
      ? `<p style="margin:12px 0 0;font-family:${MONO};font-size:11px;color:${C.ink3}">Du kan avboka senast ${cancelCutoffHours} timmar innan besöket.</p>`
      : ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0">
      <tr><td style="background:${accent}">
        <a href="${esc(url)}" style="display:inline-block;padding:13px 24px;font-family:${SANS};font-size:14px;font-weight:600;color:${accentFg};text-decoration:none">Avboka eller ändra din tid</a>
      </td></tr>
    </table>${cutoff}`
}

function accountClaimBlock(
  accountClaimUrl: string | null | undefined,
  accent: string,
  accentFg: string,
): string {
  const url = accountClaimUrl?.trim()
  if (!url) return ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 0">
      <tr><td style="border:1px solid ${accent}">
        <a href="${esc(url)}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:14px;font-weight:600;color:${accent};text-decoration:none">Skapa kundkonto</a>
      </td></tr>
    </table>${note('Med ett kundkonto hittar du dina tider och slipper onödiga SMS.')}`
}

export function confirmationEmail(d: BookingEmailData): { subject: string; html: string } {
  // With a self-service manage link, show the avboka button (+ optional cutoff line)
  // instead of the generic "logga in"-note; gäster har inget konto att logga in på.
  const { accent, accentFg } = resolveAccent(d.accentColor)
  const manage = manageBlock(d.manageUrl, d.cancelCutoffHours, accent, accentFg)
  const accountClaim = accountClaimBlock(d.accountClaimUrl, accent, accentFg)
  const tail = manage
    ? manage
    : note('Behöver du ändra eller avboka? Logga in på ditt konto så fixar du det på några sekunder.')
  const first = d.firstName?.trim()
  return {
    subject: `Bokningsbekräftelse — ${d.tenantName}`,
    html: shell(
      first ? `Vi ses, ${first}!` : 'Vi ses snart!',
      `${lead('Tack för din bokning. Här är din tid — visa gärna den här biljetten när du kommer.')}${ticket(d, priceFooter(d, accent))}
       ${tail}${accountClaim}`,
      d.tenantName,
      'Bokning bekräftad',
      brandOf(d),
    ),
  }
}

/** A received request is deliberately distinct from a confirmation. This is used
 * while owner approval or a released online-payment rail is still outstanding. */
export function bookingRequestReceivedEmail(d: BookingEmailData): { subject: string; html: string } {
  const { accent, accentFg } = resolveAccent(d.accentColor)
  const manage = manageBlock(d.manageUrl, d.cancelCutoffHours, accent, accentFg)
  const accountClaim = accountClaimBlock(d.accountClaimUrl, accent, accentFg)
  return {
    subject: `Bokningsförfrågan mottagen — ${d.tenantName}`,
    html: shell(
      'Vi har tagit emot din förfrågan',
      `${lead('Tiden är inte bekräftad än. Du får ett nytt besked när verksamheten har godkänt bokningen.')}${ticket(d)}
       ${manage}${accountClaim}`,
      d.tenantName,
      'Inväntar bekräftelse',
      brandOf(d),
    ),
  }
}

export function cancellationEmail(d: BookingEmailData): { subject: string; html: string } {
  return {
    subject: `Avbokning bekräftad — ${d.tenantName}`,
    html: shell(
      'Din bokning är avbokad',
      `${lead('Följande tid har avbokats:')}${ticket(d)}
       ${note('Varmt välkommen åter när det passar dig — vi finns här.')}`,
      d.tenantName,
      'Avbokning',
      brandOf(d),
    ),
  }
}

export function reminderEmail(d: BookingEmailData): { subject: string; html: string } {
  const { accent } = resolveAccent(d.accentColor)
  return {
    subject: `Påminnelse: din tid imorgon — ${d.tenantName}`,
    html: shell(
      'En vänlig påminnelse',
      `${lead('Vi ses snart! Här är en påminnelse om din bokade tid:')}${ticket(d, priceFooter(d, accent))}
       ${note('Är du förhindrad? Logga in och omboka eller avboka i god tid.')}`,
      d.tenantName,
      'Påminnelse',
      brandOf(d),
    ),
  }
}

export function receiptEmail(
  d: BookingEmailData & {
    amountCents: number
    currency: string
    /** Plan 003 (momslagen/bokföring): org-nr + momssats ur tenantens settings.legal.
     *  null/undefined → raderna UTELÄMNAS (aldrig "varav moms (null %)"). */
    orgNr?: string | null
    vatRate?: number | null
  },
): { subject: string; html: string } {
  const amount = (d.amountCents / 100).toLocaleString('sv-SE', { minimumFractionDigits: 2 })
  const cur = d.currency.toUpperCase()
  const { accent } = resolveAccent(d.accentColor)
  const paid = ticketFooter(
    'Betalt',
    `<span style="font-family:${MONO};font-size:15px;font-weight:600;color:${accent}">${amount} ${esc(cur)}</span>`,
  )
  // Momsspecifikation: moms ingår i totalen → moms = total × sats/(100+sats), öresavrundat.
  const vatLine =
    typeof d.vatRate === 'number' && d.vatRate > 0
      ? (() => {
          const vatCents = Math.round((d.amountCents * d.vatRate) / (100 + d.vatRate))
          const vat = (vatCents / 100).toLocaleString('sv-SE', { minimumFractionDigits: 2 })
          return `<p style="margin:6px 0 0;font-size:12px;color:${C.ink2}">varav moms (${d.vatRate.toLocaleString('sv-SE')} %): ${vat} ${esc(cur)}</p>`
        })()
      : ''
  const orgLine = d.orgNr
    ? `<p style="margin:6px 0 0;font-size:12px;color:${C.ink2}">${esc(d.tenantName)} · Org.nr ${esc(d.orgNr)}</p>`
    : ''
  return {
    subject: `Kvitto — ${d.tenantName}`,
    html: shell(
      'Tack för din betalning',
      `${ticket(d, paid)}
       <p style="margin:14px 0 0;font-family:${MONO};font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${C.forest}">&#10003; Betald</p>${vatLine}${orgLine}`,
      d.tenantName,
      'Kvitto',
      brandOf(d),
    ),
  }
}

// ── Rebook / ny tid (M9, additive) ───────────────────────────────────────────
// Distinct from confirmationEmail: this is the "din tid har flyttats"-message for
// the customer-driven rebook flow (lib/kund/actions.rebookBooking). Exported and
// branded; the call site is wired by the orchestrator (see crossModuleGaps).
export function rebookEmail(d: BookingEmailData): { subject: string; html: string } {
    const { accent, accentFg } = resolveAccent(d.accentColor)
    const manage = manageBlock(d.manageUrl, d.cancelCutoffHours, accent, accentFg)
    return {
      subject: `Ny tid bekräftad — ${d.tenantName}`,
      html: shell(
        'Din nya tid är bokad',
        `${lead('Vi har flyttat din tid. Här är din uppdaterade bokning:')}${ticket(d, priceFooter(d, accent))}
         ${manage || note('Den tidigare tiden är avbokad. Behöver du ändra igen? Logga in på ditt konto.')}`,
        d.tenantName,
      'Ombokning',
      brandOf(d),
    ),
  }
}
