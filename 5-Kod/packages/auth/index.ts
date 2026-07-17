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
// HISTORISK kommentar sade "shared across *.corevo.se" — sedan goal-27 är cookien
// HOST-LOCKED per dörr (superbooking/booking/minbooking) och AUTH_COOKIE_DOMAIN är
// TOM i prod. Sätt den ALDRIG till `.corevo.se`: det skulle skicka super-admin-
// sessionen till varenda tenant-storefront. Data isolation via RLS (ADR 01 §2).
const AUTH_COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN || undefined
// Session lifetime is NOT controllable here. @supabase/ssr (0.10.3) hardcodes the
// auth-cookie max-age to its own DEFAULT_COOKIE_OPTIONS.maxAge (400 days, Chrome's
// cap) for every write — see ssr/dist/main/cookies.js: the set path spreads our
// `cookieOptions` and THEN overwrites `maxAge: DEFAULT_COOKIE_OPTIONS.maxAge`.
// So any maxAge we pass is silently ignored (an earlier FAS 2.1 attempt to scope a
// 30-day "iPad" window did nothing and was removed). Only `domain` etc. survive.
//
// Consequence: "log in once on the iPad and stay logged in" is the OUT-OF-THE-BOX
// behavior (400-day cookie + autoRefreshToken). The REAL session-lifetime lever —
// the one that ends a session on a lost/shared device — is the Supabase project's
// refresh-token policy (JWT expiry + rotation/reuse), set in the Dashboard, not in
// code. 2FA is the planned step-up auth (see HANDOFF).
function cookieOptions() {
  return {
    // Plan 002: explicita flaggor i stället för biblioteks-defaults. `secure` bara
    // i produktion — localhost-dev kör http och en secure-cookie sätts aldrig där.
    // `sameSite: 'lax'` = CSRF-grundskydd som ändå överlever normala navigeringar.
    // (maxAge styrs INTE här — se kommentaren ovan; ssr skriver över den.)
    ...(process.env.NODE_ENV === 'production' ? { secure: true } : {}),
    sameSite: 'lax' as const,
    ...(AUTH_COOKIE_DOMAIN ? { domain: AUTH_COOKIE_DOMAIN } : {}),
  }
}

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
    cookieOptions: cookieOptions(),
  })
}

/** Browser client (Client Components). */
export function createBrowserSupabase() {
  return ssrCreateBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookieOptions: cookieOptions(),
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
