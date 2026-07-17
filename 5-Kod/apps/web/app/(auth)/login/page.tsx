import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { portalHomeFor } from '@/lib/auth/roles'
import { safeInternalRedirectPath } from '@/lib/auth/internal-redirect'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Logga in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const sp = await searchParams
  const next = safeInternalRedirectPath(sp.next)
  const user = await getCurrentUser()
  if (user) {
    redirect(next ?? portalHomeFor(user))
  }
  return <LoginForm next={next ?? ''} />
}
