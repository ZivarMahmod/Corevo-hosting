import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'

// INTEGRITETSPOLICY (plan 003 — juridikpaketet, GDPR art. 13). Tenanten är
// personuppgiftsansvarig, Corevo är personuppgiftsbiträde/plattform. Per-tenant-sida
// (namn/org-nr/kontakt ur settings), teman-neutral typografi.
//
// TEXTERNA ÄR STRUKTURELLA PLATSHÅLLARE: juridiskt granskad text är operatörens
// ansvar före lansering (sök JURIDIK-TEXT i koden).

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Integritetspolicy' }

const WRAP: React.CSSProperties = { maxWidth: 720, margin: '0 auto', padding: '56px 24px 80px' }

export default async function IntegritetspolicyPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const orgNr = settings.legal.orgNr
  const email = settings.contact.email

  return (
    <main style={WRAP} className="prose">
      <h1>Integritetspolicy</h1>
      <p>
        <strong>{tenant.name}</strong>
        {orgNr ? <> (org.nr {orgNr})</> : null} är personuppgiftsansvarig för de
        personuppgifter som samlas in via bokningar och köp på den här webbplatsen.
        Corevo är plattformsleverantör och behandlar uppgifterna som
        personuppgiftsbiträde på uppdrag av {tenant.name}.
      </p>

      <h2>Vilka uppgifter samlas in</h2>
      {/* JURIDIK-TEXT: granskas av operatör */}
      <p>
        Vid bokning och köp samlar vi in namn, e-postadress och telefonnummer samt
        uppgifter om din bokning eller beställning. Betalningsuppgifter hanteras av vår
        betalleverantör och lagras inte av oss.
      </p>

      <h2>Ändamål och rättslig grund</h2>
      {/* JURIDIK-TEXT: granskas av operatör */}
      <p>
        Uppgifterna används för att hantera din bokning eller ditt köp (fullgörande av
        avtal), skicka bekräftelser och påminnelser, samt uppfylla bokförings- och andra
        rättsliga skyldigheter. Marknadsföring skickas endast med ditt samtycke.
      </p>

      <h2>Lagringstid</h2>
      {/* JURIDIK-TEXT: granskas av operatör */}
      <p>
        Uppgifter sparas så länge de behövs för ändamålet. Bokföringsunderlag sparas
        enligt bokföringslagen (7 år). Kontaktmeddelanden gallras löpande.
      </p>

      <h2>Dina rättigheter</h2>
      {/* JURIDIK-TEXT: granskas av operatör */}
      <p>
        Du har rätt att begära registerutdrag, rättelse och radering av dina uppgifter,
        samt att invända mot behandling. Kontakta oss
        {email ? (
          <>
            {' '}
            på <a href={`mailto:${email}`}>{email}</a>
          </>
        ) : null}{' '}
        så hjälper vi dig. Du har också rätt att lämna klagomål till
        Integritetsskyddsmyndigheten (IMY).
      </p>

      <h2>Villkor</h2>
      <p>
        Våra boknings- och köpvillkor hittar du på <a href="/villkor">villkorssidan</a>.
      </p>
    </main>
  )
}
