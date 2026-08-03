import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../../..')
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8')

test.describe('05 Kundportal och PWA — source contract @readonly @contract', () => {
  test('05-C01 premiumskalet använder den låsta visuella kanonen responsivt', () => {
    const css = read('apps/web/app/(customer-portal)/portal.css')
    const rootLayout = read('apps/web/app/layout.tsx')

    expect(css).toContain('--surface-dark:#191a17')
    expect(css).toContain('--bg:#f3efe6')
    expect(css).toContain('--copper:#a97141')
    expect(css).toContain('--positive:#466a57')
    expect(css).toContain('@media (min-width:780px)')
    expect(css).toContain('.cp-bottomnav')
    expect(css).toContain('.cp-sidenav')
    expect(rootLayout).toContain('Spectral')
  })

  test('05-C02 riktiga portalvägar och funktioner finns utan kundcopy om inloggningsmetoden', () => {
    const shell = read('apps/web/components/customer-portal/PortalShell.tsx')
    const profile = read('apps/web/components/customer-portal/CustomerProfileCard.tsx')
    const booking = read('apps/web/components/customer-portal/PortalViews.tsx')
    const securityRoute = read('apps/web/app/(customer-portal)/mina/sakerhet/page.tsx')
    const installRoute = read('apps/web/app/(customer-portal)/mina/installera/page.tsx')
    const customerUi = [shell, profile, booking, securityRoute, installRoute].join('\n')

    expect(profile).toContain('/mina/sakerhet')
    expect(profile).toContain('/mina/installera')
    expect(booking).toContain('CalendarDownloadButton')
    expect(booking).toContain('CancelBookingDialog')
    expect(booking).toContain('BookAgainButton')
    expect(securityRoute).toContain('SecurityDevicesPanel')
    expect(installRoute).toContain('InstallPromptCard')
    expect(customerUi).not.toMatch(/lösenordsfri|passwordless/i)
  })

  test('05-C03 manifest och installation är neutrala och cachar ingen portaldata', () => {
    const manifest = JSON.parse(read('apps/web/public/pwa/customer-portal.webmanifest'))
    const install = read('apps/web/components/customer-portal/InstallPromptCard.tsx')
    const portalLayout = read('apps/web/app/(customer-portal)/layout.tsx')

    expect(manifest).toMatchObject({
      name: 'Mina bokningar · Corevo',
      short_name: 'Mina bokningar',
      start_url: '/mina/',
      scope: '/mina/',
    })
    expect(JSON.stringify(manifest)).not.toMatch(/customerName|tenantName|bookingId/)
    expect(install).toContain('beforeinstallprompt')
    expect(install).toContain('dismissed_twice')
    expect(portalLayout).toContain('/pwa/customer-portal.webmanifest')
    expect(portalLayout).not.toMatch(/serviceWorker|kund-sw\.js/)
  })

  test('05-C04 säkerhets- och enhetsdata passerar endast smal service-role-RPC', () => {
    const migration = read(
      'supabase/migrations/0126_customer_portal_security_devices.sql',
    ).toLowerCase()
    const data = read('apps/web/lib/customer-portal/security-devices.ts')

    expect(migration).toContain('create or replace function public.customer_portal_security_snapshot')
    expect(migration).toContain("security definer")
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('to service_role')
    expect(migration).not.toMatch(
      /grant execute on function public\.customer_portal_security_snapshot[\s\S]*?to (anon|authenticated)/,
    )
    expect(data).toContain("rpc('customer_portal_security_snapshot'")
  })

  test('05-C05 portalsnapshoten använder PostgreSQL-säkra regexgränser', () => {
    const base = read('supabase/migrations/0120_customer_portal_security.sql')
    const repair = read(
      'supabase/migrations/0128_customer_portal_postgres_regex_fix.sql',
    )

    expect(base).not.toContain('{1,2000}')
    expect(base).toContain("pg_catalog.length(ts.branding ->> 'logo_url') between 9 and 2008")
    expect(repair).toContain('private.customer_portal_session_snapshot')
    expect(repair).toContain('customer_portal_regex_fix_failed')
  })
})
