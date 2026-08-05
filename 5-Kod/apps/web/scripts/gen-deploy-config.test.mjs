import { describe, expect, it } from 'vitest'
import {
  buildRoutes,
  createDeployConfig,
  REQUIRED_FIXED_HOSTS,
} from './gen-deploy-config.mjs'

const BASE = [
  { pattern: 'booking.corevo.se', custom_domain: true },
  { pattern: 'superbooking.corevo.se', custom_domain: true },
  { pattern: 'minbooking.corevo.se', custom_domain: true },
  { pattern: 'mina.corevo.se', custom_domain: true },
]

describe('production deploy domain union', () => {
  it('includes every live tenant host, so a rebuild cannot detach it', () => {
    const routes = buildRoutes(BASE, ['freshcut.corevo.se', 'velo.corevo.se'])
    expect(routes.map((route) => route.pattern)).toEqual([
      ...REQUIRED_FIXED_HOSTS,
      'freshcut.corevo.se',
      'velo.corevo.se',
    ])
  })

  it('deduplicates Cloudflare output without changing fixed routes', () => {
    const routes = buildRoutes(BASE, ['VELO.COREVO.SE', 'velo.corevo.se', 'booking.corevo.se'])
    expect(routes.map((route) => route.pattern)).toEqual([...REQUIRED_FIXED_HOSTS, 'velo.corevo.se'])
  })

  it('fails before deploy when a committed platform door is missing', () => {
    expect(() => buildRoutes(BASE.filter((route) => route.pattern !== 'mina.corevo.se'), [])).toThrow(
      /mina\.corevo\.se/,
    )
  })

  it('keeps config fields while replacing only routes with the live union', () => {
    const config = createDeployConfig(
      JSON.stringify({ name: 'worker', main: './worker.mjs', routes: BASE }),
      ['freshcut.corevo.se'],
    )
    expect(config).toMatchObject({ name: 'worker', main: './worker.mjs' })
    expect(config.routes.map((route) => route.pattern)).toContain('freshcut.corevo.se')
  })
})
