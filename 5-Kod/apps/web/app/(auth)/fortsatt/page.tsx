import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { portalHomeFor, PORTAL_MIN_LEVEL } from '@/lib/auth/roles'

/**
 * Invite completion landing. The client must not infer a role from the invite
 * URL or choose booking `/` (which is the owner entry). Re-read the current
 * database-backed role/staff activation through the DAL before redirecting.
 */
export default async function InviteLandingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.roleLevel < PORTAL_MIN_LEVEL.personal) redirect('/ingen-atkomst')

  redirect(
    portalHomeFor({
      roleLevel: user.roleLevel,
      platformAdmin: user.platformAdmin,
    }),
  )
}
