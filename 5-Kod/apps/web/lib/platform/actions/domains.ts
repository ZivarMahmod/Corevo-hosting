'use server'

import { revalidatePath } from 'next/cache'
import { platformCtx } from '../guard'
import { logPlatformAction } from '../audit'
import { validateDomainInput } from '../domains'
import {
  createCustomHostname,
  getCustomHostnameByName,
  deleteCustomHostname,
} from '@/lib/cloudflare/custom-hostnames'
import { type DomainActionState } from './shared'
import { reportActionError } from './observe'

// ── goal-23: custom-domain provisioning (Cloudflare for SaaS) ────────────────────
// The READ half (resolve_tenant_by_domain, 0019) is already live; these are the WRITE
// half. platform_admin-gated (the DomänPanel lives in the platform tenant-detail).
// Cloudflare creds are ops-gated → every action fail-closes with a clear message when
// the CF client reports missing credentials (the build + flag-off panel never break).
// The DOMAIN_PROVISIONING_ENABLED flag gates the UI; these actions are an additional
// (server-side) fence only in that they require the CF creds the flag implies.

const DOMAIN_PATH = (tenantId: string) => `/kunder/${tenantId}`

// audit_log.entity_id is a uuid column — NEVER pass a domain string as entityId (the
// insert would 22P02 and silently drop the audit row). We omit entityId (it falls back
// to the uuid tenantId in logPlatformAction) and carry the domain in meta.

/**
 * Provision a customer's own domain: validate → confirm the tenant exists + is active →
 * reject duplicates → create the Cloudflare custom hostname → write a tenant_domains row
 * (verified:false until DCV passes) → return the DCV records. If the DB insert fails
 * AFTER the CF hostname was created, the CF hostname is best-effort deleted so no orphan
 * lingers. If CF fails (incl. missing creds), NO row is written.
 */
export async function addCustomDomain(_p: DomainActionState, fd: FormData): Promise<DomainActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  if (!tenantId) return { error: 'Saknar kund.' }
  const { domain, error: vErr } = validateDomainInput(String(fd.get('domain') ?? ''))
  if (vErr || !domain) return { error: vErr ?? 'Ogiltig domän.' }

  // Validate the tenant server-side (exists + active) BEFORE touching Cloudflare, so we
  // never provision a hostname for a missing/suspended/deleted salon (mirrors createPlatformCustomer).
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, status')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant) return { error: 'Kunden finns inte.' }
  if (tenant.status !== 'active') return { error: 'Kunden är inte aktiv — kan inte lägga till domän.' }

  // Globally unique (tenant_domains.domain unique). Reject up front so we never create
  // an orphan CF hostname for a domain we then can't persist.
  const { data: existing } = await supabase
    .from('tenant_domains')
    .select('id')
    .eq('domain', domain)
    .maybeSingle()
  if (existing) return { error: 'Domänen är redan registrerad.' }

  const cf = await createCustomHostname(domain)
  if (!cf.ok) return { error: cf.error }

  const { error } = await supabase.from('tenant_domains').insert({
    tenant_id: tenantId,
    domain,
    verified: false,
    is_primary: false,
  })
  if (error) {
    // Insert failed after CF created the hostname — best-effort delete to avoid an
    // orphan CF hostname the panel could never surface (no row → no Ta bort-knapp).
    if (cf.data.id) await deleteCustomHostname(cf.data.id)
    await reportActionError('addCustomDomain.insert', error, { tenantId, domain })
    return { error: 'Kunde inte spara domänen. Försök igen.' }
  }

  revalidatePath(DOMAIN_PATH(tenantId))
  await logPlatformAction(supabase, {
    action: 'domain.add',
    tenantId,
    actorId: user.id,
    meta: { domain, cf_status: cf.data.status },
  })
  return {
    success: `Domänen ${domain} tillagd. Be kunden lägga in DNS-posterna nedan, verifiera sedan.`,
    hostname: { domain, status: cf.data.status, sslStatus: cf.data.sslStatus, dcv: cf.data.dcv },
  }
}

