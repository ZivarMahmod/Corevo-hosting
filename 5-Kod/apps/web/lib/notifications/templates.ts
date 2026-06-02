import 'server-only'
import { accentForeground } from '@corevo/ui'

// Swedish transactional email templates (G10 step 3; per-salon branded in goal-14).
//
// Email is NOT the app: clients strip <link>, ignore CSS variables and won't load
// web fonts. So globals.css classes / var(--color-*) tokens DO NOT reach inboxes.
// Brand is carried by INLINE styles only, using the design-system HEX MIRROR
// (forest #1F4636, gold #F5A623, cream #F4F1EA, ink #0E1411, paper #FEFCF7) and a
// serif heading stack (Playfair named first for the rare client that has it, with
// Georgia as the real fallback — Playfair will usually NOT render in email).
// Table layout + 520px container for max email-client compatibility.
//
// Per-salon brand (goal-14): the shell paints the salon's accent colour on the
// top-bar, eyebrow and CTA, shows the salon logo (or a monogram fallback) at the
// top and its slogan in the footer. "Drivs av Corevo" stays small in the foot.
// accentColor falls back to Corevo gold; accentForeground() keeps CTA text legible.
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
  /** Hours-before-start the guest may still cancel; null/absent = no cutoff line. */
  cancelCutoffHours?: number | null
  /** Per-salon brand (goal-14). Absent → Corevo gold + monogram + no slogan. */
  accentColor?: string | null
  logoUrl?: string | null
  slogan?: string | null
}

// ── Corevo brand palette (inline-only HEX mirror of design-system.md §2) ──────
const C = {
  forest: '#1F4636',
  forestDeep: '#163127',
  forestSoft: '#4A8170',
  gold: '#F5A623',
  goldDeep: '#D4AF37',
  goldMuted: '#EBD9B8',
  ink: '#0E1411',
  cream: '#F4F1EA',
  paper: '#FEFCF7',
  pageBg: '#F4F1EA',
  meta: '#677E73',
  hairline: '#DCE5DF',
  success: '#36A165',
} as const

const SERIF = `'Playfair Display', Georgia, 'Times New Roman', serif`
const SANS = `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`

function fmt(startISO: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(new Date(startISO))
  } catch {
    return startISO
  }
}

function esc(s: string): string {
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
 * dark-forest vs white text so CTA labels stay readable on any accent.
 */
function resolveAccent(accentColor?: string | null): { accent: string; accentFg: string } {
  const raw = accentColor?.trim()
  const accent = raw && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw) ? raw : C.gold
  return { accent, accentFg: accentForeground(accent) ?? '#15281f' }
}

/** Brand mark at the top: the salon logo (plain <img>) or a monogram in an accent
 *  circle when no logo is uploaded. */
function brandHeader(tenantName: string, accent: string, accentFg: string, logoUrl?: string | null): string {
  const logo = logoUrl?.trim()
  if (logo) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td>
      <img src="${esc(logo)}" alt="${esc(tenantName)}" style="display:block;max-height:46px;max-width:220px;border:0;outline:none;text-decoration:none" />
    </td></tr></table>`
  }
  const initial = esc((tenantName.trim()[0] ?? 'C').toUpperCase())
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr>
      <td style="width:46px;height:46px;border-radius:9999px;background:${accent};text-align:center;vertical-align:middle;font-family:${SERIF};font-size:21px;font-weight:700;color:${accentFg};line-height:46px">${initial}</td>
    </tr></table>`
}

/**
 * Corevo-branded email chrome. Exported (additive) so other notification senders
 * (e.g. google-review.ts) reuse the exact same shell instead of diverging.
 *
 * - `eyebrow`: small uppercase label above the heading, in the salon accent.
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
  const { accent, accentFg } = resolveAccent(brand?.accentColor)
  const header = brandHeader(tenantName, accent, accentFg, brand?.logoUrl)
  const eyebrowHtml = eyebrow
    ? `<p style="margin:0 0 10px;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${accent}">${esc(eyebrow)}</p>`
    : ''
  const slogan = brand?.slogan?.trim()
  const sloganHtml = slogan
    ? `<tr><td style="padding-top:3px;font-family:${SANS};font-size:12px;color:${C.meta}">${esc(slogan)}</td></tr>`
    : ''
  return `<!doctype html><html lang="sv"><body style="margin:0;padding:0;background:${C.pageBg};font-family:${SANS};color:${C.ink};-webkit-font-smoothing:antialiased">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};border-radius:16px;border:1px solid ${C.hairline};box-shadow:0 4px 24px -6px rgba(31,70,54,.12)">
      <tr>
        <td style="height:5px;background:${accent};border-radius:16px 16px 0 0;line-height:5px;font-size:5px">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:32px 30px 30px">
          ${header}
          ${eyebrowHtml}
          <h1 style="margin:0 0 18px;font-family:${SERIF};font-size:24px;line-height:1.25;font-weight:700;color:${C.forest}">${esc(title)}</h1>
          ${bodyHtml}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid ${C.hairline}">
            <tr><td style="padding-top:16px;font-family:${SANS};font-size:13px;font-weight:600;color:${C.forest}">${esc(tenantName)}</td></tr>
            ${sloganHtml}
          </table>
        </td>
      </tr>
    </table>
    <p style="text-align:center;font-family:${SANS};font-size:11px;color:${C.forestSoft};margin:18px 0 0;letter-spacing:.04em">Drivs av <span style="color:${C.forest};font-weight:600">Corevo</span></p>
  </div></body></html>`
}

/** Pull the brand fields out of a BookingEmailData for the shell. */
function brandOf(d: BookingEmailData): EmailBrandFields {
  return { accentColor: d.accentColor, logoUrl: d.logoUrl, slogan: d.slogan }
}

