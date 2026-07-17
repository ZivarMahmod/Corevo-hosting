import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'

// VILLKORSSIDAN (plan 003 — juridikpaketet). Tenanten är säljaren och
// personuppgiftsansvarig; Corevo är plattform/biträde. Sidan är därför PER TENANT
// (namn + org-nr ur settings.legal), teman-neutral ren typografi — juridik ska se
// likadan ut på varje mall.
//
// TEXTERNA ÄR STRUKTURELLA PLATSHÅLLARE: juridiskt granskad text är operatörens
// ansvar före lansering (sök JURIDIK-TEXT i koden).

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Villkor' }

const WRAP: React.CSSProperties = { maxWidth: 720, margin: '0 auto', padding: '56px 24px 80px' }

export default async function VillkorPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const orgNr = settings.legal.orgNr

  return (
    <main style={WRAP} className="prose">
      <h1>Villkor</h1>
      <p>
        Dessa villkor gäller bokningar och köp hos <strong>{tenant.name}</strong>
        {orgNr ? <> (org.nr {orgNr})</> : null}.
      </p>

      <h2>Bokning och tjänster</h2>
      {/* JURIDIK-TEXT: granskas av operatör */}
      <p>
        När du bokar en tid ingår du ett avtal med {tenant.name}. Tiden är personlig och
        bekräftas via e-post och/eller SMS. Kom i god tid — vid sen ankomst kan
        behandlingen behöva kortas eller bokas om.
      </p>

      <h2>Avbokning och ombokning</h2>
      {/* JURIDIK-TEXT: granskas av operatör */}
      <p>
        Avbokning och ombokning sker via länken i din bokningsbekräftelse eller genom att
        kontakta oss. Avbokningsfristen framgår vid bokningstillfället; sen avbokning
        eller uteblivet besök kan debiteras enligt gällande prislista.
      </p>

      <h2 id="angerratt">Ångerrätt vid varuköp</h2>
      {/* JURIDIK-TEXT: granskas av operatör */}
      <p>
        Vid distansköp av varor har du 14 dagars ångerrätt enligt lagen om distansavtal
        och avtal utanför affärslokaler. Ångerrätten gäller inte tidsbestämda tjänster
        (t.ex. en bokad behandling) när tiden har avtalats till ett bestämt datum, och
        inte förseglade produkter som öppnats av hygienskäl. Kontakta oss för att utöva
        ångerrätten; återbetalning sker inom 14 dagar från att vi mottagit ditt
        meddelande och, i förekommande fall, varan i retur.
      </p>

      <h2>Reklamation</h2>
      {/* JURIDIK-TEXT: granskas av operatör */}
      <p>
        Är du inte nöjd med en vara eller tjänst — kontakta oss så snart som möjligt så
        hjälper vi dig. Du har alltid de rättigheter som följer av konsumentköplagen och
        konsumenttjänstlagen. Du kan även vända dig till Allmänna reklamationsnämnden
        (ARN).
      </p>

      <h2>Personuppgifter</h2>
      <p>
        Hur vi behandlar dina personuppgifter beskrivs i vår{' '}
        <a href="/integritetspolicy">integritetspolicy</a>.
      </p>
    </main>
  )
}
