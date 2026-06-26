// @corevo/config — shared ESLint flat config.
//
// NATIVE flat config (ESLint 9). The old `FlatCompat.extends('next/core-web-vitals')`
// bridge loaded eslint-config-next's legacy eslintrc config, which pulls in
// `@rushstack/eslint-patch` — and that patch fails to resolve ESLint 9.39's internals
// ("Failed to patch ESLint because the calling module was not recognized"), which
// crashed `eslint .` at config-load and took the whole CI gate down with it.
//
// We now assemble the SAME rule set directly from the plugins' own flat configs (no
// patch, no FlatCompat). Parity with `next/core-web-vitals` is deliberate:
//   - @next/next core-web-vitals rules (incl. the error-level ones) ............ kept
//   - react/recommended + jsx-runtime, with the same TS/Next suppressions ...... kept
//   - react-hooks/recommended (rules-of-hooks = error, exhaustive-deps = warn) .. kept
//   - jsx-a11y: NOT the full /recommended (eslint-config-next never extended it) —
//     only the ~6 explicit warns it set ........................................ kept
//   - eslint-plugin-import: dropped (only added one warn + resolver settings; no
//     gating value, and it would need the import resolver wired in flat config).
import nextPlugin from '@next/eslint-plugin-next'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import tsParser from '@typescript-eslint/parser'

/** @type {import('eslint').Linter.Config[]} */
export const corevoEslintConfig = [
  nextPlugin.flatConfig.coreWebVitals,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'], // React 17+ JSX transform → no React-in-scope needed
  reactHooks.configs['recommended-latest'], // the flat-config variant (v5)
  {
    // TS/TSX must parse via @typescript-eslint/parser (mirrors eslint-config-next's
    // .ts?(x) override). Parser only — no @typescript-eslint rules gated before, so
    // none added now (tsc owns type checking).
    files: ['**/*.{ts,tsx,mts,cts}'],
    languageOptions: { parser: tsParser, parserOptions: { sourceType: 'module' } },
  },
  {
    plugins: { 'jsx-a11y': jsxA11y },
    settings: { react: { version: 'detect' } },
    rules: {
      // eslint-config-next's TS/Next-friendly suppressions (verbatim).
      'react/no-unknown-property': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-no-target-blank': 'off',
      // The exact jsx-a11y warns eslint-config-next set (it did NOT extend recommended).
      'jsx-a11y/alt-text': ['warn', { elements: ['img'], img: ['Image'] }],
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-proptypes': 'warn',
      'jsx-a11y/aria-unsupported-elements': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      'jsx-a11y/role-supports-aria-props': 'warn',
    },
  },
  {
    ignores: [
      '**/.next/**',
      '**/.open-next/**',
      '**/.wrangler/**',
      '**/node_modules/**',
      '**/next-env.d.ts',
    ],
  },
]

export default corevoEslintConfig
