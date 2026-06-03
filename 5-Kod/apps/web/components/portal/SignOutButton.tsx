import { signOut } from '@/app/(auth)/actions'
import { Icon } from './ui/Icon'

/** Server-action logout button (no client JS needed).
 *  `compact` → icon-only door glyph for the sidebar footer (handoff chrome);
 *  default → text button for the un-worlded /konto header. */
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={signOut}>
      <button type="submit" className="portal-signout" aria-label="Logga ut" title="Logga ut">
        {compact ? <Icon name="logout" size={18} /> : 'Logga ut'}
      </button>
    </form>
  )
}
