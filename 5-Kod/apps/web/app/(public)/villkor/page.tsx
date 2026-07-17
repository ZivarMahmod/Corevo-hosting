import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'

// VILLKORSSIDAN (plan 003 — juridikpaketet). Tenanten är säljaren och
// personuppgiftsansvarig; Corevo är plattform/biträde. Sidan är därför PER TENANT
// (namn + org-nr ur settings.legal), teman-neutral ren typografi — juridik ska se
// likadan ut på varje mall.
//
// TEXTSTATUS 2026-07-17: fullständiga standardtexter enligt distansavtalslagen
// (2005:59), konsumentköplagen (2022:260) och konsumenttjänstlagen — skrivna av
// Corevo, INTE advokatgranskade. Rekommendation: juridisk genomläsning innan
// plattformen skalar förbi de första kunderna.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Villkor' }

const WRAP: React.CSSProperties = { maxWidth: 720, margin: '0 auto', padding: '56px 24px 80px' }

export default async function VillkorPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant, settings } = bundle
  const orgNr = settings.legal.orgNr
  const email = settings.contact.email

  return (
    <main style={WRAP} className="prose">
      <h1>Villkor</h1>
      <p>
        Dessa villkor gäller när du bokar tjänster eller köper varor hos{' '}
        <strong>{tenant.name}</strong>
        {orgNr ? <> (org.nr {orgNr})</> : null}. Genom att genomföra en bokning eller ett
        köp godkänner du villkoren. Villkoren begränsar aldrig de rättigheter du har
        enligt tvingande konsumentlagstiftning.
      </p>

      <h2>Bokning av tjänster</h2>
      <p>
        När du bokar en tid ingår du ett avtal med {tenant.name} om den valda tjänsten
        vid den valda tidpunkten. Bokningen bekräftas via e-post och/eller SMS till de
        kontaktuppgifter du angett — kontrollera att de stämmer. Priset som visas vid
        bokningstillfället är det som gäller; eventuella tillägg som beställs på plats
        debiteras enligt gällande prislista.
      </p>
      <p>
        Kom i god tid. Vid sen ankomst kan behandlingstiden behöva kortas, och vid
        väsentlig försening kan tiden behöva bokas om eller räknas som uteblivet besök.
      </p>

      <h2>Avbokning, ombokning och uteblivet besök</h2>
      <p>
        Du avbokar eller ombokar kostnadsfritt via länken i din bokningsbekräftelse fram
        till den avbokningsfrist som anges vid bokningstillfället. Vid avbokning efter
        fristen, eller vid uteblivet besök, kan {tenant.name} debitera en avgift upp
        till tjänstens pris. Har du förskottsbetalat en tid och avbokar inom fristen
        återbetalas beloppet till samma betalsätt inom 14 dagar.
      </p>

      <h2>Köp av varor</h2>
      <p>
        Vid köp i webbutiken ingås avtalet när du slutför beställningen i kassan. Alla
        priser anges i svenska kronor inklusive moms. Orderbekräftelse skickas via
        e-post. Leverans sker enligt det leveranssätt du väljer i kassan; upphämtning i
        butik är kostnadsfri om inget annat anges.
      </p>

      <h2 id="angerratt">Ångerrätt vid distansköp</h2>
      <p>
        När du köper varor på distans har du 14 dagars ångerrätt enligt lagen
        (2005:59) om distansavtal och avtal utanför affärslokaler. Ångerfristen räknas
        från den dag du tar emot varan. Vill du utnyttja ångerrätten meddelar du oss
        inom fristen — använd gärna kontaktuppgifterna nedan eller Konsumentverkets
        standardformulär. Återbetalning sker inom 14 dagar från ditt meddelande, dock
        tidigast när vi fått varan i retur eller du visat att den sänts tillbaka. Du
        står för returfrakten och ansvarar för varans skick utöver vad som krävs för
        att undersöka den.
      </p>
      <p>Ångerrätten gäller inte:</p>
      <ul>
        <li>
          bokade tjänster som utförs på en bestämd dag eller under en bestämd tidsperiod
          (t.ex. en bokad behandling),
        </li>
        <li>förseglade varor som av hälso- eller hygienskäl inte kan återlämnas när förseglingen brutits,</li>
        <li>varor som specialtillverkats eller fått en tydlig personlig prägel,</li>
        <li>presentkort som redan använts helt eller delvis.</li>
      </ul>

      <h2>Presentkort</h2>
      <p>
        Presentkort gäller den giltighetstid som anges vid köpet och kan användas som
        betalning för tjänster och varor hos {tenant.name}. Presentkort löses inte in
        mot kontanter.
      </p>

      <h2>Reklamation</h2>
      <p>
        Är det fel på en vara eller tjänst har du rätt att reklamera enligt
        konsumentköplagen (2022:260) respektive konsumenttjänstlagen. Reklamera inom
        skälig tid från att du upptäckt felet — kontakta oss så hjälper vi dig med
        rättelse, omleverans, prisavdrag eller återbetalning enligt lag. Du kan även
        vända dig till Allmänna reklamationsnämnden (ARN, arn.se) eller EU:s plattform
        för tvistlösning online. Vi följer ARN:s rekommendationer.
      </p>

      <h2>Kontakt</h2>
      <p>
        {tenant.name}
        {orgNr ? <>, org.nr {orgNr}</> : null}
        {email ? (
          <>
            {' '}
            — <a href={`mailto:${email}`}>{email}</a>
          </>
        ) : null}
        . Frågor om villkoren, ångerrätt eller reklamation besvaras via
        kontaktuppgifterna ovan eller kontaktformuläret på webbplatsen.
      </p>

      <h2>Personuppgifter</h2>
      <p>
        Hur vi behandlar dina personuppgifter beskrivs i vår{' '}
        <a href="/integritetspolicy">integritetspolicy</a>.
      </p>
    </main>
  )
}
