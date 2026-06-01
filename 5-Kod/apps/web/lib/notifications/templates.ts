import 'server-only'

// Swedish transactional email templates (G10 step 3, Corevo-branded in M9).
//
// Email is NOT the app: clients strip <link>, ignore CSS variables and won't load
// web fonts. So globals.css classes / var(--color-*) tokens DO NOT reach inboxes.
// Brand is carried by INLINE styles only, using the design-system HEX MIRROR
// (forest #1F4636, gold #F5A623, cream #F4F1EA, ink #0E1411, paper #FEFCF7) and a
// serif heading stack (Playfair named first for the rare client that has it, with
// Georgia as the real fallback — Playfair will usually NOT render in email).
// Table layout + 520px container for max email-client compatibility.
//
// Times are rendered in the salong's timezone with Intl (Workers-safe), so the
// customer sees the local time of their booking.

export type BookingEmailData = {
  tenantName: string
  serviceName: string
  startISO: string
  timeZone: string
  staffTitle?: string | null
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

/**
 * Corevo-branded email chrome. Exported (additive) so other notification senders
 * (e.g. google-review.ts) reuse the exact same shell instead of diverging.
 *
 * - `eyebrow`: small uppercase gold label above the heading (e.g. "BOKNING").
 * - `bodyHtml`: pre-rendered inner HTML (already escaped where needed).
 */
export function shell(
  title: string,
  bodyHtml: string,
  tenantName: string,
  eyebrow?: string,
): string {
  const eyebrowHtml = eyebrow
    ? `<p style="margin:0 0 10px;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.gold}">${esc(eyebrow)}</p>`
    : ''
  return `<!doctype html><html lang="sv"><body style="margin:0;padding:0;background:${C.pageBg};font-family:${SANS};color:${C.ink};-webkit-font-smoothing:antialiased">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};border-radius:16px;border:1px solid ${C.hairline};box-shadow:0 4px 24px -6px rgba(31,70,54,.12)">
      <tr>
        <td style="height:5px;background:${C.gold};border-radius:16px 16px 0 0;line-height:5px;font-size:5px">&nbsp;</td>
      </tr>
      <tr>
        <td style="padding:32px 30px 30px">
          ${eyebrowHtml}
          <h1 style="margin:0 0 18px;font-family:${SERIF};font-size:24px;line-height:1.25;font-weight:700;color:${C.forest}">${esc(title)}</h1>
          ${bodyHtml}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid ${C.hairline}">
            <tr><td style="padding-top:16px;font-family:${SANS};font-size:13px;font-weight:600;color:${C.forest}">${esc(tenantName)}</td></tr>
          </table>
        </td>
      </tr>
    </table>
    <p style="text-align:center;font-family:${SANS};font-size:11px;color:${C.forestSoft};margin:18px 0 0;letter-spacing:.04em">Skickat via <span style="color:${C.forest};font-weight:600">Corevo</span></p>
  </div></body></html>`
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

export function confirmationEmail(d: BookingEmailData): { subject: string; html: string } {
  return {
    subject: `Bokningsbekräftelse — ${d.tenantName}`,
    html: shell(
      'Vi ser fram emot ditt besök',
      `${lead('Tack för din bokning! Här är dina uppgifter:')}${details(d)}
       ${note('Behöver du ändra eller avboka? Logga in på ditt konto så fixar du det på några sekunder.')}`,
      d.tenantName,
      'Bokning bekräftad',
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
    ),
  }
}
