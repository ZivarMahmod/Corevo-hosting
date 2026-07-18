'use server'

import { revalidatePath } from 'next/cache'
import { inviteRedirectUrl } from '@/lib/auth/invite'
import { platformAdminCtx, platformCtx } from '../guard'
import { createServiceClient } from '../service'
import { parsePartnerPriceOre } from '../partners-shared'
import { EMAIL_RE, type ActionState } from './shared'

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/
const COUNTRY_RE = /^[A-Z]{2}$/
const CURRENCY_RE = /^[A-Z]{3}$/
const PROVIDERS = new Set(['corevo_46elks', 'partner_46elks'])

function clean(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim()
}

function validTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

async function compensatePartnerProvisioning(args: {
  authId: string | null
  partnerId: string
  service: NonNullable<ReturnType<typeof createServiceClient>>
}): Promise<boolean> {
  // Delete the provisioning shell first with an exact status predicate. If an
  // activation committed despite an ambiguous response, Auth stays untouched.
  const { data: deletedPartner, error: partnerDeleteError } = await args.service
    .from('partners')
    .delete()
    .eq('id', args.partnerId)
    .eq('status', 'provisioning')
    .select('id')
    .maybeSingle()
  if (partnerDeleteError || !deletedPartner) return false

  // Partner deletion cascades membership. Remove Auth next; on failure, strip
  // routing hints and sever the remaining public profile.
  let authDeleted = true
  if (args.authId) {
    const { error } = await args.service.auth.admin.deleteUser(args.authId)
    authDeleted = !error
    if (error) {
      await args.service.auth.admin.updateUserById(args.authId, {
        app_metadata: {
          platform_admin: false,
          partner_admin: false,
        },
      })
      await args.service
        .from('partner_members')
        .delete()
        .eq('partner_id', args.partnerId)
        .eq('user_id', args.authId)
      await args.service.from('users').delete().eq('id', args.authId)
    }
  }
  return authDeleted
}

async function partnerMetadataCommitted(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  authId: string,
  partnerId: string,
): Promise<boolean> {
  const { data, error } = await service.auth.admin.getUserById(authId)
  const metadata = data.user?.app_metadata
  return !error
    && metadata?.platform_admin === false
    && metadata?.partner_admin === true
    && metadata?.partner_id === partnerId
}

async function partnerProfileCommitted(args: {
  authId: string
  email: string
  roleId: string
  service: NonNullable<ReturnType<typeof createServiceClient>>
}): Promise<boolean> {
  const { data, error } = await args.service
    .from('users')
    .select('id, tenant_id, email, role_id, status')
    .eq('id', args.authId)
    .maybeSingle()
  return !error
    && data?.id === args.authId
    && data.tenant_id === null
    && data.email === args.email
    && data.role_id === args.roleId
    && data.status === 'active'
}

async function partnerMembershipCommitted(args: {
  authId: string
  partnerId: string
  service: NonNullable<ReturnType<typeof createServiceClient>>
}): Promise<boolean> {
  const { data, error } = await args.service
    .from('partner_members')
    .select('partner_id, user_id, role, status')
    .eq('partner_id', args.partnerId)
    .eq('user_id', args.authId)
    .maybeSingle()
  return !error
    && data?.partner_id === args.partnerId
    && data.user_id === args.authId
    && data.role === 'owner'
    && data.status === 'active'
}

async function partnerActivationCommitted(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  partnerId: string,
): Promise<boolean> {
  const { data, error } = await service
    .from('partners')
    .select('id')
    .eq('id', partnerId)
    .eq('status', 'active')
    .maybeSingle()
  return !error && data?.id === partnerId
}

