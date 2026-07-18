import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { parse } from 'jsonc-parser'

const appRoot = resolve(import.meta.dirname, '..')
const repoRoot = resolve(appRoot, '..', '..', '..')
const config = parse(readFileSync(resolve(appRoot, 'wrangler.jsonc'), 'utf8'))
const worker = readFileSync(resolve(appRoot, 'custom-worker.mjs'), 'utf8')
const deployWorkflow = readFileSync(resolve(repoRoot, '.github', 'workflows', 'deploy.yml'), 'utf8')
const ciWorkflow = readFileSync(resolve(repoRoot, '.github', 'workflows', 'ci.yml'), 'utf8')
const cronWorkflow = readFileSync(resolve(repoRoot, '.github', 'workflows', 'cron-booking.yml'), 'utf8')

describe('Cloudflare primary scheduler wiring', () => {
  it('wraps OpenNext and schedules production reminders every 15 minutes', () => {
    assert.equal(config.main, './custom-worker.mjs')
    assert.deepEqual(config.triggers?.crons, ['*/15 * * * *'])
    assert.match(worker, /runPrimaryScheduler/)
    assert.match(worker, /handler\.fetch/)
  })

  it('keeps staging scheduler-free until it has isolated data/secrets', () => {
    assert.deepEqual(config.env?.staging?.triggers?.crons, [])
    assert.notEqual(
      config.env?.staging?.vars?.NEXT_PUBLIC_SUPABASE_URL,
      config.vars?.NEXT_PUBLIC_SUPABASE_URL,
    )
    assert.notEqual(
      config.env?.staging?.r2_buckets?.[0]?.bucket_name,
      config.r2_buckets?.[0]?.bucket_name,
    )
    assert.notEqual(
      config.env?.staging?.vars?.R2_PUBLIC_BASE_URL,
      config.vars?.R2_PUBLIC_BASE_URL,
    )
  })

  it('binds production deploy to same-SHA CI and requires E2E when staging is enabled', () => {
    assert.match(deployWorkflow, /verify-production-ci:/)
    assert.match(deployWorkflow, /head_sha="\$GITHUB_SHA"/)
    assert.match(deployWorkflow, /needs: verify-production-ci/)
    assert.match(ciWorkflow, /release-proof:/)
    assert.match(
      ciWorkflow,
      /needs\.e2e\.result[^\n]+success[\s\S]*?vars\.E2E_ENABLED[^\n]+true[^\n]+needs\.e2e\.result[^\n]+skipped/,
    )
    assert.match(
      ciWorkflow,
      /release-proof:[\s\S]*?Require every configured release gate[\s\S]*?working-directory:\s*\./,
    )
    assert.match(deployWorkflow, /production:[\s\S]*?timeout-minutes:\s*[1-9]/)
  })

  it('puts hard network and job timeouts around the fallback cron', () => {
    assert.match(cronWorkflow, /timeout-minutes:\s*[1-9]/)
    assert.ok((cronWorkflow.match(/--connect-timeout/g) ?? []).length >= 3)
    assert.ok((cronWorkflow.match(/--max-time/g) ?? []).length >= 3)
  })

  it('never wires a provider or notification dispatcher into the scheduled handler', () => {
    assert.doesNotMatch(worker, /sendSms|dispatchNotificationOutbox|46elks|api\/cron\/notifications/)
  })
})
