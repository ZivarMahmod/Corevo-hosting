import { requirePortal } from '@/lib/auth/session'
import { PortalShell } from '@/components/portal/PortalShell'
import { PersonalNav } from '@/components/personal/PersonalNav'

export const dynamic = 'force-dynamic'

export default async function PersonalLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortal('personal')
  return (
    <PortalShell user={user} title="Personal" world="backoffice">
      <PersonalNav />
      {children}
    </PortalShell>
  )
}
