import type { Metadata } from 'next'
import Link from 'next/link'
import { CreateTenantForm } from '@/components/platform/CreateTenantForm'
import styles from '@/components/platform/platform.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Ny salong' }

export default function NewTenantPage() {
  return (
    <section className="portal-section">
      <div className={styles.sectionHead}>
        <h1 style={{ margin: 0 }}>Ny salong</h1>
        <Link href="/platform/tenants" className={styles.navLink}>
          ← Salonger
        </Link>
      </div>
      <p className="prose">
        Steg 1 i onboarding-trappan. Skapar salong + unik subdomän + standard­inställningar +
        salon_admin-roll, och bjuder in salongsadmin. Salongen blir live på{' '}
        <code className={styles.code}>&lt;subdomän&gt;.corevo.se</code> direkt.
      </p>
      <CreateTenantForm />
    </section>
  )
}
