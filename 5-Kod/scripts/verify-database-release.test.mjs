import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  assertHistoryParity,
  assertProductionCheckpoint,
  migrationFingerprint,
  parseMigrationList,
  verifyInventory,
} from './verify-database-release.mjs'

describe('database release verification', () => {
  it('requires unique migrations, the expected latest version and every launch SQL test', () => {
    const result = verifyInventory({
      migrationFiles: [
        '0092_durable_notifications_outbox.sql',
        '0093_public_booking_integrity.sql',
        '0094_atomic_staff_walk_in.sql',
        '0095_booking_outcome_truth.sql',
        '0096_customer_account_claim.sql',
        '0097_sms_delivery_gate.sql',
        '0098_staff_invite_cleanup.sql',
        '0099_atomic_tenant_customer_erase.sql',
        '0100_notification_event_routing.sql',
        '0101_customer_relationship_access.sql',
        '0102_scheduler_heartbeat.sql',
        '0103_storefront_booking_release_truth.sql',
        '0104_booking_request_notification_truth.sql',
        '0105_restore_deferred_schema_contracts.sql',
        '0106_platform_insyn_rpcs.sql',
        '0107_restore_global_platform_identity.sql',
      ],
      testFiles: [
        'notifications_outbox_0092_test.sql',
        'public_booking_integrity_0093_test.sql',
        'atomic_staff_walk_in_0094_test.sql',
        'booking_outcome_truth_0095_test.sql',
        'customer_account_claim_0096_test.sql',
        'sms_delivery_gate_0097_test.sql',
        'staff_invite_cleanup_0098_test.sql',
        'atomic_tenant_customer_erase_0099_test.sql',
        'notification_event_routing_0100_test.sql',
        'customer_relationship_0101_test.sql',
        'scheduler_heartbeat_0102_test.sql',
        'storefront_booking_release_truth_0103_test.sql',
        'booking_request_notification_truth_0104_test.sql',
        'deferred_schema_contracts_0105_test.sql',
        'platform_insyn_rpcs_0106_test.sql',
        'global_platform_identity_0107_test.sql',
      ],
      expectedLatest: '0107',
      requiredTestVersions: [
        '0092', '0093', '0094', '0095', '0096', '0097',
        '0098', '0099', '0100', '0101', '0102', '0103', '0104', '0105', '0106', '0107',
      ],
    })

    assert.equal(result.latest, '0107')
    assert.equal(result.migrationCount, 16)
  })

  it('fails closed on duplicate versions or a missing SQL test', () => {
    assert.throws(() => verifyInventory({
      migrationFiles: ['0102_a.sql', '0102_b.sql'],
      testFiles: [],
      expectedLatest: '0102',
      requiredTestVersions: ['0102'],
    }), /duplicate migration version 0102/)

    assert.throws(() => verifyInventory({
      migrationFiles: ['0102_scheduler_heartbeat.sql'],
      testFiles: [],
      expectedLatest: '0102',
      requiredTestVersions: ['0102'],
    }), /missing pgTAP test for migration 0102/)
  })

  it('rejects timestamp and malformed migration filenames', () => {
    assert.throws(() => verifyInventory({
      migrationFiles: ['20260718120000_wrong_series.sql'],
      testFiles: [],
    }), /expected NNNN_lowercase_name\.sql/)

    assert.throws(() => verifyInventory({
      migrationFiles: ['0105-Mixed Name.sql'],
      testFiles: [],
    }), /expected NNNN_lowercase_name\.sql/)
  })

  it('parses Supabase CLI migration tables and detects local/remote drift', () => {
    const history = parseMigrationList(`
      LOCAL | REMOTE | TIME (UTC)
      0099  | 0099   |
      0100  | 0100   |
      0101  |        |
    `)

    assert.deepEqual(history.local, ['0099', '0100', '0101'])
    assert.deepEqual(history.remote, ['0099', '0100'])
    assert.throws(
      () => assertHistoryParity({ expected: history.local, actual: history.remote }),
      /missing remotely: 0101/,
    )

    const markdownHistory = parseMigrationList(`
      LOCAL  | REMOTE | TIME (UTC)
      \`0106\` | \`0106\` | \`0106\`
      \`0107\` | \`0107\` | \`0107\`
    `)

    assert.deepEqual(markdownHistory.local, ['0106', '0107'])
    assert.deepEqual(markdownHistory.remote, ['0106', '0107'])

    const jsonHistory = parseMigrationList(JSON.stringify({
      migrations: [
        { local: '0106', remote: '0106', time: '0106' },
        { local: '0107', remote: '0107', time: '0107' },
      ],
      message: 'Migrations listed',
    }))

    assert.deepEqual(jsonHistory.local, ['0106', '0107'])
    assert.deepEqual(jsonHistory.remote, ['0106', '0107'])
  })

  it('requires a reviewed, aligned production checkpoint at the exact release version', () => {
    assert.throws(() => assertProductionCheckpoint({
      checkpoint: {
        status: 'blocked',
        requiredLatest: '0102',
        observedHistoryLatest: '0082',
        historyAligned: false,
        schemaAligned: false,
      },
      expectedLatest: '0102',
      declaredLatest: '0102',
      expectedFingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }), /production schema checkpoint is blocked/)

    assert.throws(() => assertProductionCheckpoint({
      checkpoint: {
        status: 'verified',
        requiredLatest: '0102',
        observedHistoryLatest: '0102',
        historyAligned: true,
        schemaAligned: false,
        verifiedAt: '2026-07-18T00:00:00Z',
        verifiedBy: 'operator',
      },
      expectedLatest: '0102',
      declaredLatest: '0102',
      expectedFingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }), /production schema has not been proven aligned/)

    assert.throws(() => assertProductionCheckpoint({
      checkpoint: {
        status: 'verified', requiredLatest: '0102', observedHistoryLatest: '0102',
        historyAligned: true, schemaAligned: true,
        verifiedAt: 'not-a-date', verifiedBy: 'operator',
        migrationFingerprint: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        verificationEvidence: 'restore-run-123',
      },
      expectedLatest: '0102', declaredLatest: '0102',
      expectedFingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }), /fingerprint/)

    assert.doesNotThrow(() => assertProductionCheckpoint({
      checkpoint: {
        status: 'verified',
        requiredLatest: '0102',
        observedHistoryLatest: '0102',
        historyAligned: true,
        schemaAligned: true,
        verifiedAt: '2026-07-18T00:00:00Z',
        verifiedBy: 'operator',
        migrationFingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        verificationEvidence: 'restore-run-123',
      },
      expectedLatest: '0102',
      declaredLatest: '0102',
      expectedFingerprint: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }))
  })

  it('fingerprints migration names and contents deterministically', () => {
    const first = migrationFingerprint([
      { name: '0002_b.sql', content: 'select 2;' },
      { name: '0001_a.sql', content: 'select 1;' },
    ])
    const reordered = migrationFingerprint([
      { name: '0001_a.sql', content: 'select 1;' },
      { name: '0002_b.sql', content: 'select 2;' },
    ])
    assert.match(first, /^sha256:[0-9a-f]{64}$/)
    assert.equal(first, reordered)
    assert.notEqual(first, migrationFingerprint([{ name: '0001_a.sql', content: 'select 9;' }]))
  })
})
