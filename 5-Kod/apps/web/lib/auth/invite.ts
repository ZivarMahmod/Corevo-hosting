import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/notifications/email'
import { shell } from '@/lib/notifications/templates'
import { logger } from '@/lib/observability'

// App-ägd invite-kedja. Supabase Auths egen mailer (inviteUserByEmail →
// dashboard-SMTP + mall som pekar på Site URL) har aldrig fungerat i prod:
// appen saknade dessutom en /auth/confirm-endpoint som kan växla mejl-länkens
// token till en session. Den här modulen äger hela kedjan själv:
//   1) `generateLink({ type:'invite' })` skapar auth-användaren och ger oss
//      `hashed_token` — INGET mejl skickas av Supabase.
//   2) Vi bygger länken till VÅR /auth/confirm (rätt dörr-host per roll) och
//      skickar den via appens egen relay (samma som bokningsbekräftelserna,
//      one.com SMTP) — samma leveransväg som redan bevisats funka.
//   3) /auth/confirm kör verifyOtp(token_hash) → session → /uppdatera-losenord.
// Ingen Supabase-dashboard-konfig (SMTP/mallar/redirect-allowlist) behövs.

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Absolut URL till vår confirm-endpoint på rätt back-office-host. */
export function buildConfirmUrl(args: {
  host: string
  tokenHash: string
  type: 'invite' | 'recovery'
  next: string
}): string {
  const u = new URL(`https://${args.host}/auth/confirm`)
  u.searchParams.set('token_hash', args.tokenHash)
  u.searchParams.set('type', args.type)
  u.searchParams.set('next', args.next)
  return u.toString()
}

function inviteEmail(args: {
  confirmUrl: string
  tenantName?: string | null
  fullName?: string | null
}): { subject: string; html: string } {
  const brandName = args.tenantName?.trim() || 'Corevo'
  const greet = args.fullName?.trim() ? `Hej ${esc(args.fullName.trim())}!` : 'Hej!'
  const body = `
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6">${greet}</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Du har fått ett konto hos <strong>${esc(brandName)}</strong>. Klicka på knappen för att aktivera kontot och välja ditt lösenord.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td>
      <a href="${esc(args.confirmUrl)}" style="display:inline-block;padding:12px 22px;border-radius:9999px;background:#1f4636;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">Aktivera kontot</a>
    </td></tr></table>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280">Länken är personlig och giltig i 24 timmar. Väntade du dig inte det här mejlet kan du ignorera det.</p>`
  return {
    subject: `Aktivera ditt konto hos ${brandName}`,
    html: shell('Aktivera ditt konto', body, brandName, 'Inbjudan'),
  }
}

export type AuthInviteResult = { ok: true; authId: string } | { ok: false; error: string }

/**
 * Skapa auth-användaren och skicka invite-mejlet via appens egen relay.
 * Misslyckas mejlet raderas auth-användaren igen (best-effort) så anroparen
 * kan behandla hela steget som atomärt. `skipped` (relay okonfad, dev/CI)
 * räknas som OK — länken loggas så flödet går att testa lokalt.
 */
export async function sendAuthInvite(
  svc: SupabaseClient,
  args: {
    email: string
    targetHost: string
    next?: string
    tenantName?: string | null
    fullName?: string | null
    /** Extra auth user_metadata (t.ex. full_name, tenant_name). */
    data?: Record<string, unknown>
  },
): Promise<AuthInviteResult> {
  const { data: linked, error: lErr } = await svc.auth.admin.generateLink({
    type: 'invite',
    email: args.email,
    options: { data: args.data },
  })
  const tokenHash = linked?.properties?.hashed_token
  if (lErr || !linked?.user || !tokenHash) {
    return { ok: false, error: lErr?.message ?? 'okänt fel vid kontoskapande' }
  }
  const authId = linked.user.id

  const confirmUrl = buildConfirmUrl({
    host: args.targetHost,
    tokenHash,
    type: 'invite',
    next: args.next ?? '/uppdatera-losenord',
  })
  const mail = inviteEmail({ confirmUrl, tenantName: args.tenantName, fullName: args.fullName })
  const sent = await sendEmail({ to: args.email, subject: mail.subject, html: mail.html })

  if (!sent.ok && !sent.skipped) {
    // Mejlet kom aldrig iväg → ta bort den nyskapade auth-identiteten så att
    // ett omförsök med samma e-post inte stupar på "kontot finns redan".
    await svc.auth.admin.deleteUser(authId).catch(() => {})
    return { ok: false, error: `invite-mejlet kunde inte skickas (${sent.error ?? 'relay-fel'})` }
  }
  if (!sent.ok && sent.skipped) {
    logger.info('auth.invite.relay_unset — confirm-länk (endast dev)', { confirmUrl })
  }
  return { ok: true, authId }
}
