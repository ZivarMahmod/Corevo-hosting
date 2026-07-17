function isPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/**
 * Realtime is a live calendar aid, not global back-office infrastructure.
 * Keeping the route decision pure makes it hard to accidentally re-download the
 * Supabase realtime transport on Settings, services and platform administration.
 */
export function shouldLoadBookingRealtime(pathname: string): boolean {
  return pathname === '/admin' || isPrefix(pathname, '/admin/bokningar') || isPrefix(pathname, '/personal')
}
