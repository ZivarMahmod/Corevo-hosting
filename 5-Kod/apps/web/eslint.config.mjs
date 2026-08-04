import config from '@corevo/config/eslint'

export default [
  ...config,
  {
    files: ['lib/**/*.{ts,tsx}'],
    ignores: ['lib/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/components/**', '**/components/**'],
          message: 'Domänlagret får inte importera UI. Flytta data/typen till lib.',
        }],
      }],
    },
  },
  {
    files: ['components/**/*.{ts,tsx}'],
    ignores: ['components/**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['@/app/**', '**/app/**'],
          message: 'Återanvändbara komponenter får inte ägas av en route.',
        }],
      }],
    },
  },
]
