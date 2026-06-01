import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ProfileForm } from '@/components/kund/ProfileForm'
import { GdprControls } from '@/components/kund/GdprControls'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Min profil' }

export default async function ProfilePage() {
  const user = await requirePortal('kund')
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const fullName = ((authUser?.user_metadata ?? {}) as { full_name?: string }).full_name ?? ''

  const { data: profile } = await supabase
    .from('users')
    .select('phone')
    .eq('id', user.id)
    .maybeSingle()

  return (
    <section className="portal-section">
      <Link href="/konto" className="prose">
        ← Mina tider
      </Link>
      <h1>Min profil</h1>
      <ProfileForm email={user.email} name={fullName} phone={profile?.phone ?? ''} />
      <GdprControls />
    </section>
  )
}
