// Tenant-resolution stub test. Run with: node apps/web/scripts/verify-tenant.ts
// (Node 24 strips TS types natively.) Exits non-zero on any failure.
import { getTenantFromHost } from '../lib/tenant.ts'

let failures = 0
function check(label: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got)
  const w = JSON.stringify(want)
  const ok = g === w
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  → ${g}${ok ? '' : `   expected ${w}`}`)
}

const LIVE = {
  rootDomain: 'corevo.se',
  platformHost: 'booking.corevo.se',
  reserved: ['booking', 'admin', 'app', 'www', 'api'],
}
const DEV = { ...LIVE, rootDomain: 'localhost:3000' }

// ── live: subdomain → slug ──
check('frisor1.corevo.se', getTenantFromHost('frisor1.corevo.se', LIVE), {
  kind: 'tenant',
  slug: 'frisor1',
})
check('frisor2.corevo.se', getTenantFromHost('frisor2.corevo.se', LIVE), {
  kind: 'tenant',
  slug: 'frisor2',
})

// ── reserved subdomains never resolve to a tenant ──
check('booking.corevo.se', getTenantFromHost('booking.corevo.se', LIVE), { kind: 'platform' })
check('admin.corevo.se', getTenantFromHost('admin.corevo.se', LIVE), {
  kind: 'reserved',
  subdomain: 'admin',
})
check('app.corevo.se', getTenantFromHost('app.corevo.se', LIVE), {
  kind: 'reserved',
  subdomain: 'app',
})
check('www.corevo.se', getTenantFromHost('www.corevo.se', LIVE), {
  kind: 'reserved',
  subdomain: 'www',
})
check('api.corevo.se', getTenantFromHost('api.corevo.se', LIVE), {
  kind: 'reserved',
  subdomain: 'api',
})
check('corevo.se (root)', getTenantFromHost('corevo.se', LIVE), { kind: 'root' })

// ── extended reserved defaults (POS coexistence): no `reserved` override here, ──
// ── so the built-in 9-item default applies (superadmin/kiosk/dev/odoo). ──
const LIVE_DEFAULTS = { rootDomain: 'corevo.se', platformHost: 'booking.corevo.se' }
for (const sub of ['superadmin', 'kiosk', 'dev', 'odoo']) {
  check(`${sub}.corevo.se (reserved default)`, getTenantFromHost(`${sub}.corevo.se`, LIVE_DEFAULTS), {
    kind: 'reserved',
    subdomain: sub,
  })
}

// ── dev fallbacks ──
check('frisor1.localhost:3000', getTenantFromHost('frisor1.localhost:3000', DEV), {
  kind: 'tenant',
  slug: 'frisor1',
})
check(
  '?tenant=frisor1',
  getTenantFromHost('localhost:3000', { ...DEV, search: new URLSearchParams('tenant=frisor1') }),
  { kind: 'tenant', slug: 'frisor1' },
)
check('/t/frisor1', getTenantFromHost('localhost:3000', { ...DEV, pathname: '/t/frisor1' }), {
  kind: 'tenant',
  slug: 'frisor1',
})
check('localhost:3000 (root)', getTenantFromHost('localhost:3000', DEV), { kind: 'root' })

if (failures) {
  console.error(`\n${failures} tenant test(s) FAILED`)
  process.exit(1)
}
console.log('\nAll tenant-resolution tests passed.')
