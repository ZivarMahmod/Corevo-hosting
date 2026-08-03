import { Badge, Callout, Card } from '@/components/portal/ui'
import { BOOKING_MODE_COPY, type BookingMode } from '@/lib/admin/booking-mode'

export function BookingModeCard({ current }: { current: BookingMode }) {
  return (
    <Card style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <h2 className="h2" style={{ margin: 0 }}>Bokning</h2>
        <Badge tone={current === 'pa' ? 'success' : 'neutral'}>
          {BOOKING_MODE_COPY[current].label}
        </Badge>
      </div>
      <p className="body" style={{ margin: 0 }}>
        {BOOKING_MODE_COPY[current].consequence}
      </p>
      <Callout tone="info" icon="info">
        Modulen slås på eller av av Corevo.
      </Callout>
    </Card>
  )
}
