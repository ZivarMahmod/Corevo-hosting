import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { portalHomeFor } from '@/lib/auth/roles'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Logga in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const sp = await searchParams
  const user = await getCurrentUser()
  if (user) {
    redirect(sp.next && sp.next.startsWith('/') ? sp.next : portalHomeFor(user))
  }
  return <LoginForm next={sp.next ?? ''} />
}
