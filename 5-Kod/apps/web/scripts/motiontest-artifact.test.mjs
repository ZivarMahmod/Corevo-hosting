import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

async function loadArtifact() {
  return import('./motiontest-artifact.mjs').catch(() => null)
}

function withFixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'corevo-motiontest-artifact-'))
  const appDir = resolve(root, '5-Kod/apps/web')
  mkdirSync(appDir, { recursive: true })
  const files = {
    '.open-next/worker.js': 'export default { fetch() {} }\n',
    '.open-next/assets/_next/static/app.js': 'asset-v1\n',
    '.open-next/cloudflare/next-env.mjs': 'export const production = {};\n',
    '.open-next/server-functions/default/handler.mjs': 'export const handler = true\n',
    'lib/storefront/motiontest-request-boundary.mjs': 'export const boundary = true\n',
    'lib/storefront/motiontest-worker-runtime.mjs': 'export const runtime = true\n',
    'motiontest-opennext-worker.mjs': "export { default } from './.open-next/worker.js'\n",
    'motiontest-worker.mjs': 'export default {}\n',
    'open-next.config.ts': 'export default {}\n',
    'package.json': '{"name":"fixture"}\n',
    'scripts/motiontest-child-environment.mjs': 'export const environment = {}\n',
    'wrangler.jsonc': '{"env":{"motiontest":{}}}\n',
    '../../pnpm-lock.yaml': 'lockfileVersion: 9\n',
  }
  for (const [path, value] of Object.entries(files)) {
    const target = resolve(appDir, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, value)
  }
  try {
    return run(appDir)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('motiontest cryptographic artifact stamp', () => {
  it('exposes the stamp writer and verifier', async () => {
    const artifact = await loadArtifact()
    expect(typeof artifact?.writeMotiontestArtifactStamp).toBe('function')
    expect(typeof artifact?.assertMotiontestArtifact).toBe('function')
    expect(typeof artifact?.assertMotiontestReleaseIdentity).toBe('function')
  })

  it('requires the exact clean commit and named release ref', async () => {
    const artifact = await loadArtifact()
    if (!artifact?.assertMotiontestReleaseIdentity) {
      expect(artifact?.assertMotiontestReleaseIdentity).toBeTypeOf('function')
      return
    }
    const sha = 'a'.repeat(40)
    const releaseRef = 'refs/heads/codex/freshcut-motiontest-production-grade'
    const runGit = (args) => {
      const command = args.join(' ')
      if (command === 'rev-parse HEAD') return `${sha}\n`
      if (command === 'status --porcelain --untracked-files=all') return ''
      if (command === 'symbolic-ref --quiet HEAD') return `${releaseRef}\n`
      throw new Error(`unexpected git command: ${command}`)
    }
    const env = {
      MOTIONTEST_EXPECTED_SHA: sha,
      MOTIONTEST_EXPECTED_REF: releaseRef,
      MOTIONTEST_ACTUAL_SHA: sha,
      MOTIONTEST_ACTUAL_REF: releaseRef,
    }
    expect(artifact.assertMotiontestReleaseIdentity({ repoDir: 'C:/repo', env, runGit })).toEqual({
      gitSha: sha,
      releaseRef,
    })
    expect(
      artifact.assertMotiontestReleaseIdentity({
        repoDir: 'C:/repo',
        env,
        runGit: (args) => {
          if (args[0] === 'symbolic-ref') throw new Error('detached HEAD')
          return runGit(args)
        },
      }),
    ).toEqual({ gitSha: sha, releaseRef })

    expect(() =>
      artifact.assertMotiontestReleaseIdentity({ repoDir: 'C:/repo', env: {}, runGit }),
    ).toThrow(/expected SHA.*ref/i)
    expect(() =>
      artifact.assertMotiontestReleaseIdentity({
        repoDir: 'C:/repo',
        env: { ...env, MOTIONTEST_EXPECTED_SHA: 'b'.repeat(40) },
        runGit,
      }),
    ).toThrow(/SHA/i)
    expect(() =>
      artifact.assertMotiontestReleaseIdentity({
        repoDir: 'C:/repo',
        env: { ...env, MOTIONTEST_EXPECTED_REF: 'refs/heads/main' },
        runGit,
      }),
    ).toThrow(/release ref/i)
    expect(() =>
      artifact.assertMotiontestReleaseIdentity({
        repoDir: 'C:/repo',
        env,
        runGit: (args) => (args[0] === 'status' ? ' M apps/web/middleware.ts\n' : runGit(args)),
      }),
    ).toThrow(/dirty/i)
  })

  it('binds commit, ref, config, lock, generated Worker tree and every asset', async () => {
    const artifact = await loadArtifact()
    if (!artifact?.writeMotiontestArtifactStamp || !artifact?.assertMotiontestArtifact) {
      expect(artifact?.writeMotiontestArtifactStamp).toBeTypeOf('function')
      return
    }
    await withFixture(async (appDir) => {
      const identity = {
        gitSha: 'a'.repeat(40),
        releaseRef: 'refs/heads/codex/freshcut-motiontest-production-grade',
      }
      const buildEnvironment = { NEXT_PUBLIC_SITE_URL: 'https://motiontest.corevo.se' }
      artifact.writeMotiontestArtifactStamp(appDir, { ...identity, buildEnvironment })

      expect(artifact.assertMotiontestArtifact(appDir, identity)).toMatchObject(identity)
      const stamp = JSON.parse(
        readFileSync(resolve(appDir, '.open-next/motiontest-release-stamp.json'), 'utf8'),
      )
      expect(stamp.files.map((file) => file.path)).toEqual(
        expect.arrayContaining([
          '.open-next/assets/_next/static/app.js',
          '.open-next/cloudflare/next-env.mjs',
          '.open-next/server-functions/default/handler.mjs',
          '.open-next/worker.js',
          '../../pnpm-lock.yaml',
          'motiontest-opennext-worker.mjs',
          'motiontest-worker.mjs',
          'wrangler.jsonc',
        ]),
      )

      writeFileSync(resolve(appDir, '.open-next/assets/_next/static/app.js'), 'tampered\n')
      expect(() => artifact.assertMotiontestArtifact(appDir, identity)).toThrow(/tampered|stale/i)
      writeFileSync(resolve(appDir, '.open-next/assets/_next/static/app.js'), 'asset-v1\n')
      expect(() => artifact.assertMotiontestArtifact(appDir, identity)).not.toThrow()

      writeFileSync(
        resolve(appDir, '.open-next/server-functions/default/handler.mjs'),
        'export const handler = false\n',
      )
      expect(() => artifact.assertMotiontestArtifact(appDir, identity)).toThrow(/tampered|stale/i)
      expect(() =>
        artifact.assertMotiontestArtifact(appDir, { ...identity, gitSha: 'b'.repeat(40) }),
      ).toThrow(/SHA/i)
    })
  })

  it('rejects a missing stamp', async () => {
    const artifact = await loadArtifact()
    if (!artifact?.assertMotiontestArtifact) {
      expect(artifact?.assertMotiontestArtifact).toBeTypeOf('function')
      return
    }
    await withFixture(async (appDir) => {
      expect(() =>
        artifact.assertMotiontestArtifact(appDir, {
          gitSha: 'a'.repeat(40),
          releaseRef: 'refs/heads/codex/freshcut-motiontest-production-grade',
        }),
      ).toThrow(/missing/i)
    })
  })
})
