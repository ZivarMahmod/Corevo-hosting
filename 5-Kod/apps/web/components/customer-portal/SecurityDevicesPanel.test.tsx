import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/app/(customer-portal)/mina/actions', () => ({
  revokeOtherPortalSessionsAction: vi.fn(),
  revokePortalBookingTrustsAction: vi.fn(),
}))

import { SecurityDevicesPanel } from './SecurityDevicesPanel'

describe('customer portal security and devices UI', () => {
  it('shows real controls with neutral metadata and no passwordless marketing', () => {
    const html = renderToStaticMarkup(
      <SecurityDevicesPanel
        locale="sv-SE"
        timezone="Europe/Stockholm"
        sessions={[
          {
            label: 'Den här webbläsaren',
            isCurrent: true,
            createdAt: '2026-07-20T10:00:00.000Z',
            lastSeenAt: '2026-07-23T10:00:00.000Z',
          },
          {
            label: 'Safari på iPhone',
            isCurrent: false,
            createdAt: '2026-07-19T10:00:00.000Z',
            lastSeenAt: '2026-07-22T10:00:00.000Z',
          },
        ]}
        bookingTrusts={[{
          label: 'PIN-fri bokningsenhet',
          createdAt: '2026-07-20T10:00:00.000Z',
          lastSeenAt: '2026-07-23T10:00:00.000Z',
        }]}
      />,
    )

    expect(html).toContain('Säkerhet och enheter')
    expect(html).toContain('Inloggade enheter')
    expect(html).toContain('PIN-fria bokningsenheter')
    expect(html).toContain('Logga ut andra enheter')
    expect(html).toContain('Kräv PIN nästa gång')
    expect(html).not.toMatch(/Lösenordsfri|publicId|secret|IP-adress/i)
  })
})
