// @corevo/config — shared ESLint flat config (FROZEN, G01).
// Next.js core-web-vitals rules, bridged to flat config via FlatCompat.
import { FlatCompat } from '@eslint/eslintrc'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
})

/** @type {import('eslint').Linter.Config[]} */
export const corevoEslintConfig = [
  ...compat.extends('next/core-web-vitals'),
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