/** Root creates the partner organization and sends its owner a real Auth invite. */
export async function createPartner(_previous: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await platformAdminCtx()
  const name = clean(fd, 'name')
  const slug = clean(fd, 'slug').toLowerCase()
  const email = clean(fd, 'email').toLowerCase()
  const countryCode = clean(fd, 'countryCode').toUpperCase()
  const currency = clean(fd, 'currency').toUpperCase()
  const timezone = clean(fd, 'timezone')
  const priceOre = parsePartnerPriceOre(clean(fd, 'licensePrice'))

  if (!name || name.length > 160) return { error: 'Ange partnerns namn.' }
  if (!SLUG_RE.test(slug)) return { error: 'Sluggen ska vara 2–63 små bokstäver, siffror eller bindestreck.' }
  if (!EMAIL_RE.test(email)) return { error: 'Ange en giltig e-postadress för partnern.' }
  if (!COUNTRY_RE.test(countryCode)) return { error: 'Ange landskod med två bokstäver.' }
  if (!CURRENCY_RE.test(currency)) return { error: 'Ange valutakod med tre bokstäver.' }
  if (!validTimezone(timezone)) return { error: 'Ange en giltig tidszon, exempelvis Europe/Athens.' }
  if (priceOre === null) return { error: 'Ange ett giltigt valfritt månadspris med högst två decimaler.' }

  const service = createServiceClient()
  if (!service) return { error: 'Partnerinbjudan kräver SUPABASE_SERVICE_ROLE_KEY i driftmiljön.' }

  const { data: role } = await supabase
    .from('roles')
    .select('id')
    .is('tenant_id', null)
    .eq('name', 'partner_admin')
    .eq('level', 7)
    .maybeSingle()
  if (!role) return { error: 'Partnerrollen saknas. Kör partnermigrationerna först.' }

  const { data: existingUser } = await service
    .from('users')
    .select('id')
    .ilike('email', email)
    .maybeSingle()
  if (existingUser) return { error: 'E-postadressen är redan kopplad till ett Corevo-konto.' }

  const { data: partner, error: partnerError } = await supabase
    .from('partners')
    .insert({
      name,
      slug,
      country_code: countryCode,
      currency,
      timezone,
      license_price_ore: priceOre,
      status: 'provisioning',
    })
    .select('id')
    .single()
  if (partnerError || !partner) return { error: 'Partnern kunde inte skapas. Kontrollera att sluggen är ledig.' }

  let authId: string | null = null
  const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: inviteRedirectUrl('partner'),
    data: { partner_name: name },
  })
  if (inviteError || !invited.user) {
    const { error: cleanupError } = await service
      .from('partners')
      .delete()
      .eq('id', partner.id)
      .eq('status', 'provisioning')
    return cleanupError
      ? { error: 'manual_cleanup_required: Inbjudan misslyckades och det provisoriska partnerskalet kunde inte städas.' }
      : { error: 'Partnern skapades inte eftersom e-postinbjudan misslyckades.' }
  }
  authId = invited.user.id

  const { error: metadataError } = await service.auth.admin.updateUserById(authId, {
    app_metadata: {
      platform_admin: false,
      partner_admin: true,
      partner_id: partner.id,
    },
  })
  const metadataReady = !metadataError
    || await partnerMetadataCommitted(service, authId, partner.id)
  if (metadataReady) {
    const { error: userError } = await supabase.from('users').insert({
      id: authId,
      tenant_id: null,
      email,
      role_id: role.id,
      status: 'active',
    })
    const profileReady = !userError || await partnerProfileCommitted({
      authId,
      email,
      roleId: role.id,
      service,
    })
    if (profileReady) {
      const { error: memberError } = await supabase.from('partner_members').insert({
        partner_id: partner.id,
        user_id: authId,
        role: 'owner',
        status: 'active',
      })
      const membershipReady = !memberError || await partnerMembershipCommitted({
        authId,
        partnerId: partner.id,
        service,
      })
      if (membershipReady) {
        // Activation is the commit boundary. Before this exact write the DB-backed
        // identity resolver rejects the invited user even if Auth metadata exists.
        const { error: activationError } = await supabase
          .from('partners')
          .update({ status: 'active' })
          .eq('id', partner.id)
          .eq('status', 'provisioning')
        const activated = await partnerActivationCommitted(service, partner.id)
        if ((!activationError || activated) && activated) {
          revalidatePath('/partners')
          return { success: `Partnern ${name} skapades och inbjudan skickades till ${email}.` }
        }
      }
    }
  }

  const cleaned = await compensatePartnerProvisioning({
    authId,
    partnerId: partner.id,
    service,
  })
  return cleaned
    ? { error: 'Inbjudan kunde inte slutföras. Det provisoriska kontot städades; försök igen.' }
    : { error: 'manual_cleanup_required: Partnerkontot kunde inte spärras och städas helt. Kontrollera Auth och partnerlistan.' }
}

