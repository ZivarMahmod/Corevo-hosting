import type { Metadata } from 'next'
import { PortalShell } from '@/components/customer-portal/PortalShell'

export const metadata: Metadata = {
  title: 'Hjälp · Corevo',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
}

export default function HelpPage() {
  return (
    <PortalShell variant="recovery">
      <section className="cp-recovery-screen" data-screen="hjalp" data-state="normal">
        <h1>Hjälp</h1>
        <div className="cp-card">
          <p>Mina bokningar är en säker sida där du ser och hanterar dina bokningar hos företag som använder Corevo.</p>
          <p>Din personliga länk finns i bokningsbekräftelsen du fick via SMS eller e-post. Länken fungerar bara en gång.</p>
          <p>Kommer du inte in? Begär en ny kod via länken i din bekräftelse, eller kontakta företaget du bokade hos.</p>
          <p>Frågor om en bokning, ett pris eller en avbokning besvaras av företaget du bokade hos.</p>
        </div>
      </section>
    </PortalShell>
  )
}
