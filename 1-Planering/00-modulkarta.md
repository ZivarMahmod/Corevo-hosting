# 00 — Modulkarta (Corevo Booking Platform)

Kanonisk karta över hela plattformen. Allt annat refererar hit.

## Vad det är

Multi-tenant, white-label boknings- & kundhanteringsplattform för salonger. Freshcut = första tenant. Mål: ny salong ansluts utan ny kod (skapa tenant → koppla domän → fyll innehåll → lansera).

**Arbetsnamn:** corevoboking (byts senare).
**Stack:** Next.js · Supabase (Postgres + Auth) · Cloudflare (hosting + R2 storage) · Stripe Connect.

## Modulerna

| Modul | Namn | Roll | Beror på |
|---|---|---|---|
| **M9** | Databas & arkitektur | FUNDAMENT — multi-tenant, roller, RLS, auth, API-struktur, audit | — |
| **M2** | Publik webbplats | Salongens skyltfönster, SEO, CMS, login-ingång | M9 |
| **M3** | Bokningsmotor | Hjärtat: lediga tider, schema, dubbelbokningsskydd, om/avbokning | M9 |
| **M4** | Kundportal | Kundens sida: bokningar, historik, poäng, profil, meddelanden | M9, M3 |
| **M5** | Personalportal | Frisörens arbetsyta: dagens schema, kundkort, betalstatus | M9, M3 |
| **M6** | Salon Admin | Ägarens kontrollcenter: salonger, frisörer, priser, statistik | M9, M3 |
| **M7** | Platform Admin | Corevos interna: tenants, domäner, drift, avgifter | M9 |
| **M8** | Betalningar & Stripe | Stripe Connect, serviceavgift, webhooks, återbetalning | M9, M3 |

Tvärgående underlag (ej moduler): roadmap (PDF 10), affärsmodell (11), säkerhet/drift/GDPR (12).

## Beroendegraf (vad låser vad)

```
        M9  (fundament — byggs först, ensam)
         │
   ┌─────┼───────────────┬──────────┐
   ▼     ▼               ▼          ▼
   M2    M3 ───► M4      M7        (M2 kan byggas parallellt
         │       M5                 med M3 efter M9)
         │       M6
         ▼
         M8 (kopplar på M3 när bokning finns)
```

## Byggordning (kort)

1. **M9** ensam — inget annat kan byggas rätt innan fundamentet står.
2. Sedan **M2 + M3 parallellt** (olika team/spår, rör inte varandras kod).
3. **M4, M5, M6** ovanpå M3 — kan delas på flera spår.
4. **M7** parallellt hela tiden (rör mest egen tenant-data).
5. **M8** sist av kärnan (kopplar på färdig M3).

Detaljerad goal-sekvens med parallella spår: `2-Byggplan/`.

## Status

🟡 Planering pågår. DB tom. Ingen kod skriven. Underlag = 14 PDF:er i `Nörden/` (se `Nörden/00-FILKARTA.md`).
