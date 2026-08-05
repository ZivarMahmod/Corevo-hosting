import 'server-only'
import { redirect } from 'next/navigation'
import { requireAdminArea } from '@/lib/auth/session'
import { hasOrganizationScope } from './location-context'

/** Extra servergrind för organisationsunika ytor som inte får ärvas av platsadmin. */
export async function requireOrganizationOwner(
  area: 'installningar' | 'platser',
) {
  const user = await requireAdminArea(area)
  if (!(await hasOrganizationScope(user.id))) redirect('/ingen-atkomst')
  return user
}
