// @corevo/auth — FROZEN contract (G02).
// Shared @supabase/ssr client factories + tenant-claim helper.
// Auth = Supabase Auth (ADR 01 §4). tenant_id is a JWT claim in app_metadata
// (server-set via Custom Access Token Hook), read by RLS via auth.tenant_id().
import {
  createServerClient as ssrCreateServerClient,
  createBrowserClient as ssrCreateBrowserClient,
} from '@supabase/ssr'
import type { Database } from '@corevo/db'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'anon-placeholder-key'
// Session shared across *.corevo.se subdomains (frisorN.corevo.se + booking.corevo.se).
// Empty in dev. Data isolation is via RLS + tenant_id, NEVER via cookie (ADR 01 §2).
const AUTH_COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN || undefined

export type CookieToSet = {
  name: string
  value: string
  options?: Record<string, unknown>
}

export type ServerCookieAdapter = {
  getAll: () => { name: string; value: string }[]
  setAll: (cookies: CookieToSet[]) => void
}

/** Cookie-based server client (Server Components, Route Handlers, Server Actions). */
export function createServerSupabase(cookies: ServerCookieAdapter) {
  return ssrCreateServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies,
    ...(AUTH_COOKIE_DOMAIN ? { cookieOptions: { domain: AUTH_COOKIE_DOMAIN } } : {}),
  })
}

/** Browser client (Client Components). */
export function createBrowserSupabase() {
  return ssrCreateBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    ...(AUTH_COOKIE_DOMAIN ? { cookieOptions: { domain: AUTH_COOKIE_DOMAIN } } : {}),
  })
}

/** JWT claim that carries the tenant (app_metadata, server-set — never user_metadata). */
export const TENANT_CLAIM = 'tenant_id' as const

export type JwtClaims = {
  app_metadata?: { tenant_id?: string | null; platform_admin?: boolean | null }
} | null

/** Reads the tenant_id claim. Mirrors the SQL helper auth.tenant_id(). */
export function getTenantId(claims: JwtClaims): string | null {
  return claims?.app_metadata?.tenant_id ?? null
}

/** True if the JWT carries the global platform_admin flag (cross-tenant access). */
export function isPlatformAdmin(claims: JwtClaims): boolean {
  return claims?.app_metadata?.platform_admin === true
}
