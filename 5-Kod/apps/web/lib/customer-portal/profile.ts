import 'server-only'

import { cookies } from 'next/headers'
import { createServiceClient } from '@/lib/platform/service'
import {
  bookingContactDigest,
  maskBookingContact,
  normalizeBookingContact,
  type BookingVerificationChannel,
} from '@/lib/booking/verification'
import { portalSessionDigest } from './crypto'
import { PORTAL_SESSION_COOKIE, parsePortalSessionCookie } from './session'
import { containsUnicode17Forbidden } from './unicode17-policy'
import type {
  PortalProfileSnapshot,
  PortalProfileSnapshotResult,
  PortalContactChangeAction,
  PortalSecondaryContact,
} from './types'

type ProfileRpcClient = {
  rpc: (
    name: 'customer_portal_profile_snapshot' | 'customer_portal_update_name',
    args: Record<string, string>,
  ) => PromiseLike<{ data: unknown; error: unknown }>
}

export type PortalNameUpdateResult =
  | { outcome: 'success'; name: string }
  | { outcome: 'invalid' }
  | { outcome: 'expired' }
  | { outcome: 'unavailable' }

const TENANT_SLUG_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/
const CONTROL = /[\u0000-\u001f\u007f]/
const DIGEST_PATTERN = /^[a-f0-9]{64}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function hasOnlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(record).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function safeText(value: unknown, minimum: number, maximum: number): string | null {
  if (typeof value !== 'string' || value !== value.trim() || CONTROL.test(value)) return null
  const length = [...value].length
  return length >= minimum && length <= maximum ? value : null
}

function isSafeMaskedDestination(channel: 'sms' | 'email', value: string): boolean {
  if (channel === 'sms') return /^\+[0-9]{2} ••• •• [0-9]{2}$/.test(value)
  return /^[^@\s•]•••@[^@\s•]+\.[^@\s•]+$/u.test(value)
}

type ProfileProof = {
  channel: BookingVerificationChannel
  contactDigest: string
  maskedDestination: string
  maskValid: boolean
}

type ProfileEvidence = {
  tenantSlug: string
  tenantName: string
  customerName: string
  phone: string | null
  email: string | null
  proofs: ProfileProof[]
}

function parseEvidenceContact(value: unknown): string | null | 'invalid' {
  if (value === null) return null
  if (typeof value !== 'string' || value.length > 200 || CONTROL.test(value)) return 'invalid'
  return value
}

function parseProof(value: unknown): ProfileProof | null {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'channel', 'contactDigest', 'maskedDestination', 'maskValid',
  ])) return null
  const maskedDestination = safeText(value.maskedDestination, 3, 200)
  if (
    (value.channel !== 'sms' && value.channel !== 'email') ||
    typeof value.contactDigest !== 'string' ||
    !DIGEST_PATTERN.test(value.contactDigest) ||
    typeof value.maskValid !== 'boolean' ||
    !maskedDestination
  ) return null
  return {
    channel: value.channel,
    contactDigest: value.contactDigest,
    maskedDestination,
    maskValid: value.maskValid,
  }
}

function parseProfileEvidence(value: unknown): ProfileEvidence | null {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'customerName', 'email', 'phone', 'proofs', 'tenantName', 'tenantSlug',
  ])) return null
  const tenantName = safeText(value.tenantName, 1, 200)
  const customerName = safeText(value.customerName, 0, 120)
  const phone = parseEvidenceContact(value.phone)
  const email = parseEvidenceContact(value.email)
  if (
    typeof value.tenantSlug !== 'string' ||
    !TENANT_SLUG_PATTERN.test(value.tenantSlug) ||
    !tenantName ||
    customerName === null ||
    containsUnicode17Forbidden(customerName) ||
    phone === 'invalid' ||
    email === 'invalid' ||
    !Array.isArray(value.proofs) ||
    value.proofs.length > 256
  ) return null
  const proofs = value.proofs.map(parseProof)
  if (proofs.some((proof) => proof === null)) return null
  return {
    tenantSlug: value.tenantSlug,
    tenantName,
    customerName,
    phone,
    email,
    proofs: proofs as ProfileProof[],
  }
}

