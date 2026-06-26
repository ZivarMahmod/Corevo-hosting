// goal-50 RIV-BORT (mechanical) — the flag-ON look path must carry NO theme-special
// machinery. The 5 React themes' privileged constructs (WIZARD_THEMES / THEME_KEYS /
// ThemeDef / ThemePreview / `theme === 'salvia'`) live ONLY in the legacy CreateTenantForm
// + the legacy theme storefront path, which stay byte-identical (flag-OFF, rollback).
// The BOX path (registry + gallery + look-preview + render-bron preview dispatch) is a
// single sort of thing — mallar — with zero theme branch. This guards that.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url)) // …/lib/sajtbyggare
const WEB = join(HERE, '..', '..') // …/apps/web

// The flag-ON look path (the box: registry → gallery → preview dispatch → look render route).
const LOOK_PATH_FILES = [
  join(HERE, 'look-registry.ts'),
  join(WEB, 'app', 'sajtbyggare-spike', 'look', '[key]', 'page.tsx'),
  join(WEB, 'components', 'platform', 'onboarding-studio', 'StudioPanels.tsx'),
  join(WEB, 'components', 'platform', 'onboarding-studio', 'StorefrontPreview.tsx'),
]

const FORBIDDEN: { label: string; re: RegExp }[] = [
  { label: 'WIZARD_THEMES', re: /\bWIZARD_THEMES\b/ },
  { label: 'THEME_KEYS', re: /\bTHEME_KEYS\b/ },
  { label: 'ThemeDef', re: /\bThemeDef\b/ },
  { label: 'ThemePreview', re: /\bThemePreview\b/ },
  { label: "theme === 'salvia'", re: /theme\s*===\s*['"]salvia['"]/ },
]

describe('the flag-ON look path is theme-free (RIV-BORT grep)', () => {
  for (const file of LOOK_PATH_FILES) {
    it(`${file.split(/[\\/]/).slice(-1)[0]} has no theme-special construct`, () => {
      const src = readFileSync(file, 'utf8')
      for (const { label, re } of FORBIDDEN) {
        expect(re.test(src), `found "${label}" in the look path`).toBe(false)
      }
    })
  }
})
