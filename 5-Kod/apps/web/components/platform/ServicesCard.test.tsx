import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/platform/actions/services', () => ({
  createTenantService: async () => ({}),
  updateTenantService: async () => ({}),
  deleteTenantService: async () => ({}),
  setServiceStaff: async () => ({}),
  uploadServiceImage: async () => ({}),
  removeServiceImage: async () => ({}),
}))

import { ServicesCard } from './ServicesCard'

describe('ServicesCard assignment summary', () => {
  it('shows zero linked staff when staff exist but none are assigned', () => {
    const html = renderToStaticMarkup(
      <ServicesCard
        tenantId="tenant-1"
        storefrontUrl="https://tenant-1.boka.corevo.se"
        staff={[{ id: 'staff-1', title: 'Medarbetare', active: true }]}
        services={[
          {
            id: 'service-1',
            name: 'Tjänst',
            price_cents: 10_000,
            duration_min: 30,
            active: true,
            description: null,
            category: null,
            sale_price_cents: null,
            badge: null,
            image_url: null,
            sort_order: 0,
            staffIds: [],
            bookingCount: 0,
          },
        ]}
      />,
    )

    expect(html).toContain('Kopplad personal: 0')
    expect(html).not.toContain('alla i personalen')
  })
})
