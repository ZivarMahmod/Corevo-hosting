import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { BookCta } from '@/components/brand/BookCta'

export const metadata: Metadata = { title: 'Kontakt' }

export default async function ContactPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle

  return (
    <section className="section">
      <div className="section-inner prose">
        <h1>Kontakt</h1>
        <p>
          Vill du boka tid hos {tenant.name}? Det gör du snabbast direkt online — välj tjänst
          och en ledig tid som passar dig.
        </p>
        <p>
          Kontaktuppgifter och adress visas här när salongen har fyllt i dem i sin profil.
        </p>
        <p>
          <BookCta />
        </p>
      </div>
    </section>
  )
}
