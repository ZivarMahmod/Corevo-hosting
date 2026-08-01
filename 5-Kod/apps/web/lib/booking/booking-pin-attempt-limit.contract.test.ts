import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const migrationsDir = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url))
const attemptLimitMigration = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .reverse()
  .map((name) => readFileSync(`${migrationsDir}/${name}`, 'utf8').toLowerCase())
  .find((source) => source.includes('goal 74: three pin attempts'))

describe('booking PIN attempt limit migration', () => {
  it('locks the deployed finalize function to three failed attempts', () => {
    expect(attemptLimitMigration).toBeTruthy()
    expect(attemptLimitMigration).toContain('v_challenge.attempt_count >= 3')
    expect(attemptLimitMigration).toContain("v_challenge.attempt_count + 1 >= 3")
    expect(attemptLimitMigration).toContain("greatest(0, 3 - (v_challenge.attempt_count + 1))")
  })

  it('uses the canonical booking host in durable notification links', () => {
    expect(attemptLimitMigration).toContain("'.boka.corevo.se'")
    expect(attemptLimitMigration).not.toContain("'.corevo.se'")
  })
})
