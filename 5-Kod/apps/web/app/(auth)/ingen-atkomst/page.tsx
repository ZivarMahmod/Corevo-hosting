import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/session'
import { portalHomeFor } from '@/lib/auth/roles'
import { SignOutButton } from '@/components/portal/SignOutButton'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Ingen åtkomst' }

export default async function NoAccessPage() {
  const user = await getCurrentUser()
  return (
    <div className="auth-form">
      <h1>Ingen åtkomst</h1>
      <p className="prose">Ditt konto saknar behörighet för den begärda sidan.</p>
      {user ? (
        <p className="auth-links">
          <Link href={portalHomeFor(user)}>Till din portal</Link>
        </p>
      ) : null}
      <SignOutButton />
    </div>
  )
}
