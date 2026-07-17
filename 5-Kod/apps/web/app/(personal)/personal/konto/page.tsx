import type { Metadata } from 'next'
import Link from 'next/link'
import { requirePortal } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { AccountSecurity } from '@/components/admin/AccountSecurity'
import styles from '@/components/personal/personal-pwa.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Konto · Corevo Personal' }

export default async function PersonalAccountPage() {
  await requirePortal('personal')
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return (
    <section className={styles.profileScreen}>
      <p className={styles.profileEyebrow}>COREVO PERSONAL · SÄKERHET</p>
      <h1>Konto</h1>
      <p><Link href="/personal/profil" className={styles.todayLink}>← Min profil</Link></p>
      <AccountSecurity email={data.user?.email ?? null} lastSignInAt={data.user?.last_sign_in_at ?? null} />
    </section>
  )
}
