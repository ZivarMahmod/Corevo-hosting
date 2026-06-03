import { PageSkeleton } from '@/components/platform/PlatformSkeleton'

// Card grid, not a table — reuse the stats-grid skeleton (6 integration cards).
export default function Loading() {
  return <PageSkeleton stats={6} table={false} />
}
