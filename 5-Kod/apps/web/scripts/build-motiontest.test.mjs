import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

async function loadBuild() {
  return import('./build-motiontest.mjs').catch(() => null)
}

describe('canonical motiontest build', () => {
  it('exposes a fail-closed build owner', async () => {
    const build = await loadBuild()
    expect(typeof build?.createMotiontestBuildInvocation).toBe('function')
    expect(typeof build?.assertNoLocalMotiontestEnv).toBe('function')
    expect(typeof build?.resolveOpenNextCli).toBe('function')
  })

  it('resolves the installed package CLI without relying on an exported package.json', async () => {
    const build = await loadBuild()
    if (!build?.resolveOpenNextCli) {
      expect(build?.resolveOpenNextCli).toBeTypeOf('function')
      return
    }
    const cliPath = build.resolveOpenNextCli()
    expect(existsSync(cliPath)).toBe(true)
    expect(cliPath.replaceAll('\\', '/')).toMatch(
      /\/@opennextjs\/cloudflare\/dist\/cli\/index\.js$/,
    )
  })

  it('uses a shell-free OpenNext argv with exact public motiontest values only', async () => {
    const build = await loadBuild()
    if (!build?.createMotiontestBuildInvocation) {
      expect(build?.createMotiontestBuildInvocation).toBeTypeOf('function')
      return
    }
    const appDir = resolve('C:/corevo/5-Kod/apps/web')
    const cliPath = resolve(appDir, 'node_modules/@opennextjs/cloudflare/dist/cli/index.js')
    const invocation = build.createMotiontestBuildInvocation({
      appDir,
      cliPath,
      systemEnv: {
        PATH: 'test-path',
        SUPABASE_SERVICE_ROLE_KEY: 'must-not-leak',
        STRIPE_SECRET_KEY: 'must-not-leak',
      },
      publicEnv: {
        NEXT_PUBLIC_SITE_URL: 'https://motiontest.corevo.se',
        NEXT_PUBLIC_ROOT_DOMAIN: 'corevo.se',
        NEXT_PUBLIC_PLATFORM_HOST: 'booking.corevo.se',
        NEXT_PUBLIC_SUPABASE_URL: 'https://clylvowtowbtotrahuad.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon',
      },
    })

    expect(invocation).toMatchObject({
      command: process.execPath,
      args: [cliPath, 'build'],
      options: { cwd: appDir, shell: false, stdio: 'inherit' },
    })
    expect(invocation.options.env).toMatchObject({
      PATH: 'test-path',
      NEXT_PUBLIC_SITE_URL: 'https://motiontest.corevo.se',
    })
    expect(invocation.options.env).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY')
    expect(invocation.options.env).not.toHaveProperty('STRIPE_SECRET_KEY')
  })

  it.each(['--require=./preload.cjs', '--import=./preload.mjs'])(
    'removes inherited NODE_OPTIONS %s before OpenNext starts',
    async (nodeOptions) => {
      const build = await loadBuild()
      if (!build?.createMotiontestBuildInvocation) {
        expect(build?.createMotiontestBuildInvocation).toBeTypeOf('function')
        return
      }

      const appDir = resolve('C:/corevo/5-Kod/apps/web')
      const invocation = build.createMotiontestBuildInvocation({
        appDir,
        cliPath: resolve(appDir, 'node_modules/@opennextjs/cloudflare/dist/cli/index.js'),
        systemEnv: { NODE_OPTIONS: nodeOptions, PATH: 'test-path' },
        publicEnv: { NEXT_PUBLIC_SITE_URL: 'https://motiontest.corevo.se' },
      })

      expect(invocation.options.env).not.toHaveProperty('NODE_OPTIONS')
      expect(invocation.options.env.PATH).toBe('test-path')
    },
  )

  it('refuses local dotenv files that could override the stamped build', async () => {
    const build = await loadBuild()
    if (!build?.assertNoLocalMotiontestEnv) {
      expect(build?.assertNoLocalMotiontestEnv).toBeTypeOf('function')
      return
    }
    for (const name of ['.env.local', '.env.production.local']) {
      const appDir = mkdtempSync(join(tmpdir(), 'corevo-motiontest-build-'))
      try {
        expect(() => build.assertNoLocalMotiontestEnv(appDir)).not.toThrow()
        const localEnv = resolve(appDir, name)
        mkdirSync(dirname(localEnv), { recursive: true })
        writeFileSync(localEnv, 'SUPABASE_SERVICE_ROLE_KEY=private\n')
        expect(() => build.assertNoLocalMotiontestEnv(appDir), name).toThrow(
          new RegExp(name.replaceAll('.', '\\.'), 'i'),
        )
      } finally {
        rmSync(appDir, { recursive: true, force: true })
      }
    }
  })

  it('writes exact temporary production env for OpenNext and removes it after failure', async () => {
    const build = await loadBuild()
    if (!build?.runMotiontestBuild) {
      expect(build?.runMotiontestBuild).toBeTypeOf('function')
      return
    }
    const root = mkdtempSync(join(tmpdir(), 'corevo-motiontest-build-run-'))
    const appDir = resolve(root, '5-Kod/apps/web')
    const cliPath = resolve(appDir, 'node_modules/@opennextjs/cloudflare/dist/cli/index.js')
    const publicEnv = {
      NEXT_PUBLIC_SITE_URL: 'https://motiontest.corevo.se',
      NEXT_PUBLIC_ROOT_DOMAIN: 'corevo.se',
      NEXT_PUBLIC_PLATFORM_HOST: 'booking.corevo.se',
      NEXT_PUBLIC_SUPABASE_URL: 'https://clylvowtowbtotrahuad.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon',
    }
    const expectedBuildEnv = {
      ...publicEnv,
      NEXT_PUBLIC_MOTIONTEST_RELEASE_SHA: 'a'.repeat(40),
    }
    mkdirSync(dirname(cliPath), { recursive: true })
    writeFileSync(cliPath, '// fixture cli\n')
    try {
      expect(() =>
        build.runMotiontestBuild({
          appDir,
          cliPath,
          publicEnv,
          env: {},
          releaseIdentityImpl: () => ({
            gitSha: 'a'.repeat(40),
            releaseRef: 'refs/heads/main',
          }),
          spawnSyncImpl() {
            const temporaryEnv = resolve(appDir, '.env.production.local')
            expect(existsSync(temporaryEnv)).toBe(true)
            const parsed = Object.fromEntries(
              readFileSync(temporaryEnv, 'utf8')
                .trim()
                .split(/\r?\n/)
                .map((line) => line.split('=', 2)),
            )
            expect(parsed).toEqual(expectedBuildEnv)
            return { status: 17 }
          },
        }),
      ).toThrow(/OpenNext exited with status 17/i)
      expect(existsSync(resolve(appDir, '.env.production.local'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
