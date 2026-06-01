import 'server-only'

// Swedish transactional email templates (G10 step 3). Plain, framework-free HTML
// (max email-client compatibility). Times are rendered in the salong's timezone
// with Intl (Workers-safe), so the customer sees the local time of their booking.

export type BookingEmailData = {
  tenantName: string
  serviceName: string
  startISO: string
  timeZone: string
  staffTitle?: string | null
}

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

function shell(title: string, bodyHtml: string, tenantName: string): string {
  return `<!doctype html><html lang="sv"><body style="margin:0;background:#f6f6f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:12px;padding:28px">
      <h1 style="margin:0 0 16px;font-size:20px">${esc(title)}</h1>
      ${bodyHtml}
      <p style="margin:24px 0 0;font-size:13px;color:#777">${esc(tenantName)}</p>
    </div>
    <p style="text-align:center;font-size:11px;color:#aaa;margin-top:16px">Skickat via Corevo</p>
  </div></body></html>`
}

function details(d: BookingEmailData): string {
  const when = fmt(d.startISO, d.timeZone)
  const staff = d.staffTitle ? `<tr><td style="padding:4px 0;color:#777">Hos</td><td style="padding:4px 0">${esc(d.staffTitle)}</td></tr>` : ''
  return `<table style="width:100%;font-size:15px;border-collapse:collapse">
    <tr><td style="padding:4px 0;color:#777;width:90px">Behandling</td><td style="padding:4px 0">${esc(d.serviceName)}</td></tr>
    <tr><td style="padding:4px 0;color:#777">Tid</td><td style="padding:4px 0">${esc(when)}</td></tr>
    ${staff}
  </table>`
}

export function confirmationEmail(d: BookingEmailData): { subject: string; html: string } {
  return {
    subject: `Bokningsbekräftelse — ${d.tenantName}`,
    html: shell(
      'Vi har tagit emot din bokning',
      `<p style="margin:0 0 16px;font-size:15px">Tack för din bokning! Här är dina uppgifter:</p>${details(d)}
       <p style="margin:20px 0 0;font-size:14px;color:#555">Behöver du ändra eller avboka? Logga in på ditt konto.</p>`,
      d.tenantName,
    ),
  }
}

export function cancellationEmail(d: BookingEmailData): { subject: string; html: string } {
  return {
    subject: `Avbokning bekräftad — ${d.tenantName}`,
    html: shell(
      'Din bokning är avbokad',
      `<p style="margin:0 0 16px;font-size:15px">Följande tid har avbokats:</p>${details(d)}
       <p style="margin:20px 0 0;font-size:14px;color:#555">Välkommen åter när det passar dig.</p>`,
      d.tenantName,
    ),
  }
}

export function reminderEmail(d: BookingEmailData): { subject: string; html: string } {
  return {
    subject: `Påminnelse: din tid imorgon — ${d.tenantName}`,
    html: shell(
      'Påminnelse om din tid',
      `<p style="margin:0 0 16px;font-size:15px">Vi ses snart! Här är en påminnelse om din bokade tid:</p>${details(d)}`,
      d.tenantName,
    ),
  }
}

export function receiptEmail(
  d: BookingEmailData & { amountCents: number; currency: string },
): { subject: string; html: string } {
  const amount = (d.amountCents / 100).toLocaleString('sv-SE', { minimumFractionDigits: 2 })
  const cur = d.currency.toUpperCase()
  return {
    subject: `Kvitto — ${d.tenantName}`,
    html: shell(
      'Tack för din betalning',
      `${details(d)}
       <table style="width:100%;font-size:15px;border-collapse:collapse;margin-top:8px;border-top:1px solid #eee">
         <tr><td style="padding:10px 0;color:#777">Betalt</td><td style="padding:10px 0;font-weight:600">${amount} ${esc(cur)}</td></tr>
       </table>`,
      d.tenantName,
    ),
  }
}
