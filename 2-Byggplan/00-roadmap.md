# Corevo Booking Platform — Byggplan / Roadmap

Multi-tenant white-label boknings-SaaS för salonger. Ingångspunkt för bygget.
**Stack:** Next.js (App Router) + Supabase (Postgres + Auth) + Cloudflare (hosting via OpenNext/Workers + R2) + Stripe Connect.
**Kod bor i:** `5-Kod/` (egen git, tom nu).
**Status idag:** 2026-05-31. Planering klar, bygge ej startat.

> Varje goal-brief ligger i `goals/`. Code kör en goal i taget — eller flera parallella spår samtidigt när beroenden tillåter.

---

## 1. Översikt — parallella spår

Bygget delas i **spår** som kan köras samtidigt av separata Code-sessioner. Ett spår får bara starta när dess beroenden är klara (DoD uppfylld).

| Spår | Innehåll | Kan starta när |
|------|----------|----------------|
| **Fundament** | G01 scaffold, G02 DB/RLS | direkt (G01), sedan G02 |
| **Spår A** | M2 Publik webbplats (G03) | G02 klar |
| **Spår B** | M3 Bokningsmotor (G04) | G02 klar |
| **Spår C** | M4 Kundportal (G05) + M5 Personalportal (G06) | G04 klar |
| **Spår D** | M6 Salon Admin (G07) | G04 klar |
| **Spår E** | M7 Platform Admin (G08) | G02 klar (egen tenant-data) |
| **Spår F** | M8 Betalningar/Stripe (G09) | G04 klar (kopplar på M3) |
| **Härdning** | G10 Säkerhet/compliance/ops, G11 E2E + deploy-pipeline | kärnan byggd |

**Parallellitet i praktiken:**
- **Fas 1 (ensam):** G01 → G02.
- **Fas 2 (parallellt):** Spår A (G03) + Spår B (G04) + Spår E (G08) samtidigt.
- **Fas 3 (parallellt):** Spår C (G05, G06) + Spår D (G07) + Spår F (G09) samtidigt.
- **Fas 4 (härdning):** G10 + G11.

---

## 2. Beroendediagram (ASCII)

```
                        ┌─────────────┐
                        │ G01 Scaffold│  (Fundament)
                        │ Next+Supa+CF│
                        └──────┬──────┘
                               │
                        ┌──────▼──────┐
                        │ G02 DB/RLS  │  (Fundament, M9)
                        │ migrations  │
                        └──┬───┬───┬──┘
              ┌────────────┘   │   └─────────────┐
              │                │                 │
        ┌─────▼─────┐   ┌──────▼──────┐   ┌──────▼──────┐
        │ G03 M2    │   │ G04 M3      │   │ G08 M7      │
        │ Publik web│   │ Bokmotor    │   │ Platform Adm│
        │ (Spår A)  │   │ (Spår B)    │   │ (Spår E)    │
        └───────────┘   └──┬───┬───┬──┘   └─────────────┘
                           │   │   │
              ┌────────────┘   │   └──────────────┐
              │                │                  │
        ┌─────▼─────┐   ┌──────▼──────┐    ┌──────▼──────┐
        │ G05 M4    │   │ G07 M6      │    │ G09 M8      │
        │ Kundportal│   │ Salon Admin │    │ Stripe/Bet. │
        │ (Spår C)  │   │ (Spår D)    │    │ (Spår F)    │
        ├───────────┤   └─────────────┘    └─────────────┘
        │ G06 M5    │
        │ Personalp.│
        │ (Spår C)  │
        └─────┬─────┘
              │
       ┌──────▼───────┐
       │ G10 Säkerhet │  (Härdning)
       │ G11 E2E+CI/CD│
       └──────────────┘
```

---

## 3. Goal-tabell

| Goal# | Modul | Spår | Beror på | Status |
|-------|-------|------|----------|--------|
| G01 | — (infra) | Fundament | — | Att göra |
| G02 | M9 DB/Arkitektur | Fundament | G01 | Att göra |
| G03 | M2 Publik webbplats | A | G02 | Att göra |
| G04 | M3 Bokningsmotor | B | G02 | Att göra |
| G05 | M4 Kundportal | C | G04 | Att göra |
| G06 | M5 Personalportal | C | G04 | Att göra |
| G07 | M6 Salon Admin | D | G04 | Att göra |
| G08 | M7 Platform Admin | E | G02 | Att göra |
| G09 | M8 Betalningar/Stripe | F | G04 | Att göra |
| G10 | Säkerhet/Compliance/Ops | Härdning | G05,G06,G07,G09 | Att göra |
| G11 | E2E-test + deploy-pipeline | Härdning | G10 | Att göra |

---

## 4. Tvärgående regler (gäller ALLA goals)

- **Multi-tenant:** varje tenant-tabell har `tenant_id uuid not null`. RLS PÅ överallt. Ingen query utan tenant-scope.
- **White-label:** inga hårdkodade varumärken på tenant-sidor. Tema/logo/färg per tenant från DB.
- **Auth:** Supabase Auth (App Router, `@supabase/ssr`). Server Components läser session via cookies. RLS är sista försvarslinjen — lita aldrig bara på app-lager.
- **Env:** alla hemligheter i `.env.local` (dev) + Cloudflare secrets (prod). Aldrig i git. `.env.example` committas.
- **Deploy:** Cloudflare via OpenNext (`@opennextjs/cloudflare`) → Workers. R2 för fil-/bilduppladdning.
- **Språk i UI:** svenska som default, i18n-redo.
- **Definition of Done per goal:** `pnpm build` grön, lint grön, beskrivna DoD-kriterier verifierade.

---

## 5. Körordning för Code (kort)

1. Kör **G01**, verifiera DoD.
2. Kör **G02**, verifiera DoD (RLS-test obligatoriskt).
3. Starta **G03 + G04 + G08** parallellt (separata sessioner/brancher).
4. När G04 klar: starta **G05 + G06 + G07 + G09** parallellt.
5. Avsluta med **G10** sedan **G11**.

---

## 6. Beslutslogg

| Datum | Beslut | Varför |
|---|---|---|
| 2026-05-31 | OpenNext (`@opennextjs/cloudflare`) på Workers, ej Pages | 2026-rekommendation för Next App Router på Cloudflare |
| 2026-05-31 | `@supabase/ssr` cookie-baserad auth i App Router | Kanoniskt Supabase + Next App Router-mönster |
| 2026-05-31 | Dubbelbokningsskydd via Postgres exclusion constraint (`btree_gist`) | DB-nivå garanti, inte bara app-logik |
