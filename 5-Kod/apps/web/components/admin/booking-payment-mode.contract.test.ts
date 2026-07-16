import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('bokningsdetaljens betalningscopy', () => {
  it('visar Stripe-varning bara när onlinebetalning faktiskt är aktiv', () => {
    const drawer = read('components/admin/BookingDrawer.tsx')
    const board = read('components/admin/CalendarBoard.tsx')
    const page = read('app/(admin)/admin/bokningar/page.tsx')

    expect(drawer).toContain('onlinePaymentsActive')
    expect(drawer).toContain('onlinePaymentsActive &&')
    expect(board).toContain('onlinePaymentsActive')
    expect(page).toContain('onlinePaymentsActive={tenant.paymentsEnabled && tenant.stripeChargesEnabled}')
  })
})
