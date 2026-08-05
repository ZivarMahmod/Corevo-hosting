import { Badge, Callout, Card } from '@/components/portal/ui'
import type { ModuleState } from '@/lib/tenant-modules'

export function BookingModeCard({ current }: { current: ModuleState }) {
  const live = current === 'live'
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h2 className="h2" style={{ margin: 0 }}>Bokning</h2>
        <Badge tone={live ? 'success' : 'neutral'}>{live ? 'På' : 'Av'}</Badge>
      </div>
      <p className="body" style={{ margin: 0 }}>
        {live
          ? 'Kunder kan boka tider på din sida.'
          : 'Bokningen är helt avstängd — kunderna erbjuds ingen bokning alls. Bara Corevo kan sätta på den igen.'}
      </p>
      <Callout tone="info" icon="info">
        Modulen slås på eller av av Corevo.
      </Callout>
    </Card>
  )
}