function details(d: BookingEmailData): string {
  const when = fmt(d.startISO, d.timeZone)
  const label = `font-family:${SANS};font-size:13px;color:${C.meta};padding:7px 0;vertical-align:top`
  const value = `font-family:${SANS};font-size:15px;color:${C.ink};padding:7px 0;font-weight:500`
  const staff = d.staffTitle
    ? `<tr><td style="${label};width:96px">Hos</td><td style="${value}">${esc(d.staffTitle)}</td></tr>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.cream};border-radius:12px;padding:6px 16px;margin:4px 0 0">
    <tr><td style="${label};width:96px">Behandling</td><td style="${value}">${esc(d.serviceName)}</td></tr>
    <tr><td style="${label}">Tid</td><td style="${value}">${esc(when)}</td></tr>
    ${staff}
  </table>`
}

function lead(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.ink}">${text}</p>`
}

function note(text: string): string {
  return `<p style="margin:22px 0 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.meta}">${text}</p>`
}

// Self-service manage block (NOTIF-GUEST): an accent pill linking to the public
// avboka page, plus an optional "senast X timmar innan"-line. Rendered only when a
// manageUrl is present; stays graceful (empty string) when absent. CTA uses the
// salon accent + a legible foreground (goal-14).
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
      ? `<p style="margin:12px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:${C.meta}">Du kan avboka senast ${cancelCutoffHours} timmar innan besöket.</p>`
      : ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 0">
      <tr><td style="border-radius:9999px;background:${accent}">
        <a href="${esc(url)}" style="display:inline-block;padding:12px 26px;font-family:${SANS};font-size:14px;font-weight:700;color:${accentFg};text-decoration:none;border-radius:9999px">Avboka eller ändra din tid</a>
      </td></tr>
    </table>${cutoff}`
}

export function confirmationEmail(d: BookingEmailData): { subject: string; html: string } {
  // With a self-service manage link, show the avboka button (+ optional cutoff line)
  // instead of the generic "logga in"-note; gäster har inget konto att logga in på.
  const { accent, accentFg } = resolveAccent(d.accentColor)
  const manage = manageBlock(d.manageUrl, d.cancelCutoffHours, accent, accentFg)
  const tail = manage
    ? manage
    : note('Behöver du ändra eller avboka? Logga in på ditt konto så fixar du det på några sekunder.')
  return {
    subject: `Bokningsbekräftelse — ${d.tenantName}`,
    html: shell(
      'Vi ser fram emot ditt besök',
      `${lead('Tack för din bokning! Här är dina uppgifter:')}${details(d)}
       ${tail}`,
      d.tenantName,
      'Bokning bekräftad',
      brandOf(d),
    ),
  }
}

export function cancellationEmail(d: BookingEmailData): { subject: string; html: string } {
  return {
    subject: `Avbokning bekräftad — ${d.tenantName}`,
    html: shell(
      'Din bokning är avbokad',
      `${lead('Följande tid har avbokats:')}${details(d)}
       ${note('Varmt välkommen åter när det passar dig — vi finns här.')}`,
      d.tenantName,
      'Avbokning',
      brandOf(d),
    ),
  }
}

export function reminderEmail(d: BookingEmailData): { subject: string; html: string } {
  return {
    subject: `Påminnelse: din tid imorgon — ${d.tenantName}`,
    html: shell(
      'En vänlig påminnelse',
      `${lead('Vi ses snart! Här är en påminnelse om din bokade tid:')}${details(d)}
       ${note('Är du förhindrad? Logga in och omboka eller avboka i god tid.')}`,
      d.tenantName,
      'Påminnelse',
      brandOf(d),
    ),
  }
}

export function receiptEmail(
  d: BookingEmailData & { amountCents: number; currency: string },
): { subject: string; html: string } {
  const amount = (d.amountCents / 100).toLocaleString('sv-SE', { minimumFractionDigits: 2 })
  const cur = d.currency.toUpperCase()
  const label = `font-family:${SANS};font-size:14px;color:${C.meta};padding:12px 0`
  return {
    subject: `Kvitto — ${d.tenantName}`,
    html: shell(
      'Tack för din betalning',
      `${details(d)}
       <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;border-top:1px solid ${C.hairline}">
         <tr>
           <td style="${label}">Betalt</td>
           <td style="${label};text-align:right;font-size:18px;font-weight:700;color:${C.forest}">${amount} ${esc(cur)}</td>
         </tr>
       </table>
       <p style="margin:6px 0 0;display:inline-block;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.success}">&#10003; Betald</p>`,
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
  return {
    subject: `Ny tid bekräftad — ${d.tenantName}`,
    html: shell(
      'Din nya tid är bokad',
      `${lead('Vi har flyttat din tid. Här är din uppdaterade bokning:')}${details(d)}
       ${note('Den tidigare tiden är avbokad. Behöver du ändra igen? Logga in på ditt konto.')}`,
      d.tenantName,
      'Ombokning',
      brandOf(d),
    ),
  }
}
