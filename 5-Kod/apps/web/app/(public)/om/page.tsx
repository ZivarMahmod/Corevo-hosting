import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { BookCta } from '@/components/brand/BookCta'

export const metadata: Metadata = { title: 'Om oss' }

export default async function AboutPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle

  return (
    <section className="section">
      <div className="section-inner prose">
        <h1>Om {tenant.name}</h1>
        <p>
          {tenant.name} är en salong där hantverk, kvalitet och personlig service står i
          centrum. Vårt mål är att du ska lämna oss nöjd – varje gång.
        </p>
        <p>
          Vi tar emot både nya och återkommande gäster. Boka enkelt online och välj den tid
          som passar dig bäst.
        </p>
        <p>
          <BookCta />
        </p>
      </div>
    </section>
  )
}