async function exactContact(input: {
  channel: BookingVerificationChannel
  raw: string
  proofs: ProfileProof[]
  required: boolean
}): Promise<{ maskedDestination: string; verified: boolean } | null> {
  const normalized = normalizeBookingContact(input.channel, input.raw)
  if (!normalized) return null
  const maskedDestination = maskBookingContact(input.channel, normalized)
  if (
    containsUnicode17Forbidden(maskedDestination) ||
    !isSafeMaskedDestination(input.channel, maskedDestination)
  ) return null
  const expectedDigest = await bookingContactDigest(input.channel, normalized)
  const matching = input.proofs.filter((proof) => (
    proof.channel === input.channel && proof.contactDigest === expectedDigest
  ))
  if (matching.some((proof) => (
    !proof.maskValid ||
    containsUnicode17Forbidden(proof.maskedDestination) ||
    !isSafeMaskedDestination(input.channel, proof.maskedDestination) ||
    proof.maskedDestination !== maskedDestination
  ))) return null
  if (input.required && matching.length === 0) return null
  return { maskedDestination, verified: matching.length > 0 }
}

async function projectEvidence(evidence: ProfileEvidence): Promise<PortalProfileSnapshot | null> {
  const phonePresent = evidence.phone !== null && evidence.phone.trim() !== ''
  if (phonePresent) {
    const primary = await exactContact({
      channel: 'sms', raw: evidence.phone!, proofs: evidence.proofs, required: true,
    })
    if (!primary) return null
    let secondaryContact: PortalSecondaryContact | null = null
    if (evidence.email !== null && evidence.email.trim() !== '') {
      const secondary = await exactContact({
        channel: 'email', raw: evidence.email, proofs: evidence.proofs, required: false,
      })
      if (!secondary) return null
      secondaryContact = {
        channel: 'email',
        maskedDestination: secondary.maskedDestination,
        verified: secondary.verified,
      }
    }
    return {
      tenantSlug: evidence.tenantSlug,
      tenantName: evidence.tenantName,
      customerName: evidence.customerName,
      verifiedContact: { channel: 'sms', maskedDestination: primary.maskedDestination },
      secondaryContact,
      contactChangeActions: [
        'change_phone',
        ...(secondaryContact ? ['change_email' as const] : []),
      ],
    }
  }
  if (evidence.email === null || evidence.email.trim() === '') return null
  const primary = await exactContact({
    channel: 'email', raw: evidence.email, proofs: evidence.proofs, required: true,
  })
  if (!primary) return null
  return {
    tenantSlug: evidence.tenantSlug,
    tenantName: evidence.tenantName,
    customerName: evidence.customerName,
    verifiedContact: { channel: 'email', maskedDestination: primary.maskedDestination },
    secondaryContact: null,
    contactChangeActions: ['add_phone', 'change_email'],
  }
}

export type PortalContactChangeEvidenceResult =
  | {
      outcome: 'ok'
      sessionPublicId: string
      secretDigest: string
      tenantName: string
      channel: BookingVerificationChannel
      destination: string
      contactDigest: string
      maskedDestination: string
      actions: PortalContactChangeAction[]
    }
  | { outcome: 'expired' }
  | { outcome: 'unavailable' }

