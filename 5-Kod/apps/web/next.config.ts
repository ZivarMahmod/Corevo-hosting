import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'

// Pin the file-tracing root to the monorepo (avoids picking up a stray
// lockfile elsewhere on disk; matters for OpenNext output tracing).
const monorepoRoot = fileURLToPath(new URL('../..', import.meta.url))

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: monorepoRoot,
  // Workspace packages ship TypeScript source; let Next transpile them.
  transpilePackages: ['@corevo/db', '@corevo/auth', '@corevo/ui'],
  // Lint runs as its own task (`pnpm lint`); don't couple it to build.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: false },
}

export default nextConfig
