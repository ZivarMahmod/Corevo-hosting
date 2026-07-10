import type { Metadata } from 'next'
import { AcceptInviteForm } from './AcceptInviteForm'

export const metadata: Metadata = { title: 'Välkommen — välj lösenord' }

/**
 * Landningssida för Supabase-inbjudningslänkar (personal + salongsägare).
 * Länken i mailet landar här med sessionstokens i URL-hashen
 * (#access_token=…&refresh_token=…&type=invite) — allt jobb sker i klienten:
 * setSession → välj lösenord → vidare till rätt portal. Sidan är öppen
 * (isAlwaysAllowed i host-routing) på alla tre back-office-dörrarna.
 */
export default function ValkommenPage() {
  return <AcceptInviteForm />
}
