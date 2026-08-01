import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./OnboardingStudio.tsx', import.meta.url), 'utf8')

describe('Onboarding Studio create action', () => {
  it('dispatches useActionState inside a React transition', () => {
    expect(source).toMatch(
      /startTransition\(\(\) => formAction\(buildCreateTenantFormData\(cfg\)\)\)/,
    )
  })
})
