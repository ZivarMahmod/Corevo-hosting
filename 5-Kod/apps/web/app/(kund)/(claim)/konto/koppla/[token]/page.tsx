import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { currentKundTenant } from '@/lib/kund/tenant'
import { hashCustomerClaimToken } from '@/lib/kund/customer-claim'
import { consumeCustomerClaim } from '@/lib/kund/customer-claim-server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Koppla kundkonto' }

type ClaimError = 'invalid' | 'wrong_tenant'

function ClaimFailure({ kind }: { kind: ClaimError }) {
  const wrongTenant = kind === 'wrong_tenant'
  return (
    <main style={{ maxWidth: 560, margin: '48px auto', padding: 24 }}>
      <h1>Kontot kunde inte kopplas</h1>
      <p>
        {wrongTenant
          ? 'Det inloggade kontot hör till ett annat företag. Corevo kan ännu inte samla flera företag i samma kundinloggning. Logga ut och använd rätt konto, eller kontakta företaget.'
          : 'Länken är ogiltig, har gått ut eller har redan använts. Be företaget om en ny säker kontolänk.'}
      </p>
      <Link href="/login">Till inloggningen</Link>
    </main>
  )
}

export default async function CustomerClaimPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  // This route deliberately lives outside the guarded /konto layout. It is the
  // one narrow bridge for a signed-in `pending_claim` account. Every portal/data
  // route still requires an active customer; the RPC rechecks tenant/role/status.
  await requireUser(`/konto/koppla/${token}`)
  const tenant = await currentKundTenant()
  if (!tenant) return <ClaimFailure kind="wrong_tenant" />

  let tokenHash: string
  try {
    tokenHash = await hashCustomerClaimToken(token)
  } catch {
    return <ClaimFailure kind="invalid" />
  }

  const supabase = await createClient()
  const claim = await consumeCustomerClaim({
    client: supabase,
    tenantId: tenant.id,
    tokenHash,
  })
  if (!claim.ok) {
    return <ClaimFailure kind={claim.reason === 'wrong_tenant' ? 'wrong_tenant' : 'invalid'} />
  }

  redirect('/konto?kopplad=1')
}
