import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Växlar mejl-länkens engångstoken till en riktig session (SSR-cookies) och
// skickar användaren vidare. Detta är endpointen som invite-/recovery-mejlen
// (lib/auth/invite.ts, people.ts) pekar på — utan den kan en inbjuden ägare
// aldrig slutföra sin kontoaktivering (rotorsaken till "verifieringsmail
// funkar ej"). Serveras på alla back-office-hostar (host-routing isAlwaysAllowed).

const OTP_TYPES: readonly EmailOtpType[] = [
  'invite',
  'recovery',
  'signup',
  'magiclink',
  'email_change',
  'email',
]

/** Samma öppna-redirect-vakt som login: exakt en ledande '/'. */
const safeNext = (raw: string | null): string | null =>
  raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/\\') ? raw : null

export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const tokenHash = url.searchParams.get('token_hash')
  const rawType = url.searchParams.get('type')
  const type = OTP_TYPES.find((t) => t === rawType) ?? null
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))

  const supabase = await createClient()
  let ok = false
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    ok = !error
  } else if (code) {
    // Fallback för PKCE-länkar (?code=) om en Supabase-genererad länk ändå används.
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    ok = !error
  }

  if (!ok) {
    return NextResponse.redirect(new URL('/login?meddelande=ogiltig-lank', request.url))
  }
  const fallback = type === 'invite' || type === 'recovery' ? '/uppdatera-losenord' : '/'
  return NextResponse.redirect(new URL(next ?? fallback, request.url))
}
