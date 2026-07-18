'use client'

import dynamic from 'next/dynamic'

const loading = () => <div aria-busy="true">Laddar partnerverktyg…</div>

export const PartnerListClientLazy = dynamic(
  () => import('./PartnerListClient').then((module) => module.PartnerListClient),
  { ssr: false, loading },
)

export const PartnerDetailClientLazy = dynamic(
  () => import('./PartnerDetailClient').then((module) => module.PartnerDetailClient),
  { ssr: false, loading },
)

export const PartnerBillingClientLazy = dynamic(
  () => import('./PartnerBillingClient').then((module) => module.PartnerBillingClient),
  { ssr: false, loading },
)
