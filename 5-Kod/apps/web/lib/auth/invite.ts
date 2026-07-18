// Delad redirect-URL för Supabase-inbjudningar. Utan explicit redirectTo faller
// inviteUserByEmail tillbaka på projektets Site URL (var localhost:3000 →
// "Kan inte nå den här sidan", Zivar 2026-07-11). Länken landar på /valkommen
// (välj-lösenord-sidan) på rätt dörr. OBS: URL:en måste finnas i Supabase
// Auth → URL Configuration → Redirect URLs, annars ignoreras den tyst.

const DEFAULT_PLATFORM = 'booking.corevo.se'
/** Staff och admin accepterar invite på den primära booking-dörren. */
export function inviteRedirectUrl(door: 'staff' | 'admin'): string {
  void door
  const host = process.env.NEXT_PUBLIC_PLATFORM_HOST ?? DEFAULT_PLATFORM
  return `https://${host}/valkommen`
}
