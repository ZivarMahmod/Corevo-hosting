import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Unit tests for pure logic (lib/booking/*, lib/platform/*, lib/notifications/*).
// Node environment — no DOM, no Next runtime. The booking helpers are
// dependency-free; the platform slug validator imports the reserved list from
// lib/tenant via the `@/` alias, so we mirror the app's path alias here (matches
// tsconfig "paths"). `server-only` is aliased to an empty stub because its real
// default export throws outside the bundler's react-server condition.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      'server-only': fileURLToPath(new URL('./test/server-only-stub.ts', import.meta.url)),
    },
  },
  // Compile component JSX with the automatic runtime (matches Next/react-jsx) so
  // .tsx render tests (renderToStaticMarkup) don't need an explicit React import.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    // goal-32: also cover the ops deploy-config generator (pure route-merge +
    // fail-closed DB fetch live in scripts/*.mjs, gated like app logic).
    // goal-47: + component render tests (.tsx via renderToStaticMarkup, node env).
    // goal-65: .ts under components/ täcktes inte av mönstret ovan — ren
    // navigationslogik (admin-navigation) behöver ingen JSX och tystades bort.
    include: [
      'app/**/*.test.{ts,tsx}',
      'lib/**/*.test.ts',
      'scripts/**/*.test.mjs',
      'components/**/*.test.{ts,tsx}',
    ],
    // These two exercise executable scheduler scripts with node:test. Vitest's
    // broad scripts glob must not double-load them as empty suites.
    exclude: [
      'scripts/primary-scheduler.test.mjs',
      'scripts/primary-scheduler-config.test.mjs',
    ],
  },
})
