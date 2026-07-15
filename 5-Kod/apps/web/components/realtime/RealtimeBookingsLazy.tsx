'use client'

import dynamic from 'next/dynamic'

// Prestanda B3: RealtimeBookings är en osynlig prenumerant (return null) som drar in
// HELA Supabase-browserklienten inkl. realtidstransporten (~200 kB okomprimerat /
// ~55-70 kB gzip) på VARJE back-office-sida — även /admin/tjänster som inte har någon
// realtidsdata. Den gör ett riktigt jobb (router.refresh() när någon bokar) och får inte
// raderas, men den behövs inte för första paint. next/dynamic med ssr:false laddar den i
// en egen chunk EFTER hydrering → av den kritiska JS-vägen på varje admin/personal/
// platform-sida. ssr:false kräver en klientkomponent, därför den här tunna wrappern
// (server-layouterna kan inte sätta ssr:false själva).
const RealtimeBookings = dynamic(
  () => import('./RealtimeBookings').then((m) => m.RealtimeBookings),
  { ssr: false },
)

export function RealtimeBookingsLazy({ tenantId }: { tenantId?: string }) {
  return <RealtimeBookings tenantId={tenantId} />
}
