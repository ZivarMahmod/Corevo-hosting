import { signOut } from '@/app/(auth)/actions'

/** Server-action logout button (no client JS needed). */
export function SignOutButton() {
  return (
    <form action={signOut}>
      <button type="submit" className="portal-signout">
        Logga ut
      </button>
    </form>
  )
}