export async function getPortalContactChangeEvidence(): Promise<PortalContactChangeEvidenceResult> {
  const session = await access()
  if (session === 'expired') return { outcome: 'expired' }
  if (session === 'unavailable') return { outcome: 'unavailable' }
  try {
    const { data, error } = await session.client.rpc('customer_portal_profile_snapshot', {
      p_session_public_id: session.sessionPublicId,
      p_secret_digest: session.secretDigest,
    })
    if (error || !Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
      return { outcome: 'unavailable' }
    }
    const row = data[0]
    if (row.outcome === 'expired') return { outcome: 'expired' }
    if (row.outcome !== 'ok') return { outcome: 'unavailable' }
    const evidence = parseProfileEvidence(row.profile)
    if (!evidence) return { outcome: 'unavailable' }
    const phonePresent = evidence.phone !== null && evidence.phone.trim() !== ''
    const channel: BookingVerificationChannel = phonePresent ? 'sms' : 'email'
    const raw = channel === 'sms' ? evidence.phone : evidence.email
    if (!raw) return { outcome: 'unavailable' }
    const normalized = normalizeBookingContact(channel, raw)
    if (!normalized) return { outcome: 'unavailable' }
    const exact = await exactContact({ channel, raw, proofs: evidence.proofs, required: true })
    if (!exact?.verified) return { outcome: 'unavailable' }
    const secondaryEmail = channel === 'sms' && evidence.email !== null && evidence.email.trim() !== ''
    return {
      outcome: 'ok',
      sessionPublicId: session.sessionPublicId,
      secretDigest: session.secretDigest,
      tenantName: evidence.tenantName,
      channel,
      destination: normalized,
      contactDigest: await bookingContactDigest(channel, normalized),
      maskedDestination: exact.maskedDestination,
      actions: channel === 'sms'
        ? ['change_phone', ...(secondaryEmail ? ['change_email' as const] : [])]
        : ['add_phone', 'change_email'],
    }
  } catch {
    return { outcome: 'unavailable' }
  }
}

async function access(): Promise<{
  sessionPublicId: string
  secretDigest: string
  client: ProfileRpcClient
} | 'expired' | 'unavailable'> {
  try {
    const store = await cookies()
    const credential = parsePortalSessionCookie(store.get(PORTAL_SESSION_COOKIE)?.value)
    if (!credential) return 'expired'
    const client = createServiceClient() as ProfileRpcClient | null
    if (!client) return 'unavailable'
    return {
      sessionPublicId: credential.sessionPublicId,
      secretDigest: await portalSessionDigest(credential.secret),
      client,
    }
  } catch {
    return 'unavailable'
  }
}

export function normalizePortalCustomerName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  let normalized: string
  try {
    normalized = value.normalize('NFC').trim()
  } catch {
    return null
  }
  const length = [...normalized].length
  if (
    length < 2 ||
    length > 120 ||
    containsUnicode17Forbidden(normalized)
  ) return null
  return normalized
}

export async function getPortalProfileSnapshot(): Promise<PortalProfileSnapshotResult> {
  const session = await access()
  if (session === 'expired') return { outcome: 'expired', recoveryTenantSlug: null }
  if (session === 'unavailable') return { outcome: 'unavailable' }
  try {
    const { data, error } = await session.client.rpc('customer_portal_profile_snapshot', {
      p_session_public_id: session.sessionPublicId,
      p_secret_digest: session.secretDigest,
    })
    if (error || !Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) {
      return { outcome: 'unavailable' }
    }
    const row = data[0]
    if (row.outcome === 'expired' && row.profile === null) {
      const slug = row.recovery_tenant_slug
      if (slug !== null && (typeof slug !== 'string' || !TENANT_SLUG_PATTERN.test(slug))) {
        return { outcome: 'unavailable' }
      }
      return { outcome: 'expired', recoveryTenantSlug: slug }
    }
    if (row.outcome !== 'ok') return { outcome: 'unavailable' }
    const evidence = parseProfileEvidence(row.profile)
    if (!evidence) return { outcome: 'unavailable' }
    const profile = await projectEvidence(evidence)
    return profile ? { outcome: 'ok', profile } : { outcome: 'unavailable' }
  } catch {
    return { outcome: 'unavailable' }
  }
}

export async function updatePortalCustomerName(value: unknown): Promise<PortalNameUpdateResult> {
  const name = normalizePortalCustomerName(value)
  if (!name) return { outcome: 'invalid' }
  const session = await access()
  if (session === 'expired') return { outcome: 'expired' }
  if (session === 'unavailable') return { outcome: 'unavailable' }
  try {
    const { data, error } = await session.client.rpc('customer_portal_update_name', {
      p_session_public_id: session.sessionPublicId,
      p_secret_digest: session.secretDigest,
      p_display_name: name,
    })
    if (error) return { outcome: 'unavailable' }
    if (data === 'ok') return { outcome: 'success', name }
    if (data === 'invalid') return { outcome: 'invalid' }
    if (data === 'expired') return { outcome: 'expired' }
    return { outcome: 'unavailable' }
  } catch {
    return { outcome: 'unavailable' }
  }
}
