import { signOut } from '@/lib/auth/actions'

/** Server-action logout button (no client JS needed). */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="portal-signout" aria-label="Logga ut" title="Logga ut">
        Logga ut
      </button>
    </form>
  )
}
