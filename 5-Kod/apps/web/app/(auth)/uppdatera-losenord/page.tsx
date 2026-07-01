import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PasswordForm } from './PasswordForm'

export const metadata: Metadata = { title: 'Välj lösenord' }

// Landningssida efter /auth/confirm (invite + recovery): sessionen finns redan
// (verifyOtp satte cookies), här väljer användaren sitt lösenord. Utan session
// är sidan meningslös → till login.
export default async function UpdatePasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?meddelande=ogiltig-lank')
  return <PasswordForm email={user.email ?? ''} />
}