/** Root edits identity, arbitrary license price and partner lifecycle. */
export async function updatePartner(_previous: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await platformAdminCtx()
  const partnerId = clean(fd, 'partnerId')
  const name = clean(fd, 'name')
  const priceOre = parsePartnerPriceOre(clean(fd, 'licensePrice'))
  const status = clean(fd, 'status')
  if (!partnerId || !name || name.length > 160) return { error: 'Partneruppgifterna är ofullständiga.' }
  if (priceOre === null) return { error: 'Ange ett giltigt valfritt månadspris med högst två decimaler.' }
  if (status !== 'active' && status !== 'suspended') return { error: 'Ogiltig partnerstatus.' }

  const { data, error } = await supabase
    .from('partners')
    .update({ name, license_price_ore: priceOre, status })
    .eq('id', partnerId)
    .in('status', ['active', 'suspended'])
    .select('id')
    .maybeSingle()
  if (error || !data) {
    return { error: 'Partnern kunde inte uppdateras. Ett ofullständigt provisoriskt konto måste städas och bjudas in på nytt.' }
  }

  revalidatePath('/partners')
  revalidatePath('/fakturering')
  return { success: 'Partnern uppdaterades. Den öppna månadens licenssumma räknades om.' }
}

/** Root can assign or move a tenant. An active move qualifies both partners for the month. */
export async function moveTenantToPartner(
  _previous: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { supabase } = await platformAdminCtx()
  const tenantId = clean(fd, 'tenantId')
  const partnerId = clean(fd, 'partnerId')
  if (!tenantId) return { error: 'Välj en kund.' }
  if (partnerId) {
    const { data: partner } = await supabase
      .from('partners')
      .select('id')
      .eq('id', partnerId)
      .eq('status', 'active')
      .maybeSingle()
    if (!partner) return { error: 'Målpartnern är inte aktiv eller saknas.' }
  }

  const { data, error } = await supabase
    .from('tenants')
    .update({ partner_id: partnerId || null })
    .eq('id', tenantId)
    .select('id')
    .maybeSingle()
  if (error || !data) return { error: 'Kunden kunde inte flyttas.' }

  revalidatePath('/partners')
  revalidatePath('/kunder')
  revalidatePath(`/kunder/${tenantId}`)
  return {
    success: partnerId
      ? 'Kunden flyttades. En kund som varit aktiv någon gång under månaden räknas som hel månad hos både tidigare och ny partner.'
      : 'Kunden flyttades till Corevo (partner noll).',
  }
}

/** Root may configure any partner; a partner is forced to its verified own id. */
export async function savePartnerSmsConfig(
  _previous: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const { supabase, scope } = await platformCtx()
  const requestedPartnerId = clean(fd, 'partnerId')
  const partnerId = scope.kind === 'partner' ? scope.partnerId : requestedPartnerId
  const providerKey = clean(fd, 'providerKey')
  const sender = clean(fd, 'sender')
  const enabled = fd.get('enabled') === 'on'
  if (!partnerId) return { error: 'Saknar partner.' }
  if (!PROVIDERS.has(providerKey)) return { error: 'Ogiltig SMS-leverantör.' }
  if (sender.length > 40) return { error: 'Avsändarnamnet får vara högst 40 tecken.' }

  const { error } = await supabase.rpc('save_partner_sms_config', {
    p_partner: partnerId,
    p_provider_key: providerKey,
    p_sender: sender,
    p_username: clean(fd, 'username') || undefined,
    p_password: clean(fd, 'password') || undefined,
    p_callback_secret: clean(fd, 'callbackSecret') || undefined,
    p_enabled: enabled,
  })
  if (error) {
    return { error: 'SMS-konfigurationen kunde inte sparas. Egen 46elks kräver användarnamn, lösenord och callback-hemlighet.' }
  }

  revalidatePath('/partners')
  revalidatePath('/fakturering')
  return { success: 'SMS-konfigurationen sparades. Hemligheter lagras krypterat i Vault.' }
}
