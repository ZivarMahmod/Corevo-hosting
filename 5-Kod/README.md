# Corevo Booking Platform — `5-Kod`

Multi-tenant white-label booking SaaS. **One codebase, all tenants** (ADR 01 §1):
tenants differ only by **data + theme**, never code/branch. Built as a
pnpm + Turborepo monorepo with a single Next.js app.

Stack: Next.js 15 (App Router, TS) · Supabase (Postgres 17 + Auth) ·
Cloudflare Workers (OpenNext) + R2 · Stripe Connect (later).

## Layout

```
5-Kod/
├─ apps/web/                 # the one Next.js app (modules = route groups)
│  ├─ middleware.ts          # host → tenant + Supabase session   [FROZEN]
│  ├─ lib/tenant.ts          # host → slug resolution (pure)
│  ├─ lib/supabase/          # server/client/middleware SSR clients
│  └─ app/                   # routes
├─ packages/
│  ├─ db/                    # generated Supabase types + helpers  [FROZEN]
│  ├─ auth/                  # @supabase/ssr factories + tenant claim [FROZEN]
│  ├─ ui/                    # design tokens (CSS vars) + theming helpers
│  └─ config/                # shared ESLint preset                [FROZEN]
└─ supabase/
   ├─ migrations/            # 0001 schema · 0002 RLS · 0003 auth hook
   ├─ seed.sql               # demo tenant (frisor1)
   └─ tests/                 # rls_isolation · double_booking
```

## Commands

| Command        | What                                              |
| -------------- | ------------------------------------------------- |
| `pnpm dev`     | Next dev server (http://localhost:3000)           |
| `pnpm build`   | Turbo build (Next prod build)                     |
| `pnpm lint`    | ESLint across workspaces                          |
| `pnpm verify:tenant` | Tenant-resolution stub tests (node, no deps)|
| `pnpm preview` | OpenNext → Cloudflare local preview               |
| `pnpm deploy`  | OpenNext → Cloudflare deploy (DNS gated, see below)|

## Environment

Copy `.env.example` → `apps/web/.env.local`. The Supabase URL + anon key for the
linked cloud project are already filled in `apps/web/.env.local` (gitignored).
`SUPABASE_SERVICE_ROLE_KEY` is left blank — set it locally for admin/webhook code.

## Database

Runs on **Supabase Cloud** (no local Docker stack). Migrations live in
`supabase/migrations/` and are already applied to the linked project. With Docker
installed you can recreate locally via `supabase db reset` (applies migrations +
`seed.sql`).

- **RLS** on every tenant table via `private.tenant_id()` (reads the
  `app_metadata.tenant_id` JWT claim; helpers live in `private`, not `auth`,
  because Supabase Cloud denies `CREATE` in `auth`).
- **tenant_id in the JWT** is set by the `public.custom_access_token_hook`
  (migration `0003`). **You must enable it once** in Supabase Dashboard →
  Authentication → Hooks → *Customize Access Token (JWT) Claims*. Seed users also
  carry `app_metadata.tenant_id` directly, so RLS works without the toggle.
- **No double booking**: `EXCLUDE USING gist` on `bookings(staff_id, tstzrange)`.

## Domains (gated)

Tenants run on `*.corevo.se` subdomains (`frisor1.corevo.se`). `booking.corevo.se`
= platform. **No real customer domain, no CNAME, no Cloudflare custom hostname**
until approved. The wildcard route is prepared (commented) in
`apps/web/wrangler.jsonc`; DNS activation is deferred.

## Parallel work — FROZEN files

Do **not** edit these in a parallel worktree (see `2-Byggplan/01-parallell-exekvering.md`):
`packages/db`, `packages/auth`, `packages/config`, `apps/web/middleware.ts`,
root `package.json` / `pnpm-workspace.yaml` / `turbo.json` / `tsconfig.base.json`.
