import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseJsonc } from 'jsonc-parser'
import { parse as parseYaml } from 'yaml'
import { describe, expect, it, vi } from 'vitest'
import {
  assertMotiontestBuild,
  assertNoEmbeddedPrivateEnv,
  assertNoGeneratedConfigRedirect,
  createWranglerInvocation,
  motiontestBuildEnvironment,
  parseMotiontestArgs,
  runMotiontestDeploy,
  validateMotiontestConfig,
} from './deploy-motiontest.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '..')
const wranglerPath = resolve(appDir, 'wrangler.jsonc')
const PROPAGATION_PENDING_CODE = 'MOTIONTEST_PROPAGATION_PENDING'

function readWranglerConfig() {
  return parseJsonc(readFileSync(wranglerPath, 'utf8'), [], { allowTrailingComma: true })
}

function decodeJwtPayload(value) {
  const payload = String(value).split('.')[1]
  if (!payload) throw new Error('expected a JWT payload')
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
}

function writeGeneratedEnv(root, overrides = {}) {
  const config = readWranglerConfig()
  const canonicalBuildEnvironment = motiontestBuildEnvironment(config, {
    appDir,
    configPath: wranglerPath,
  })
  const modes = {
    production: canonicalBuildEnvironment,
    development: {},
    test: {},
    ...overrides,
  }
  const cloudflareDir = resolve(root, '.open-next/cloudflare')
  mkdirSync(cloudflareDir, { recursive: true })
  writeFileSync(
    resolve(cloudflareDir, 'next-env.mjs'),
    Object.entries(modes)
      .map(([mode, values]) => `export const ${mode} = ${JSON.stringify(values)};`)
      .join('\n') + '\n',
  )
}

