// Onboarding STEPS-växling (Sajtbyggare S3 / goal-38) — deterministisk, båda grenar.
// Exakt en värld åt gången; inget halv-migrerat tillstånd nåbart (maxning §2).

import { describe, expect, it } from 'vitest'
import { onboardingSteps, ONBOARDING_STEPS_LEGACY, ONBOARDING_STEPS_EDITOR } from './onboarding-steps'

describe('onboardingSteps — flag-OFF (legacy)', () => {
  const steps = onboardingSteps(false)
  it('är BYTE-IDENTISK legacy: Temamall + Token-branding kvar', () => {
    expect(steps).toEqual(ONBOARDING_STEPS_LEGACY)
    expect(steps).toContain('Temamall')
    expect(steps).toContain('Token-branding')
  })
  it('saknar editor-steget', () => {
    expect(steps).not.toContain('Designa sidan')
  })
})

describe('onboardingSteps — flag-ON (editor)', () => {
  const steps = onboardingSteps(true)
  it('har "Designa sidan", och Temamall + Token-branding är BORTA', () => {
    expect(steps).toEqual(ONBOARDING_STEPS_EDITOR)
    expect(steps).toContain('Designa sidan')
    expect(steps).not.toContain('Temamall')
    expect(steps).not.toContain('Token-branding')
  })
})

describe('båda grenar — orörda steg + invarianter', () => {
  it('Bransch / Namn & subdomän / Moduler / Ägare & roll finns i BÅDA', () => {
    for (const s of [onboardingSteps(false), onboardingSteps(true)]) {
      for (const keep of ['Bransch', 'Namn & subdomän', 'Moduler', 'Ägare & roll']) {
        expect(s).toContain(keep)
      }
    }
  })
  it('inget tredje blandat tillstånd: editor-grenen har EXAKT ett designsteg och inga legacy-designsteg', () => {
    const on = onboardingSteps(true)
    const designish = on.filter((s) => ['Temamall', 'Token-branding', 'Designa sidan'].includes(s))
    expect(designish).toEqual(['Designa sidan'])
  })
  it('första två stegen identiska i båda grenar (delad start)', () => {
    expect(onboardingSteps(false).slice(0, 2)).toEqual(onboardingSteps(true).slice(0, 2))
  })
})
