import { describe, expect, it } from 'vitest'
import { isAllowedPortalPostOrigin } from './origin'

const request = (url: string, origin?: string, host?: string) =>
  new Request(url, {
    method: 'POST',
    headers: {
      ...(origin ? { origin } : {}),
      ...(host ? { host } : {}),
    },
  })

describe('customer portal POST origin fence', () => {
  it('allows only same-origin HTTPS on mina.corevo.se', () => {
    expect(
      isAllowedPortalPostOrigin(
        request('https://mina.corevo.se/api/customer-portal/exchange', 'https://mina.corevo.se'),
      ),
    ).toBe(true)
    expect(
      isAllowedPortalPostOrigin(
        request('https://mina.corevo.se/api/customer-portal/exchange', 'https://evil.example'),
      ),
    ).toBe(false)
    expect(
      isAllowedPortalPostOrigin(
        request('https://freshcut.corevo.se/api/customer-portal/exchange', 'https://freshcut.corevo.se'),
      ),
    ).toBe(false)
    expect(
      isAllowedPortalPostOrigin(request('https://mina.corevo.se/api/customer-portal/exchange')),
    ).toBe(false)
  })

  it('allows explicit same-origin localhost and workers.dev previews only', () => {
    expect(
      isAllowedPortalPostOrigin(
        request('http://localhost:3000/api/customer-portal/exchange', 'http://localhost:3000'),
      ),
    ).toBe(true)
    expect(
      isAllowedPortalPostOrigin(
        request(
          'https://bokningsplatformen.zivar68.workers.dev/api/customer-portal/exchange',
          'https://bokningsplatformen.zivar68.workers.dev',
        ),
      ),
    ).toBe(true)
    expect(
      isAllowedPortalPostOrigin(
        request(
          'https://bokningsplatformen.zivar68.workers.dev/api/customer-portal/exchange',
          'https://other.workers.dev',
        ),
      ),
    ).toBe(false)
  })

  it('rejects a Host header that disagrees with the request URL', () => {
    expect(
      isAllowedPortalPostOrigin(
        request(
          'https://mina.corevo.se/api/customer-portal/exchange',
          'https://mina.corevo.se',
          'evil.example',
        ),
      ),
    ).toBe(false)
  })
})
