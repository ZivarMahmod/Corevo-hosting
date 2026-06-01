import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit tests for pure logic (lib/booking/*, lib/platform/*). Node environment —
// no DOM, no Next runtime. The booking helpers are dependency-free; the platform
// slug validator imports the reserved list from lib/tenant via the `@/` alias, so
// we mirror the app's path alias here (matches tsconfig "paths").
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('.', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
