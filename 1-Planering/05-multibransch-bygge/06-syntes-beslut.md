# Syntes + beslut — planeringsflottan (2026-06-15)

> Flottan körde spår 01–05. Detta = syntes, konfliktlösning, beslut. Ingång: `00-plan-index.md`.

## Flott-status
- **Spår 02 mall/skin** (innehåll fångat): 6-stegs konverterings/kategoriserings-pipeline; ~64 mallar `kräver-kredit` (htmlcodex footer-länk), ~6 MIT admin-mallar fria; sektion↔modul via `module_hint`; tokens → CSS-variabler. Behöver nytt fält `modules.default_section_position`.
- **Spår 03 asset** → `03-innehall-asset.md` ✓. `template_slots` (mall) + `content_slots` (tenant, RLS); R2 content-addressed nycklar (swap = ny URL = auto cache-bust); billing mäter lagrad GB i `tenant_modules.config`.
- **Spår 04 super-admin-hub** (innehåll fångat): `TenantPreviewFrame` (iframe + signed preview-token), `SlotOverlayController` (postMessage), `SlotEditDrawer`, `ModuleTogglePanel`; v1 slot-edit → v2 sektioner → v3 full sidbyggare.
- **Spår 05 onboarding/storefront** (innehåll fångat): wizard steg 0 "välj bransch" + steg "Moduler"; storefront gatear på modul-state; bakåtkompatibel default `booking:live` (FreshCut bryts ej).
- **Spår 01 DB-grund**: FAILADE (worktree-quirk) → byggs om som builder nu.

## Konflikter — lösta
1. **jsonb-genväg vs riktiga tabeller:** Spår 05 ville lagra vertical+modules i `tenant_settings.settings` jsonb för att slippa migration. **ÖVERKÖRT** — vi bygger de RIKTIGA tabellerna (`verticals`, `modules`, `tenant_modules`); det är hela poängen. App-koden läser från tabellerna.
2. **RLS-helper:** skisser med `auth.tenant_id()` → **LÅST `private.tenant_id()`** (HANDOFF/CLAUDE).
3. **`modules.default_section_position`:** nytt fält spår 02/04 behöver (injicera moduls fallback-komponent) → in i `modules`.
4. **content_slots + template_slots:** två lager (mall-auto-detect + tenant-RLS), bygger på befintliga `media_assets`. Låst.

## Beslut jag tar (lågrisk, reversibelt) — flagga om du ogillar
- **Branscher vid launch:** frisör, barbershop, nagelstudio, restaurang + "generell". Utökas lätt.
- **Preview-isolering:** v1 same-origin via `superbooking.corevo.se/preview/<tenant>` (enklast postMessage).
- **Bild-kvot:** 25 bilder / 500 MB inkluderat, bildbibliotek-toggle däröver.
- **Allt byggs på SAFE Supabase-branch** (ej prod) tills du säger deploy.

## Kräver DITT beslut (pengar/juridik)
- **htmlcodex-krediterna (~64 mallar):** köpa bort footer-krediten per mall, behålla krediten, eller utesluta dem? Tills du sagt: **vi bygger på de FRIA (MIT) mallarna först**, kräver-kredit parkeras (inget stopp).
