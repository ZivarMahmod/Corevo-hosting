import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { portalHomeFor } from '@/lib/auth/roles'
import { LoginForm } from './LoginForm'

export const metadata: Metadata = { title: 'Logga in' }

const NOTICES: Record<string, string> = {
  'ogiltig-lank': 'Länken är ogiltig eller har gått ut. Logga in, eller be om en ny länk.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; meddelande?: string }>
}) {
  const sp = await searchParams
  const user = await getCurrentUser()
  if (user) {
    // Samma öppna-redirect-vakt som signIn: exakt en ledande '/'.
    const safe = sp.next && sp.next.startsWith('/') && !sp.next.startsWith('//') && !sp.next.startsWith('/\\')
    redirect(safe && sp.next ? sp.next : portalHomeFor(user))
  }
  return <LoginForm next={sp.next ?? ''} notice={sp.meddelande ? NOTICES[sp.meddelande] : undefined} />
}
