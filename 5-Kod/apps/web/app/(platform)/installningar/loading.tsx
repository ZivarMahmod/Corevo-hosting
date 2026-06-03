import { PageSkeleton } from '@/components/platform/PlatformSkeleton'

export default function Loading() {
  // Settings is a stacked card column, not a table — skip the table skeleton.
  return <PageSkeleton table={false} />
}
