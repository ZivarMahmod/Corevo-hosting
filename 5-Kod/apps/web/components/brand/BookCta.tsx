import Link from 'next/link'

/** "Boka tid" — entry into the booking engine (G04 route `/boka`). */
export function BookCta({ className = '' }: { className?: string }) {
  return (
    <Link href="/boka" className={`btn-primary${className ? ` ${className}` : ''}`}>
      Boka tid
    </Link>
  )
}
