import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Mitt konto' }

export default async function KontoPage() {
  const user = await getCurrentUser()
  return (
    <section className="portal-section">
      <h1>Mitt konto</h1>
      <p className="prose">
        Inloggad som {user?.email}. Här samlas dina kommande och tidigare bokningar.
        Kundbokningshistoriken byggs i kund-portalen (G07).
      </p>
    </section>
  )
}
