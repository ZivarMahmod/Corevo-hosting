// Onboarding-stegsekvensen — EN sekvens sedan sajtbyggaren revs (2026-07-12).
// Den flagg-gatade editor-grenen ("Designa sidan") finns inte längre; kvar är exakt
// den sekvens som alltid kördes i prod.

import { describe, expect, it } from 'vitest'
import { ONBOARDING_STEPS } from './onboarding-steps'

describe('ONBOARDING_STEPS', () => {
  it('är prod-sekvensen: Temamall + Token-branding som egna steg', () => {
    expect(ONBOARDING_STEPS).toEqual([
      'Bransch',
      'Namn & subdomän',
      'Temamall',
      'Moduler',
      'Token-branding',
      'Ägare & roll',
    ])
  })

  it('saknar det rivna editor-steget', () => {
    expect(ONBOARDING_STEPS).not.toContain('Designa sidan')
  })
})
