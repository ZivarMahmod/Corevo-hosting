# Kunder v2 — byggplan (master–detalj)

Design: `4-Dokument-Underlag/01-acceptans/Dagens genomgångar/Kundadmin Kunder v2.dc.html` + `KUNDER-V2-NOTES.md`.
Samma metod som Översikt v2 / Kalender v2: **design = LAG för LOOKS**, funktioner som finns/är fastställda idag dödas ALDRIG bara för att mockupen utelämnar dem (NOTES rad 6). Mörkt admin-tema mappar redan `--c-*` 1:1 mot designens hex.

## Nuläge → mål
- **Nu:** `/admin/kunder` = tabell-lista (server, `listCustomers`) + separat `/admin/kunder/[id]` = staplade kort (detalj).
- **Mål:** master–detalj — 400px lista vänster (sök + filterchips), kundkort höger, klick byter kund. Registret + kundkortets funktioner (goal-67: `hidden_at`/dölj, `self_book`, sök, klientkort, favoriter, historik, GDPR-export, kontakt-PII) BEHÅLLS, får bara ny stil.

## Arkitektur (Next-native, ingen förladdning)
Master–detalj = **delad `layout.tsx`** under `kunder/`:
- `kunder/layout.tsx` (server): hämtar lätt-listan EN gång (`listCustomers`, ingen PII), grid `400px | 1fr`. Vänster = `<CustomerWorkbenchList rows>` (klient: sök+chips+highlight via `usePathname`). Höger = `{children}`.
- `kunder/page.tsx`: tomt läge ("Välj en kund").
- `kunder/[id]/page.tsx`: kundkortet v2 (omstil av nuv. detalj, per-kund server-fetch = färsk tidsbunden PII).
- Rad = `<Link href="/admin/kunder/[id]">` → mjuk nav, layouten (listan) förblir monterad → listan byts aldrig om, bara kortet. Respekterar PII-staketet (kortets kontakt hämtas per [id], aldrig hela listans telefoner).
- Responsivt: CSS-grid → 1 kolumn på mobil; klienten visar lista ELLER kort utifrån om en kund är vald (pathname), `←`-tillbaka på kortet.

## Riktig data ↔ tomt läge (ärlighet, DoD-anda)
| Designdel | Källa idag | Beslut |
|---|---|---|
| Lista: initial, namn, tagg, senaste, konto-prick, besök | `listCustomers` | Riktigt. Tagg: NY=first_seen denna månad · STAM=`isReturning` (≥5) · DOLD=`hidden`. |
| Lista: **tel (mono)** | — (telefon = tidsbunden PII, EJ i lätt-listan) | **Utelämnas** ur listan. Rå telefon för ALLA kunder bryter PII-staketet. Kortet visar tel via tidsbunden RPC. |
| Sök "namn eller nummer" | namn (klient, maskerat namn) | **Namn-sök** (nummer kräver telefon i raden = PII). Ärlig placeholder. |
| Nyckeltal (besök/totalt/avbok/poäng) | detalj + loyalty + historik | Riktigt (härlett ur historik + ledger). |
| NÄSTA bokning | bokningar start_ts ≥ nu | Riktigt (härlett), annars tomt läge + Boka in. |
| KLIENTKORT (note) | `customer_notes` (staff-RLS) | Riktigt, autospar (admin action). |
| FAVORITER (frisör + tjänst) | `customer_favorites` | Frisör riktigt (`getCustomerStaffFavorite`). Tjänst: läs om admin-läsbart, annars utelämna. |
| KONTO: gäst/inbjuden/aktiv | `auth_user_id` (gäst/aktiv) | 2 sanna lägen (gäst/aktiv). "Inbjuden" finns EJ i DB → fejkas ej. |
| Kan boka själv (toggle) | `self_book` | Riktigt (befintlig `CustomerFlags`-action). |
| Påminnelser: kanalstatus | e-post finns? (kontakt) | E-POST ✓ om e-post finns. PUSH/SMS = goal-68, visas ej förrän bevisbart. |
| Marknadsföring: samtycke | — | goal-68, tomt/ärligt tills consent-fält finns. |
| SENASTE UTSKICK | `communication_events` (goal-68, EJ byggt) | Tomt läge: "Inga utskick — kunden nås manuellt." |
| ⋯-meny (Dölj/Exportera/GDPR) | befintligt | Behålls (dölj=CustomerFlags, export=CustomerExport, GDPR=GdprControls-väg). |

## Steg
1. `layout.tsx` + tomt `page.tsx` + `CustomerWorkbenchList` (klient) + `kunder-v2.module.css`.
2. `[id]/page.tsx` omstil → v2-kort (header/nyckeltal/NÄSTA/klientkort/favoriter/konto/historik/utskick). Behåll alla actions.
3. Note-autospar-action om saknas; nästa-bokning-härledning; kanal-härledning.
4. Verify: tsc/eslint/vitest, rutter kompilerar, PII-staket intakt, dölj/self_book/export/GDPR orörda. Codex-granska diff.
5. Commit → push → deploy (v-tagg), prod-rök.

## Status (bygget)
KLART lokalt (tsc/eslint rena, 1115 tester gröna, rutter kompilerar 307): `layout.tsx` (master–detalj-skal, listan hämtas en gång) · `KunderBoard.tsx` (mobil-panelval via pathname) · `CustomerWorkbenchList.tsx` (sök+chips+highlight) · `page.tsx` (tomt läge = överblick+export) · `[id]/page.tsx` (v2-kort) · `CustomerNoteEditor.tsx` (autospar) · `saveCustomerNote` (admin-action) · `relativeVisitSv`/`isInactiveSince` (+test). LIVE tag v1.34.0 (deployad 2026-07-15, prod-rök grön). Codex-fynd (export-dolda) fixat.

## Beslut att yta till Zivar
- Telefon utelämnas ur listan + sök = namn (PII-staket). Kortet visar tel i driftfönstret som förr.
- "Inbjuden"-konto, PUSH/SMS-kanaler, marknadssamtycke, SENASTE UTSKICK = goal-68 → ärliga tomma lägen, inget fejkat.