/**
 * Poll the Cloudflare hostname status. Flip tenant_domains.verified = true ONLY when CF
 * confirms BOTH the hostname AND the SSL cert active — the resolution read (0019) routes
 * any verified=true row live, so the gate must require positive proof, never absence of a
 * negative. Otherwise report the still-pending status honestly (verified:false).
 */
export async function verifyCustomDomain(_p: DomainActionState, fd: FormData): Promise<DomainActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const domain = validateDomainInput(String(fd.get('domain') ?? '')).domain
  if (!tenantId || !domain) return { error: 'Saknar kund eller domän.' }

  const cf = await getCustomHostnameByName(domain)
  if (!cf.ok) return { error: cf.error }
  if (!cf.data) return { error: 'Cloudflare känner inte till domänen — lägg till den igen.' }

  // Fail-CLOSED: require the hostname active AND the SSL cert active. A null/missing ssl
  // status is NOT proof — it keeps the domain unverified.
  const isActive = cf.data.status === 'active' && cf.data.sslStatus === 'active'
  if (!isActive) {
    return {
      verified: false,
      success: `Domänen är inte verifierad ännu (status: ${cf.data.status}${cf.data.sslStatus ? ` · SSL: ${cf.data.sslStatus}` : ''}). DNS-ändringar kan ta upp till några timmar.`,
      hostname: { domain, status: cf.data.status, sslStatus: cf.data.sslStatus, dcv: cf.data.dcv },
    }
  }

  const { error } = await supabase
    .from('tenant_domains')
    .update({ verified: true })
    .eq('tenant_id', tenantId)
    .eq('domain', domain)
  if (error) {
    await reportActionError('verifyCustomDomain.update', error, { tenantId, domain })
    return { error: 'Kunde inte uppdatera domänstatus.' }
  }

  revalidatePath(DOMAIN_PATH(tenantId))
  await logPlatformAction(supabase, {
    action: 'domain.verify',
    tenantId,
    actorId: user.id,
    meta: { domain },
  })
  return {
    verified: true,
    success: `Domänen ${domain} är verifierad och live.`,
    hostname: { domain, status: cf.data.status, sslStatus: cf.data.sslStatus, dcv: [] },
  }
}

/**
 * Un-provision a domain: delete the Cloudflare custom hostname, then the
 * tenant_domains row. The row is operational routing config (no historical data
 * hangs off it), so a hard delete is correct here — the resolution read simply stops
 * resolving it. If the CF lookup/delete fails (incl. missing creds) we DON'T delete
 * the row, so the panel never leaves a live CF hostname with no local record.
 */
export async function removeCustomDomain(_p: DomainActionState, fd: FormData): Promise<DomainActionState> {
  const { user, supabase } = await platformCtx()

  const tenantId = String(fd.get('tenantId') ?? '')
  const domain = validateDomainInput(String(fd.get('domain') ?? '')).domain
  if (!tenantId || !domain) return { error: 'Saknar kund eller domän.' }

  const cf = await getCustomHostnameByName(domain)
  if (!cf.ok) return { error: cf.error }
  if (cf.data?.id) {
    const del = await deleteCustomHostname(cf.data.id)
    if (!del.ok) return { error: del.error }
  }

  const { error } = await supabase
    .from('tenant_domains')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('domain', domain)
  if (error) {
    await reportActionError('removeCustomDomain.delete', error, { tenantId, domain })
    return { error: 'Kunde inte ta bort domänen.' }
  }

  revalidatePath(DOMAIN_PATH(tenantId))
  await logPlatformAction(supabase, {
    action: 'domain.remove',
    tenantId,
    actorId: user.id,
    meta: { domain },
  })
  return { success: `Domänen ${domain} borttagen.` }
}
