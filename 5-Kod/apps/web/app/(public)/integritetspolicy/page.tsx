import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'

// INTEGRITETSPOLICY (plan 003 — juridikpaketet, GDPR art. 13/14). Tenanten är
// personuppgiftsansvarig, Corevo är personuppgiftsbiträde/plattform. Per-tenant-sida
// (namn/org-nr/kontakt ur settings), teman-neutral typografi.
//
// TEXTSTATUS 2026-07-17: fullständig standardtext enligt GDPR + bokföringslagen —
// skriven av Corevo, INTE advokatgranskad. Rekommendation: juridisk genomläsning
// innan plattformen skalar förbi de första kunderna.

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
        personuppgifter som samlas in via bokningar, köp och kontaktformulär på den här
        webbplatsen. Plattformen drivs av Corevo, som behandlar uppgifterna som
        personuppgiftsbiträde på uppdrag av {tenant.name} enligt ett
        personuppgiftsbiträdesavtal.
      </p>

      <h2>Vilka uppgifter vi behandlar</h2>
      <ul>
        <li>
          <strong>Bokning:</strong> namn, e-postadress, telefonnummer, vald tjänst och
          tid, samt eventuella önskemål du lämnar.
        </li>
        <li>
          <strong>Köp:</strong> namn, kontaktuppgifter, leveransadress och orderinnehåll.
          Kortuppgifter hanteras av vår betalleverantör (t.ex. Stripe eller PayPal) och
          lagras aldrig hos oss.
        </li>
        <li>
          <strong>Konto:</strong> inloggningsuppgifter, bokningshistorik och de
          preferenser du själv anger.
        </li>
        <li>
          <strong>Kontaktformulär:</strong> namn, kontaktuppgifter och ditt meddelande.
        </li>
      </ul>

      <h2>Ändamål och rättslig grund</h2>
      <ul>
        <li>
          Hantera bokningar och köp, skicka bekräftelser, påminnelser och kvitton —{' '}
          <em>fullgörande av avtal</em> (art. 6.1 b GDPR).
        </li>
        <li>
          Bokföring och redovisning — <em>rättslig förpliktelse</em> (art. 6.1 c,
          bokföringslagen).
        </li>
        <li>
          Svara på förfrågningar och ge kundservice — <em>berättigat intresse</em>{' '}
          (art. 6.1 f).
        </li>
        <li>
          Erbjudanden och marknadsföring — endast med ditt <em>samtycke</em> (art. 6.1 a),
          som du när som helst kan återkalla utan att det påverkar bokningsbekräftelser
          eller annan nödvändig kommunikation.
        </li>
      </ul>

      <h2>Lagringstider</h2>
      <ul>
        <li>Boknings- och kunduppgifter: så länge kundrelationen är aktiv.</li>
        <li>Bokföringsunderlag (kvitton, ordrar): 7 år enligt bokföringslagen.</li>
        <li>Kontaktmeddelanden: gallras automatiskt efter 18 månader.</li>
      </ul>

      <h2>Vilka som tar del av uppgifterna</h2>
      <p>
        Uppgifterna delas endast med de leverantörer som krävs för driften: Corevo
        (plattform och drift), betalleverantör (Stripe/PayPal) vid onlinebetalning samt
        e-post-/SMS-leverantör för bekräftelser och påminnelser. Samtliga behandlar
        uppgifterna på uppdrag och enligt avtal. Uppgifter säljs aldrig vidare.
      </p>

      <h2>Dina rättigheter</h2>
      <p>
        Du har rätt att få tillgång till dina uppgifter (registerutdrag), få felaktiga
        uppgifter rättade, bli raderad (&rdquo;rätten att bli glömd&rdquo;), invända mot behandling
        som stödjer sig på berättigat intresse, samt få ut dina uppgifter i ett
        maskinläsbart format (dataportabilitet). Har du ett konto kan du själv ladda ner
        och radera dina uppgifter från kontosidan; annars kontaktar du oss
        {email ? (
          <>
            {' '}
            på <a href={`mailto:${email}`}>{email}</a>
          </>
        ) : null}{' '}
        så hjälper vi dig utan onödigt dröjsmål. Radering påverkar inte uppgifter vi
        enligt lag måste spara (t.ex. bokföringsunderlag).
      </p>
      <p>
        Anser du att vi behandlar dina uppgifter felaktigt har du rätt att lämna
        klagomål till Integritetsskyddsmyndigheten (IMY, imy.se).
      </p>

      <h2>Cookies</h2>
      <p>
        Webbplatsen använder endast nödvändiga cookies för inloggning och
        bokningsflödet. Inga spårnings- eller marknadsföringscookies sätts.
      </p>

      <h2>Villkor</h2>
      <p>
        Våra boknings- och köpvillkor hittar du på <a href="/villkor">villkorssidan</a>.
      </p>
    </main>
  )
}
