import { defineConfig } from 'vitest/config'

// Unit tests for the pure booking logic (lib/booking/*). Node environment —
// no DOM, no Next runtime. The slot engine + tz helpers are dependency-free,
// so tests import them with relative paths (no @/ alias needed).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
