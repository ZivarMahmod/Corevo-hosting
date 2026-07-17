import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

function sourceAt(relativePath: string): string {
  const fullPath = path.join(WEB_ROOT, relativePath)
  expect(existsSync(fullPath), `${relativePath} must exist`).toBe(true)
  return readFileSync(fullPath, 'utf8')
}

describe('password recovery flow', () => {
  it('offers recovery from the login form', () => {
    const login = sourceAt('app/(auth)/login/LoginForm.tsx')

    expect(login).toContain('href="/glomt-losenord"')
  })

  it('requests a recovery email without exposing whether the account exists', () => {
    const request = sourceAt('app/(auth)/glomt-losenord/PasswordResetRequestForm.tsx')

    expect(request).toContain('resetPasswordForEmail')
    expect(request).toContain('try {')
    expect(request).toContain('finally {')
    expect(request).toContain("`${window.location.origin}/aterstall-losenord`")
    expect(request).toContain('Om adressen finns hos oss skickas ett mejl')
    expect(request).not.toContain('user not found')
  })

  it('accepts the recovery session and updates the password', () => {
    const update = sourceAt('app/(auth)/aterstall-losenord/PasswordResetForm.tsx')

    expect(update).toContain("hash.get('access_token')")
    expect(update).toContain('supabase.auth.setSession')
    expect(update).toContain('supabase.auth.updateUser({ password })')
    expect(update).toContain('window.history.replaceState')
    expect(update).toContain('href="/login"')
  })
})
