'use client'

import { PlatformError } from '@/components/platform/PlatformError'

/** Feltillstånd för kund-adminen (goal-66, B-10).
 *
 *  Utan den här gränsen ser ett datafel ut som en TOM kalender — receptionisten tror
 *  att dagen är fri och dubbelbokar per telefon. Ett ärligt "kunde inte ladda" med en
 *  riktig Försök igen (reset() kör om serverhämtningen) är strikt bättre än en lugn
 *  lögn. Gränsen renderas INUTI adminskalet, så toppnaven finns kvar att navigera med. */
export default function AdminRouteError({ reset }: { error: Error; reset: () => void }) {
  return (
    <PlatformError
      title="Kalendern kunde inte laddas"
      message="Något gick fel när bokningarna hämtades. Ingenting är ändrat — försök igen."
      reset={reset}
    />
  )
}
