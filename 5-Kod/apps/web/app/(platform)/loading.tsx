import { PageSkeleton } from '@/components/platform/PlatformSkeleton'

/** Shared fallback for platform routes that do not need a bespoke skeleton. */
export default function PlatformLoading() {
  return <PageSkeleton stats={4} />
}
