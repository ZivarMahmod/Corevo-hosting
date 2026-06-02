import type { Metadata } from 'next'
import { CreateTenantForm } from '@/components/platform/CreateTenantForm'
import { PageHead, Button } from '@/components/portal/ui'
import styles from '@/components/platform/platform.module.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Ny salong' }

export default function NewTenantPage() {
  return (
    <section className="portal-section">
      <PageHead eyebrow="Plattform · Onboarda" title="Ny salong">
        <Button href="/salonger" variant="ghost" icon="arrowLeft">
          Salonger
        </Button>
      </PageHead>
      <p className="prose">
        Steg 1 i onboarding-trappan. Skapar salong + unik subdomän + standard­inställningar +
        salon_admin-roll, och bjuder in salongsadmin. Välj <strong>temamall</strong> och{' '}
        <strong>färgpalett</strong> så får salongen en egen look — inte en kopia. Salongen blir
        live på <code className={styles.code}>&lt;subdomän&gt;.corevo.se</code> direkt.
      </p>
      <CreateTenantForm />
    </section>
  )
}