async function withTempApp(run) {
  const root = mkdtempSync(join(tmpdir(), 'corevo-motiontest-'))
  try {
    return await run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

describe('FreshCut motiontest release contract', () => {
  it('isolates one assets-only Worker on the exact motiontest custom domain', () => {
    const config = readWranglerConfig()
    const motiontest = config.env?.motiontest

    expect(motiontest).toMatchObject({
      name: 'freshcut-motiontest',
      main: './motiontest-worker.mjs',
      workers_dev: false,
      preview_urls: false,
      triggers: { crons: [] },
      assets: {
        directory: '.open-next/assets',
        binding: 'ASSETS',
        run_worker_first: true,
      },
      observability: { enabled: false },
      routes: [{ pattern: 'motiontest.corevo.se', custom_domain: true }],
    })
    expect(Object.keys(motiontest.vars).sort()).toEqual([
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'NEXT_PUBLIC_SUPABASE_URL',
    ])
    expect(new URL(motiontest.vars.NEXT_PUBLIC_SUPABASE_URL).hostname).toMatch(
      /^[a-z]{20}\.supabase\.co$/,
    )
    expect(decodeJwtPayload(motiontest.vars.NEXT_PUBLIC_SUPABASE_ANON_KEY)).toMatchObject({
      role: 'anon',
      ref: 'clylvowtowbtotrahuad',
    })
    expect(motiontest.vars).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: config.vars.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: config.vars.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    })

    for (const forbidden of [
      'ai',
      'analytics_engine_datasets',
      'browser',
      'containers',
      'd1_databases',
      'dispatch_namespaces',
      'durable_objects',
      'hyperdrive',
      'images',
      'kv_namespaces',
      'mtls_certificates',
      'queues',
      'r2_buckets',
      'secrets',
      'secrets_store_secrets',
      'services',
      'vectorize',
      'workflows',
    ]) {
      expect(motiontest).not.toHaveProperty(forbidden)
    }
  })

  it('keeps the intentional production and staging motiontest label reservation non-routable', () => {
    const config = readWranglerConfig()
    const productionReserved = config.vars.NEXT_PUBLIC_RESERVED_SUBDOMAINS.split(',')
    const stagingReserved = config.env.staging.vars.NEXT_PUBLIC_RESERVED_SUBDOMAINS.split(',')

    expect(productionReserved).toContain('motiontest')
    expect(stagingReserved).toContain('motiontest')
    expect(config.routes).not.toContainEqual(
      expect.objectContaining({ pattern: 'motiontest.corevo.se' }),
    )
    expect(config.env.staging.routes ?? []).not.toContainEqual(
      expect.objectContaining({ pattern: 'motiontest.corevo.se' }),
    )
    expect(config.env.motiontest.routes).toEqual([
      { pattern: 'motiontest.corevo.se', custom_domain: true },
    ])
  })

  it('accepts only the optional dry-run flag', () => {
    expect(parseMotiontestArgs([])).toEqual({ dryRun: false })
    expect(parseMotiontestArgs(['--dry-run'])).toEqual({ dryRun: true })

    for (const args of [
      ['--env', 'production'],
      ['--config', 'wrangler.deploy.json'],
      ['--name', 'bokningsplatformen'],
      ['--dry-run', '--dry-run'],
      ['--unknown'],
    ]) {
      expect(() => parseMotiontestArgs(args)).toThrow(/unknown arguments/i)
    }
  })

  it('rejects every production route, entrypoint, privilege, and config-path escape', () => {
    const config = readWranglerConfig()
    const options = { appDir, configPath: wranglerPath }
    expect(validateMotiontestConfig(config, options)).toBe(config.env.motiontest)

    const cases = [
      ['wrong Worker', (value) => (value.env.motiontest.name = 'bokningsplatformen'), /worker/i],
      [
        'production entrypoint',
        (value) => (value.env.motiontest.main = './custom-worker.mjs'),
        /entrypoint/i,
      ],
      ['workers.dev', (value) => (value.env.motiontest.workers_dev = true), /workers\.dev/i],
      ['preview URL', (value) => (value.env.motiontest.preview_urls = true), /preview/i],
      [
        'extra route',
        (value) => value.env.motiontest.routes.push({ pattern: 'freshcut.corevo.se' }),
        /exactly one route/i,
      ],
      [
        'production route',
        (value) => (value.env.motiontest.routes[0].pattern = 'freshcut.corevo.se'),
        /motiontest\.corevo\.se/i,
      ],
      [
        'non-custom route',
        (value) => (value.env.motiontest.routes[0].custom_domain = false),
        /custom domain/i,
      ],
      ['cron', (value) => value.env.motiontest.triggers.crons.push('* * * * *'), /cron/i],
      [
        'production R2 binding',
        (value) => (value.env.motiontest.r2_buckets = [{ binding: 'BUCKET' }]),
        /unexpected field.*r2_buckets/i,
      ],
      [
        'privileged runtime secret',
        (value) => (value.env.motiontest.vars.SUPABASE_SERVICE_ROLE_KEY = 'forbidden'),
        /public supabase vars/i,
      ],
      [
        'wrong assets binding',
        (value) => (value.env.motiontest.assets.binding = 'BUCKET'),
        /assets/i,
      ],
      [
        'assets bypass Worker',
        (value) => (value.env.motiontest.assets.run_worker_first = false),
        /run worker first/i,
      ],
      [
        'inherited observability',
        (value) => (value.env.motiontest.observability.enabled = true),
        /observability/i,
      ],
    ]

    for (const [label, mutate, message] of cases) {
      const changed = structuredClone(config)
      mutate(changed)
      expect(() => validateMotiontestConfig(changed, options), label).toThrow(message)
    }

    expect(() =>
      validateMotiontestConfig(config, {
        appDir,
        configPath: resolve(appDir, 'wrangler.deploy.json'),
      }),
    ).toThrow(/canonical wrangler\.jsonc/i)
  })

  it('pins motiontest to the canonical top-level production anon project', () => {
    const config = readWranglerConfig()
    const changed = structuredClone(config)
    const otherRef = 'abcdefghijklmnopqrst'
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(
      JSON.stringify({ iss: 'supabase', ref: otherRef, role: 'anon' }),
    ).toString('base64url')
    const otherAnonKey = `${header}.${payload}.test-signature`
    changed.vars.NEXT_PUBLIC_SUPABASE_URL = `https://${otherRef}.supabase.co`
    changed.vars.NEXT_PUBLIC_SUPABASE_ANON_KEY = otherAnonKey
    changed.env.motiontest.vars.NEXT_PUBLIC_SUPABASE_URL = `https://${otherRef}.supabase.co`
    changed.env.motiontest.vars.NEXT_PUBLIC_SUPABASE_ANON_KEY = otherAnonKey

    expect(() => validateMotiontestConfig(changed, { appDir, configPath: wranglerPath })).toThrow(
      /canonical production Supabase project/i,
    )
  })

  it('requires the generated fetch Worker and assets while refusing config redirects', async () => {
    await withTempApp((root) => {
      expect(() => assertMotiontestBuild(root)).toThrow(/missing OpenNext Worker build/i)

      mkdirSync(resolve(root, '.open-next/assets'), { recursive: true })
      writeFileSync(resolve(root, '.open-next/worker.js'), 'export default { fetch() {} }\n')
      expect(() => assertMotiontestBuild(root)).not.toThrow()
      expect(() => assertNoGeneratedConfigRedirect(root)).not.toThrow()

      mkdirSync(resolve(root, '.wrangler/deploy'), { recursive: true })
      writeFileSync(
        resolve(root, '.wrangler/deploy/config.json'),
        JSON.stringify({ configPath: '../../wrangler.deploy.json' }),
      )
      expect(() => assertNoGeneratedConfigRedirect(root)).toThrow(/generated config redirect/i)
    })
  })

  it('rejects private or cross-project values embedded by OpenNext env compilation', async () => {
    const config = readWranglerConfig()
    const expected = motiontestBuildEnvironment(config, { appDir, configPath: wranglerPath })
    await withTempApp((root) => {
      writeGeneratedEnv(root)
      expect(() => assertNoEmbeddedPrivateEnv(root, expected)).not.toThrow()

      writeGeneratedEnv(root, {
        production: {
          ...expected,
          SUPABASE_SERVICE_ROLE_KEY: 'must-never-reach-the-worker',
        },
      })
      expect(() => assertNoEmbeddedPrivateEnv(root, expected)).toThrow(/private embedded env/i)

      writeGeneratedEnv(root, {
        production: {
          ...expected,
          NEXT_PUBLIC_SUPABASE_URL: 'https://wrongwrongwrongwrong.supabase.co',
        },
      })
      expect(() => assertNoEmbeddedPrivateEnv(root, expected)).toThrow(/canonical motiontest/i)

      writeGeneratedEnv(root, {
        production: {
          ...expected,
          NEXT_PUBLIC_SITE_URL: 'https://booking.corevo.se',
        },
      })
      expect(() => assertNoEmbeddedPrivateEnv(root, expected)).toThrow(/canonical motiontest/i)

      writeGeneratedEnv(root, {
        development: { NEXT_PUBLIC_SITE_URL: 'https://motiontest.corevo.se' },
      })
      expect(() => assertNoEmbeddedPrivateEnv(root, expected)).toThrow(/development.*empty/i)
    })
  })

  it('builds a Node argv invocation with shell disabled and no production overrides', () => {
    const fakeRoot = resolve('C:/isolated-motiontest-app')
    const fakeWrangler = resolve(fakeRoot, 'node_modules/wrangler/bin/wrangler.js')
    const invocation = createWranglerInvocation({
      appDir: fakeRoot,
      dryRun: true,
      env: {
        PATH: 'test-path',
        SystemRoot: 'C:\\Windows',
        CLOUDFLARE_ENV: 'production',
        CLOUDFLARE_API_TOKEN: 'generic-token-must-not-leak',
        CLOUDFLARE_ACCOUNT_ID: 'generic-account-must-not-leak',
        MOTIONTEST_CLOUDFLARE_API_TOKEN: 'motion-token-not-needed-for-dry-run',
        MOTIONTEST_CLOUDFLARE_ACCOUNT_ID: 'motion-account-not-needed-for-dry-run',
        OPENNEXT_CMD: 'node scripts/deploy-prod.mjs',
        STRIPE_SECRET_KEY: 'must-not-leak',
        SUPABASE_SERVICE_ROLE_KEY: 'must-not-leak',
        WRANGLER_CMD: 'node scripts/deploy-prod.mjs',
      },
      wranglerBinPath: fakeWrangler,
    })

    expect(invocation.command).toBe(process.execPath)
    expect(invocation.args).toEqual([
      fakeWrangler,
      'deploy',
      '--config',
      resolve(fakeRoot, 'wrangler.jsonc'),
      '--env',
      'motiontest',
      '--strict',
      '--dry-run',
    ])
    expect(invocation.options).toEqual({
      cwd: fakeRoot,
      shell: false,
      stdio: 'inherit',
      env: { PATH: 'test-path', SystemRoot: 'C:\\Windows' },
    })
    expect(invocation.options.env).not.toHaveProperty('CLOUDFLARE_ENV')
    expect(invocation.options.env).not.toHaveProperty('OPENNEXT_CMD')
    expect(invocation.options.env).not.toHaveProperty('WRANGLER_CMD')
    expect(invocation.options.env).not.toHaveProperty('CLOUDFLARE_API_TOKEN')
    expect(invocation.options.env).not.toHaveProperty('CLOUDFLARE_ACCOUNT_ID')
    expect(invocation.options.env).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY')
    expect(invocation.options.env).not.toHaveProperty('STRIPE_SECRET_KEY')

    const realInvocation = createWranglerInvocation({
      appDir: fakeRoot,
      dryRun: false,
      env: {
        PATH: 'test-path',
        SystemRoot: 'C:\\Windows',
        MOTIONTEST_CLOUDFLARE_API_TOKEN: 'motion-token',
        MOTIONTEST_CLOUDFLARE_ACCOUNT_ID: 'motion-account',
        SUPABASE_SERVICE_ROLE_KEY: 'must-not-leak',
        STRIPE_SECRET_KEY: 'must-not-leak',
      },
      wranglerBinPath: fakeWrangler,
    })
    expect(realInvocation.options.env).toEqual({
      PATH: 'test-path',
      SystemRoot: 'C:\\Windows',
      CLOUDFLARE_API_TOKEN: 'motion-token',
      CLOUDFLARE_ACCOUNT_ID: 'motion-account',
    })
  })

  it.each(['--require=./preload.cjs', '--import=./preload.mjs'])(
    'removes inherited NODE_OPTIONS %s from dry-run Wrangler',
    (nodeOptions) => {
      const fakeRoot = resolve('C:/isolated-motiontest-app')
      const invocation = createWranglerInvocation({
        appDir: fakeRoot,
        dryRun: true,
        env: { NODE_OPTIONS: nodeOptions, PATH: 'test-path' },
        wranglerBinPath: resolve(fakeRoot, 'node_modules/wrangler/bin/wrangler.js'),
      })

      expect(invocation.options.env).not.toHaveProperty('NODE_OPTIONS')
    },
  )

  it.each(['--require=./preload.cjs', '--import=./preload.mjs'])(
    'removes inherited NODE_OPTIONS %s from real Wrangler',
    (nodeOptions) => {
      const fakeRoot = resolve('C:/isolated-motiontest-app')
      const invocation = createWranglerInvocation({
        appDir: fakeRoot,
        dryRun: false,
        env: {
          NODE_OPTIONS: nodeOptions,
          PATH: 'test-path',
          MOTIONTEST_CLOUDFLARE_API_TOKEN: 'motion-token',
          MOTIONTEST_CLOUDFLARE_ACCOUNT_ID: 'motion-account',
        },
        wranglerBinPath: resolve(fakeRoot, 'node_modules/wrangler/bin/wrangler.js'),
      })

      expect(invocation.options.env).not.toHaveProperty('NODE_OPTIONS')
    },
  )

  it('keeps dry-run credential-free but gates the real deploy before spawn', async () => {
    await withTempApp(async (root) => {
      writeFileSync(resolve(root, 'wrangler.jsonc'), readFileSync(wranglerPath, 'utf8'))
      mkdirSync(resolve(root, '.open-next/assets'), { recursive: true })
      writeFileSync(resolve(root, '.open-next/worker.js'), 'export default { fetch() {} }\n')
      writeGeneratedEnv(root)
      const wranglerBinPath = resolve(root, 'node_modules/wrangler/bin/wrangler.js')
      mkdirSync(dirname(wranglerBinPath), { recursive: true })
      writeFileSync(wranglerBinPath, '// test Wrangler entrypoint\n')

      const calls = []
      let preflights = 0
      let verifications = 0
      const liveBaseline = {
        fingerprintSha256: 'c'.repeat(64),
        liveFreshCutIsolated: true,
      }
      const spawnSyncImpl = (command, args, options) => {
        calls.push({ command, args, options })
        return { status: 0 }
      }

      const guarded = {
        releaseIdentityImpl: () => ({
          gitSha: 'a'.repeat(40),
          releaseRef: 'refs/heads/codex/freshcut-motiontest-production-grade',
        }),
        artifactImpl: (_appDir, identity) => ({ ...identity }),
        preflightImpl: async () => {
          preflights += 1
          return liveBaseline
        },
        verifyImpl: async (options) => {
          verifications += 1
          expect(options).toEqual({
            deadlineAt: expect.any(Number),
            liveBaseline,
          })
        },
      }
      const releaseEnv = { MOTIONTEST_EXPECTED_ARTIFACT_SHA: 'b'.repeat(64) }

      await expect(
        runMotiontestDeploy({
          appDir: root,
          args: ['--dry-run'],
          env: releaseEnv,
          log() {},
          spawnSyncImpl,
          wranglerBinPath,
          ...guarded,
        }),
      ).resolves.toMatchObject({ dryRun: true })
      expect(calls).toHaveLength(1)
      expect(calls[0].args).toContain('--dry-run')
      expect(preflights).toBe(0)
      expect(verifications).toBe(0)

      await expect(
        runMotiontestDeploy({
          appDir: root,
          args: [],
          env: releaseEnv,
          log() {},
          spawnSyncImpl,
          wranglerBinPath,
          ...guarded,
        }),
      ).rejects.toThrow(/motiontest-specific Cloudflare deploy credentials/i)
      expect(calls).toHaveLength(1)
      expect(preflights).toBe(0)

      await expect(
        runMotiontestDeploy({
          appDir: root,
          args: [],
          env: {
            ...releaseEnv,
            MOTIONTEST_CLOUDFLARE_ACCOUNT_ID: 'account-id',
            MOTIONTEST_CLOUDFLARE_API_TOKEN: 'token',
          },
          log() {},
          spawnSyncImpl,
          wranglerBinPath,
          ...guarded,
        }),
      ).resolves.toMatchObject({ dryRun: false })
      expect(calls).toHaveLength(2)
      expect(calls[1].args).not.toContain('--dry-run')
      expect(calls[1].options.env).toMatchObject({
        CLOUDFLARE_ACCOUNT_ID: 'account-id',
        CLOUDFLARE_API_TOKEN: 'token',
      })
      expect(calls[1].options.env).not.toHaveProperty('MOTIONTEST_CLOUDFLARE_API_TOKEN')
      expect(preflights).toBe(1)
      expect(verifications).toBe(1)
    })
  })

  it('does not report publish completion until public isolation verification succeeds', async () => {
    await withTempApp(async (root) => {
      writeFileSync(resolve(root, 'wrangler.jsonc'), readFileSync(wranglerPath, 'utf8'))
      mkdirSync(resolve(root, '.open-next/assets'), { recursive: true })
      writeFileSync(resolve(root, '.open-next/assets/app.js'), 'asset\n')
      writeFileSync(resolve(root, '.open-next/worker.js'), 'export default { fetch() {} }\n')
      writeGeneratedEnv(root)
      const wranglerBinPath = resolve(root, 'node_modules/wrangler/bin/wrangler.js')
      mkdirSync(dirname(wranglerBinPath), { recursive: true })
      writeFileSync(wranglerBinPath, '// fixture\n')
      const log = []
      const order = []
      let verificationNow = 0
      const liveBaseline = {
        fingerprintSha256: 'c'.repeat(64),
        liveFreshCutIsolated: true,
      }
      const common = {
        appDir: root,
        args: [],
        env: {
          MOTIONTEST_EXPECTED_ARTIFACT_SHA: 'b'.repeat(64),
          MOTIONTEST_CLOUDFLARE_ACCOUNT_ID: 'account-id',
          MOTIONTEST_CLOUDFLARE_API_TOKEN: 'token',
        },
        log: (message) => {
          log.push(message)
          order.push('log')
        },
        preflightImpl: async () => {
          order.push('preflight')
          return liveBaseline
        },
        spawnSyncImpl: () => {
          order.push('spawn')
          return { status: 0 }
        },
        wranglerBinPath,
        releaseIdentityImpl: () => ({
          gitSha: 'a'.repeat(40),
          releaseRef: 'refs/heads/codex/freshcut-motiontest-production-grade',
        }),
        artifactImpl: () => ({ artifactSha256: 'b'.repeat(64) }),
        nowImpl: () => verificationNow,
        propagationIntervalMs: 1,
        propagationTimeoutMs: 1,
        sleepImpl: async (durationMs) => {
          verificationNow += durationMs
        },
      }

      await expect(
        runMotiontestDeploy({
          ...common,
          verifyImpl: async (options) => {
            expect(options).toEqual({ deadlineAt: 1, liveBaseline })
            order.push('verify')
            throw new Error('public verification failed')
          },
        }),
      ).rejects.toThrow(/public verification failed/i)
      expect(log).toEqual([])
      expect(order).toEqual(['preflight', 'spawn', 'verify'])

      order.length = 0
      verificationNow = 0
      await expect(
        runMotiontestDeploy({
          ...common,
          preflightImpl: async () => {
            order.push('preflight')
            throw new Error('live baseline preflight failed')
          },
          verifyImpl: async () => {
            order.push('verify')
          },
        }),
      ).rejects.toThrow(/live baseline preflight failed/i)
      expect(order).toEqual(['preflight'])
      expect(log).toEqual([])

      order.length = 0
      await expect(
        runMotiontestDeploy({
          ...common,
          verifyImpl: async (options) => {
            expect(options).toEqual({ deadlineAt: 1, liveBaseline })
            order.push('verify')
            return { motiontestVerified: true }
          },
        }),
      ).resolves.toMatchObject({ dryRun: false })
      expect(log).toEqual(['Motiontest Worker published and public isolation verified.'])
      expect(order).toEqual(['preflight', 'spawn', 'verify', 'log'])
    })
  })

  it.each([
    [
      'initial HTTP 404',
      Object.assign(new Error('motiontest HTML returned HTTP 404'), {
        code: PROPAGATION_PENDING_CODE,
      }),
    ],
    [
      'old public marker',
      Object.assign(new Error('motiontest marker is missing'), {
        code: PROPAGATION_PENDING_CODE,
      }),
    ],
  ])('retries bounded propagation after %s and then succeeds', async (_label, firstError) => {
    const deploy = await import('./deploy-motiontest.mjs')
    if (!deploy.verifyMotiontestAfterPropagation) {
      expect(deploy.verifyMotiontestAfterPropagation).toBeTypeOf('function')
      return
    }
    const liveBaseline = { fingerprintSha256: 'c'.repeat(64) }
    const sleeps = []
    let attempts = 0
    let now = 1_000

    await expect(
      deploy.verifyMotiontestAfterPropagation({
        intervalMs: 40,
        liveBaseline,
        nowImpl: () => now,
        sleepImpl: async (durationMs) => {
          sleeps.push(durationMs)
          now += durationMs
        },
        timeoutMs: 100,
        verifyImpl: async (options) => {
          attempts += 1
          expect(options).toEqual({ deadlineAt: 1_100, liveBaseline })
          if (attempts === 1) throw firstError
          return { motiontestVerified: true }
        },
      }),
    ).resolves.toEqual({ motiontestVerified: true })
    expect(attempts).toBe(2)
    expect(sleeps).toEqual([40])
  })

  it('exhausts propagation attempts at the total deadline', async () => {
    const deploy = await import('./deploy-motiontest.mjs')
    if (!deploy.verifyMotiontestAfterPropagation) {
      expect(deploy.verifyMotiontestAfterPropagation).toBeTypeOf('function')
      return
    }
    const sleeps = []
    let attempts = 0
    let now = 0

    await expect(
      deploy.verifyMotiontestAfterPropagation({
        intervalMs: 40,
        liveBaseline: { fingerprintSha256: 'c'.repeat(64) },
        nowImpl: () => now,
        sleepImpl: async (durationMs) => {
          sleeps.push(durationMs)
          now += durationMs
        },
        timeoutMs: 100,
        verifyImpl: async () => {
          attempts += 1
          throw Object.assign(new Error('motiontest marker is missing'), {
            code: PROPAGATION_PENDING_CODE,
          })
        },
      }),
    ).rejects.toThrow(/did not converge within 100 ms.*4 attempts.*marker is missing/i)
    expect(attempts).toBe(4)
    expect(sleeps).toEqual([40, 40, 20])
  })

  it.each([
    ['security boundary /admin became public', new Error('/admin returned HTTP 200')],
    [
      'approved asset has the wrong content type',
      new Error('static asset content-type must be application/javascript'),
    ],
    ['unknown verification failure', new Error('unknown verifier failure')],
  ])('does not retry terminal %s', async (_label, terminalError) => {
    const deploy = await import('./deploy-motiontest.mjs')
    if (!deploy.verifyMotiontestAfterPropagation) {
      expect(deploy.verifyMotiontestAfterPropagation).toBeTypeOf('function')
      return
    }
    let attempts = 0
    const sleepImpl = vi.fn()

    await expect(
      deploy.verifyMotiontestAfterPropagation({
        intervalMs: 40,
        liveBaseline: { fingerprintSha256: 'c'.repeat(64) },
        nowImpl: () => 0,
        sleepImpl,
        timeoutMs: 100,
        verifyImpl: async () => {
          attempts += 1
          if (attempts === 1) throw terminalError
          return { motiontestVerified: true }
        },
      }),
    ).rejects.toThrow(terminalError.message)
    expect(attempts).toBe(1)
    expect(sleepImpl).not.toHaveBeenCalled()
  })

  it('does not retry a deterministic live baseline mismatch', async () => {
    const deploy = await import('./deploy-motiontest.mjs')
    if (!deploy.verifyMotiontestAfterPropagation) {
      expect(deploy.verifyMotiontestAfterPropagation).toBeTypeOf('function')
      return
    }
    const mismatch = Object.assign(new Error('live FreshCut baseline fingerprint changed'), {
      code: 'MOTIONTEST_LIVE_FRESHCUT_BASELINE_MISMATCH',
    })
    let attempts = 0
    const sleepImpl = vi.fn()

    await expect(
      deploy.verifyMotiontestAfterPropagation({
        intervalMs: 40,
        liveBaseline: { fingerprintSha256: 'c'.repeat(64) },
        nowImpl: () => 0,
        sleepImpl,
        timeoutMs: 100,
        verifyImpl: async () => {
          attempts += 1
          throw mismatch
        },
      }),
    ).rejects.toThrow(/live FreshCut baseline fingerprint changed/i)
    expect(attempts).toBe(1)
    expect(sleepImpl).not.toHaveBeenCalled()
  })

  it('exposes only the guarded script as the package motiontest deploy entrypoint', () => {
    const packageJson = JSON.parse(readFileSync(resolve(appDir, 'package.json'), 'utf8'))
    expect(packageJson.scripts['build:motiontest']).toBe('node scripts/build-motiontest.mjs')
    expect(packageJson.scripts['deploy:motiontest']).toBe('node scripts/deploy-motiontest.mjs')
    expect(packageJson.dependencies.sharp).toBe('0.34.5')

    const lockfile = parseYaml(readFileSync(resolve(appDir, '../../pnpm-lock.yaml'), 'utf8'))
    expect(lockfile.importers['apps/web'].dependencies.sharp).toEqual({
      specifier: '0.34.5',
      version: '0.34.5',
    })
  })

  it('keeps the GitHub release manual-only and orders browser evidence before build and deploy', () => {
    const workflowPath = resolve(appDir, '../../../.github/workflows/deploy-motiontest.yml')
    expect(existsSync(workflowPath)).toBe(true)

    const workflow = parseYaml(readFileSync(workflowPath, 'utf8'))
    expect(Object.keys(workflow.on ?? {})).toEqual(['workflow_dispatch'])
    expect(workflow.on.workflow_dispatch.inputs).toMatchObject({
      expected_sha: { required: true, type: 'string' },
      expected_ref: { required: true, type: 'string' },
    })
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(workflow.concurrency).toEqual({
      group: 'freshcut-motiontest-worker',
      'cancel-in-progress': false,
    })
    expect(Object.keys(workflow.jobs ?? {})).toEqual(['deploy-motiontest'])

    const job = workflow.jobs['deploy-motiontest']
    expect(job.environment).toBe('motiontest')
    expect(job['timeout-minutes']).toBe(60)
    const steps = job.steps
    const index = (name) => steps.findIndex((step) => step.name === name)
    const testIndex = index('Run full web test suite (includes motiontest contracts)')
    const typecheckIndex = index('Typecheck web')
    const browserInstallIndex = index('Install Playwright browsers for motiontest evidence')
    const browserTestIndex = index('Run local motiontest browser evidence')
    const buildIndex = index('Build and stamp OpenNext motiontest')
    const dryRunIndex = index('Dry-run isolated motiontest Worker')
    const deployIndex = index('Deploy and verify isolated motiontest Worker')
    expect([
      testIndex,
      typecheckIndex,
      browserInstallIndex,
      browserTestIndex,
      buildIndex,
      dryRunIndex,
      deployIndex,
    ]).toEqual(
      [
        ...new Set([
          testIndex,
          typecheckIndex,
          browserInstallIndex,
          browserTestIndex,
          buildIndex,
          dryRunIndex,
          deployIndex,
        ]),
      ].sort((left, right) => left - right),
    )
    expect(testIndex).toBeGreaterThanOrEqual(0)

    expect(steps[testIndex].run).toBe('pnpm --filter @corevo/web test')
    expect(steps[typecheckIndex].run).toBe('pnpm --filter @corevo/web typecheck')
    expect(steps[browserInstallIndex].run).toBe(
      'pnpm exec playwright install --with-deps chromium firefox webkit',
    )
    expect(steps[browserTestIndex].run).toBe(
      'pnpm exec playwright test e2e/motiontest-freshcut.spec.ts e2e/motiontest-freshcut-cls.spec.ts e2e/motiontest-freshcut-nojs.spec.ts --project=chromium --project=firefox --project=webkit',
    )
    expect(steps[browserTestIndex].env).toEqual({
      ...motiontestBuildEnvironment(readWranglerConfig(), {
        appDir,
        configPath: wranglerPath,
      }),
      E2E_PORT: '3000',
      LIVE_FRESHCUT_BASE_URL: 'https://freshcut.corevo.se',
    })
    expect(steps[buildIndex].run).toBe('pnpm --filter @corevo/web build:motiontest')
    expect(steps[dryRunIndex].run).toBe('pnpm --filter @corevo/web deploy:motiontest --dry-run')
    expect(steps[deployIndex].run).toBe('pnpm --filter @corevo/web deploy:motiontest')

    expect(steps[buildIndex].env).toEqual({ NODE_OPTIONS: '' })
    expect(steps[deployIndex].env).toEqual({
      NODE_OPTIONS: '',
      MOTIONTEST_EXPECTED_ARTIFACT_SHA: '${{ steps.motiontest-build.outputs.artifact_sha }}',
      MOTIONTEST_CLOUDFLARE_API_TOKEN: '${{ secrets.MOTIONTEST_CLOUDFLARE_API_TOKEN }}',
      MOTIONTEST_CLOUDFLARE_ACCOUNT_ID: '${{ secrets.MOTIONTEST_CLOUDFLARE_ACCOUNT_ID }}',
    })
    expect(job.env).toEqual({
      MOTIONTEST_EXPECTED_SHA: '${{ inputs.expected_sha }}',
      MOTIONTEST_EXPECTED_REF: '${{ inputs.expected_ref }}',
      MOTIONTEST_ACTUAL_SHA: '${{ github.sha }}',
      MOTIONTEST_ACTUAL_REF: '${{ github.ref }}',
    })
    expect(steps[0]).toMatchObject({
      uses: 'actions/checkout@v4',
      with: { ref: '${{ inputs.expected_sha }}', 'fetch-depth': 0 },
    })
    expect(steps[buildIndex].id).toBe('motiontest-build')
    expect(steps[dryRunIndex].env).toEqual({
      NODE_OPTIONS: '',
      MOTIONTEST_EXPECTED_ARTIFACT_SHA: '${{ steps.motiontest-build.outputs.artifact_sha }}',
    })

    const commands = steps.map((step) => step.run ?? '').join('\n')
    const serializedWorkflow = readFileSync(workflowPath, 'utf8')
    expect(serializedWorkflow).not.toMatch(/MOTIONTEST_SUPABASE_(?:URL|ANON_KEY)/)
    expect(commands).not.toMatch(/deploy-prod\.mjs/i)
    expect(commands).not.toMatch(/supabase\s+(?:db|link|migration)/i)
    expect(serializedWorkflow).not.toMatch(/secrets\.CLOUDFLARE_(?:API_TOKEN|ACCOUNT_ID)/)
    expect(serializedWorkflow).toMatch(/workflow_dispatch only after.*default branch/is)
  })
})
