import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { safeInternalRedirectPath } from './internal-redirect'

describe('safeInternalRedirectPath', () => {
  it.each(['/', '/admin', '/admin/bokningar?vy=dag#nu', '/admin/installningar/%C3%A5tkomst'])(
    'preserves the internal path %s',
    (path) => {
      expect(safeInternalRedirectPath(path)).toBe(path)
    },
  )

  it('rejects external, ambiguous and control-character variants', () => {
    const unsafe = [
      null,
      undefined,
      '',
      'admin',
      ' /admin',
      'https://evil.example/admin',
      'http://evil.example/admin',
      'javascript:alert(1)',
      'data:text/html,evil',
      '//evil.example/admin',
      '///evil.example/admin',
      '\\\\evil.example\\admin',
      '/\\evil.example/admin',
      '/admin\\users',
      '/admin\u0000/users',
      '/admin\r\nLocation: //evil.example',
      '/admin\t/users',
      '/admin%00/users',
      '/admin%09/users',
      '/admin%0aevil',
      '/admin%0D%0ALocation:%20//evil.example',
      '/%2f%2fevil.example',
      '/%5c%5cevil.example',
      '/%252f%252fevil.example',
      '/%255c%255cevil.example',
      '/%2e%2e//evil.example',
      '/admin/%2e%2e//evil.example',
      '/.//evil.example',
      '/admin/..//evil.example',
    ]

    for (const candidate of unsafe) {
      expect(safeInternalRedirectPath(candidate), JSON.stringify(candidate)).toBeNull()
    }
  })

  it('gates the redirect both before and after login with the shared helper', () => {
    const loginPage = readFileSync(resolve(process.cwd(), 'app/(auth)/login/page.tsx'), 'utf8')
    const actions = readFileSync(resolve(process.cwd(), 'app/(auth)/actions.ts'), 'utf8')

    expect(loginPage).toContain(
      "import { safeInternalRedirectPath } from '@/lib/auth/internal-redirect'",
    )
    expect(loginPage).toContain('const next = safeInternalRedirectPath(sp.next)')
    expect(loginPage).toContain('redirect(next ?? portalHomeFor(user))')
    expect(loginPage).toContain("<LoginForm next={next ?? ''} />")
    expect(loginPage).not.toContain("sp.next && sp.next.startsWith('/')")

    expect(actions).toContain(
      "import { safeInternalRedirectPath } from '@/lib/auth/internal-redirect'",
    )
    expect(actions).toContain(
      "const next = safeInternalRedirectPath(String(formData.get('next') ?? ''))",
    )
    expect(actions).toContain('if (next) redirect(next)')
    expect(actions).not.toContain("next && next.startsWith('/')")
    expect(actions).toContain('checkRateLimitFailClosed(')
    expect(actions).not.toMatch(/if \(!\(await checkRateLimit\(/)
  })
})
