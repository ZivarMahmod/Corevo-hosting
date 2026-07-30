import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { deleteR2Keys } from '@/lib/r2/upload'

type CleanupJob = {
  job_id: string
  tenant_id: string
  asset_id: string
  r2_keys: string[]
  attempt: number
  lease_token: string
}

export type MediaCleanupResult = {
  claimed: number
  deleted: number
  retried: number
  failed: number
}

export async function runMediaCleanup(
  supabase: SupabaseClient,
  limit = 20,
): Promise<MediaCleanupResult> {
  const claimed = await supabase.rpc('claim_media_cleanup_jobs', {
    p_limit: limit,
    p_lease_seconds: 120,
  })
  if (claimed.error) throw claimed.error

  const jobs = (claimed.data ?? []) as CleanupJob[]
  const result: MediaCleanupResult = {
    claimed: jobs.length,
    deleted: 0,
    retried: 0,
    failed: 0,
  }

  for (const job of jobs) {
    let deleted = false
    try {
      deleted = await deleteR2Keys(job.r2_keys)
    } catch {
      deleted = false
    }

    if (deleted) {
      const completed = await supabase.rpc('complete_media_cleanup_job', {
        p_job: job.job_id,
        p_lease_token: job.lease_token,
      })
      if (!completed.error && completed.data === true) result.deleted += 1
      else result.failed += 1
      continue
    }

    const retryAfterSeconds = Math.min(
      60 * (2 ** Math.max(job.attempt - 1, 0)),
      3600,
    )
    const retried = await supabase.rpc('retry_media_cleanup_job', {
      p_job: job.job_id,
      p_lease_token: job.lease_token,
      p_error: 'r2_delete_failed',
      p_retry_after_seconds: retryAfterSeconds,
    })
    if (!retried.error && retried.data === true) result.retried += 1
    else result.failed += 1
  }

  return result
}
