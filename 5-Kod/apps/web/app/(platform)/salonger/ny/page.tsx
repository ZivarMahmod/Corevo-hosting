import type { Metadata } from 'next'
import { CreateTenantForm } from '@/components/platform/CreateTenantForm'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Plattform · Onboarda salong' }

// The 5-step onboarding wizard owns its own PageHead + intro callout (design
// "Onboarda ny salong"), so the page is just the host section.
export default function NewTenantPage() {
  return (
    <section className="portal-section">
      <CreateTenantForm />
    </section>
  )
}
