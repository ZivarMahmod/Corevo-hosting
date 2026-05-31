import type { Metadata } from 'next'
import { getCurrentUser } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Personal' }

export default async function PersonalPage() {
  const user = await getCurrentUser()
  return (
    <section className="portal-section">
      <h1>Personalvy</h1>
      <p className="prose">
        Inloggad som {user?.email} ({user?.roleName}). Ditt schema och dina bokningar
        för dagen visas här — personal-portalen byggs i G06.
      </p>
    </section>
  )
}
