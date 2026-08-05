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
const cronWorkflow = readFileSync(
  resolve(repoRoot, '.github', 'workflows', 'cron-booking.yml'),
  'utf8',
)

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
    assert.notEqual(config.env?.staging?.vars?.R2_PUBLIC_BASE_URL, config.vars?.R2_PUBLIC_BASE_URL)
  })

  it('binds production deploy to same-SHA CI and refuses release without E2E', () => {
    assert.match(deployWorkflow, /verify-production-ci:/)
    assert.match(deployWorkflow, /head_sha="\$GITHUB_SHA"/)
    assert.match(deployWorkflow, /needs: verify-production-ci/)
    assert.match(deployWorkflow, /E2E_ENABLED:\s*\$\{\{\s*vars\.E2E_ENABLED\s*\}\}/)
    assert.match(deployWorkflow, /"\$E2E_ENABLED"\s*=\s*"true"/)
    assert.match(ciWorkflow, /release-proof:/)
    assert.match(
      ciWorkflow,
      /needs\.e2e\.result[^\n]+success[\s\S]*?github\.event_name[^\n]+workflow_dispatch[^\n]+needs\.e2e\.result[^\n]+skipped/,
    )
    assert.match(
      ciWorkflow,
      /release-proof:[\s\S]*?Require every configured release gate[\s\S]*?working-directory:\s*\./,
    )
    assert.match(deployWorkflow, /production:[\s\S]*?timeout-minutes:\s*[1-9]/)
  })

  it('selects the exact-SHA CI run that actually passed staging E2E', () => {
    assert.match(deployWorkflow, /\.event == "workflow_dispatch"/)
    assert.match(deployWorkflow, /for candidate_run_id in \$run_ids/)
    assert.match(
      deployWorkflow,
      /select\(\.name == "playwright e2e \(staging\)" and \.conclusion == "success"\)/,
    )
    assert.doesNotMatch(deployWorkflow, /sort_by\(\.run_attempt\) \| last/)
  })

  it('keeps ordinary CI acceptance proof fail-closed without staging credentials', () => {
    assert.match(ciWorkflow, /run: pnpm test:goal93:contract/)
    assert.match(
      ciWorkflow,
      /name:\s*Verify acceptance contracts fail closed without staging credentials/,
    )
    assert.match(ciWorkflow, /output="\$\(pnpm test:acceptance:contract 2>&1\)" && exit 1/)
    assert.match(ciWorkflow, /FAIL 03-P00 expected=ACCEPT_BASE_URL,ACCEPT_ADMIN_EMAIL,ACCEPT_ADMIN_PASSWORD,ACCEPT_THEME actual=missing:/)
    assert.match(ciWorkflow, /FAIL 04-P00 expected=ACCEPT_BASE_URL,ACCEPT_ADMIN_EMAIL,ACCEPT_ADMIN_PASSWORD actual=missing:/)
    assert.match(ciWorkflow, /FAIL 06-P00 expected=ACCEPT_BASE_URL,ACCEPT_STAFF_EMAIL,ACCEPT_STAFF_PASSWORD actual=missing:/)
    assert.match(ciWorkflow, /exit 1/)
  })

  it('exposes staging credentials only to an approved exact-SHA manual E2E run', () => {
    assert.match(ciWorkflow, /workflow_dispatch:[\s\S]*?run_isolated_e2e:[\s\S]*?type:\s*boolean/)
    assert.match(ciWorkflow, /workflow_dispatch:[\s\S]*?candidate_sha:[\s\S]*?required:\s*true/)
    assert.match(
      ciWorkflow,
      /github\.event_name == 'workflow_dispatch'[\s\S]*?inputs\.run_isolated_e2e == true[\s\S]*?github\.ref == 'refs\/heads\/main'[\s\S]*?inputs\.candidate_sha == github\.sha/,
    )
  })

  it('runs the procedural database suites as raw SQL with fail-fast psql', () => {
    assert.doesNotMatch(ciWorkflow, /run:\s*supabase test db/)
    assert.match(ciWorkflow, /docker exec -i "\$db_container" psql/)
    assert.match(ciWorkflow, /ON_ERROR_STOP=1/)
    assert.match(ciWorkflow, /supabase\/tests\/\*_test\.sql/)
    assert.match(ciWorkflow, /customer_portal_cancellation_refunds_0121_concurrency_test\.sh/)
    assert.match(ciWorkflow, /notification_delivery_1230_migration_test\.sh/)
    assert.match(ciWorkflow, /customer_portal_mode_1400_migration_test\.sh/)
  })

  it('puts hard network and job timeouts around the fallback cron', () => {
    assert.match(cronWorkflow, /timeout-minutes:\s*[1-9]/)
    assert.ok((cronWorkflow.match(/--connect-timeout/g) ?? []).length >= 3)
    assert.ok((cronWorkflow.match(/--max-time/g) ?? []).length >= 3)
  })
})
