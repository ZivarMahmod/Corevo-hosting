import Link from 'next/link'

/** "Boka tid" — entry into the booking engine (G04 route `/boka`).
 *  Corevo family signature: gold accent pill (.btn-accent). The gold token is a
 *  fixed product token (not tenant-overridable), so the primary CTA reads the
 *  same across every salon — the family thread through all themes. */
export function BookCta({ className = '' }: { className?: string }) {
  return (
    <Link href="/boka" className={`btn-accent${className ? ` ${className}` : ''}`}>
      Boka tid
    </Link>
  )
}
