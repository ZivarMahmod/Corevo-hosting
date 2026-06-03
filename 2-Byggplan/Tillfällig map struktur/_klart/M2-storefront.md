# M2 — Storefront (målbild + gap)

**Datum:** 2026-06-02
**Status:** Spikad i planeringspass med Zivar.
**Ersätter:** den gamla `1-Planering/moduler/M2-publik-webbplats.md` (för-bygge-spec).
**Läs först:** `HANDOFF.md` + `CLAUDE.md`. Frozen: remote-image-config (plain `<img>`, aldrig `next/image`), `lib/tenant*.ts`.

> **Röd tråd:** M2 är **skyltfönstret**. Drar tema + branding + tjänster + (nu) copy **live** från M6/`tenant_settings` → ägarens ändringar slår igenom utan kod. Boka-CTA → M3. Djup anpassning → M7 (Zivars devtools).

---

## 0. Vad modulen ÄR

Salongens digitala skyltfönster — SEO-optimerad, snabb, proffsig webbnärvaro utan webbyrå. Det slutkunden ser när de googlar salongen.

---

## ⭐ Bärande princip (född här, gäller hela plattformen): TVÅ NIVÅER AV ANPASSNING

```
ÄGAREN = Level 1-leksakslåda            DJUP LOOK = kod i säker miljö
  • byt tema (settings.theme)             • "bygg om fronten" = KOD, inte UI
  • byt bilder (R2)                       • scoped overrides appliceras via kod
  • ändra egen hero/om-text               • PREMIUM — Zivar (+Code) tar betalt
  • lägg till / redigera tjänster         • M7-admin = operativ DATA, inte look
  → ytligt, säkert, kan inte förstöra
  → interaktivt, men ALDRIG "fattigt"
```

Ägaren får inte "devtools". Den känner ändå "jag fick en plattform, inte bara en hemsida" (bunden frihet, jfr M6 §3.6). **Att ändra hur storefront ser ut görs med kod i en säker miljö** (Zivar + Code) — aldrig no-code-UI, aldrig klick i admin. Det är det intäktsbärande premium-designarbetet. Zivars M7-admin är **operativ data-kontroll** ("Supabase med mitt UI", no-code), inte en design-UI.

---

## 1. Ytor — byggt / stale / saknas

| Yta | ✅ Byggt | ⚠️ Stale | ❌ Saknas |
|---|---|---|---|
| **Publika sidor** | `/` · `/tjanster` · `/om` · `/kontakt` | spec ville `/personal`,`/galleri`,`/tjanster/[slug]` — nu **sektioner** (rätt, se §2.1) | — |
| **Teman** | 5 layouter (Salvia/Leander/Linnea/Zigge/Edit) som `settings.theme` | — | — |
| **Komponenter** | Hero­Carousel, ServiceMenu, Gallery, UtilityBar, NavShell, BookingDrawer (M3), CookieConsent, Reveal/Parallax, FooterFull | — | — |
| **Content-resolve** | `resolveThemeContent` — ägar-media vinner, tema-default fyller; R2-upload | — | **copy ej redigerbar** (§2.3) |
| **Bokning på storefront** | Variant 3 (default) + 4 (snabbboka), mobil bottom-sheet | — | — |
| **SEO** | basal metadata i `(public)/layout` | — | **sitemap, schema.org, per-sida-metadata, robots** (§2.2) |

---

## 2. Spikade beslut (M2)

### 2.1 Sidstruktur — sektioner, inga nya rutter
Team + galleri + tjänstevisning bor som **sektioner** i de fyra sidorna. Inga standalone-rutter för salongen att pilla på — håll ägarens yta enkel (Level 1). Lås som byggt.

### 2.2 SEO-svit i v1 — JA
Skyltfönstrets hela poäng. Bygg:
- **Per-sida `generateMetadata`** (title/description/openGraph per tenant + sida)
- **Sitemap** per tenant (auto)
- **schema.org JSON-LD** — `LocalBusiness` (namn, adress, öppettider, plats)
- **robots.txt** korrekt per tenant
Allt drar tenant-data live (namn, plats, tjänster).

### 2.3 Ägaren redigerar copy — JA (i leksakslådan)
Datamodellen saknar copy-fält idag (bara generisk tema-text). Lägg **copy-fält** ägaren kan redigera: hero (eyebrow/title/lede), om-text, tagline, italic-fras.
- `resolveThemeContent` använder **ägarens copy när satt, tema-default annars** (samma mönster som redan finns för media).
- Redigeras i M6:s leksakslåda — egna ord, kan **inte bryta layouten** (fält, inte fri HTML/CSS).

### 2.4 Live-koppling M6 → M2 (bekräfta vid bygge)
Färg/font/logo/bilder/copy/tema läses som **runtime `tenant_settings`**, inte build-inlinat — annars funkar inte M6:s varumärke-live-preview (jfr M6 §3.6; HANDOFF flaggade `NEXT_PUBLIC`-inlining). Verifiera att ändring i M6 → syns på M2 utan deploy.

---

## 3. Röd tråd — kopplingar

| Koppling | Vad M2 gör | Var det andra bor |
|---|---|---|
| **M6 → M2** | renderar tema/branding/bilder/**copy**/tjänster live | M6 äger leksakslådan |
| **M2 → M3** | boka-CTA → BookingDrawer / `/boka` | M3 äger bokning |
| **M7 → M2** | Zivars djup-anpassning / "bygg om fronten" override:ar | **M7 äger devtools-lagret (premium)** |

---

## 4. Bygg-items (vad Code faktiskt gör i M2)

**Rör INTE** (byggt): de 5 layouterna, BookingDrawer, R2-media-resolve, CookieConsent. Bygg ovanpå, riv inte.

1. **SEO-svit (§2.2):** per-sida-metadata + sitemap + LocalBusiness JSON-LD + robots, allt tenant-drivet.
2. **Redigerbar copy (§2.3):** copy-fält i tenant-content-modellen; `resolveThemeContent` använder ägar-copy först; M6-redigerings-UI (i leksakslådan).
3. **Verifiera runtime-koppling (§2.4):** M6-ändring (färg/font/copy/bild) → syns live på M2 utan deploy.

---

## 5. Parkerat (planerat, byggs inte först)

- **Egen domän** (`egensalong.se`) — eget planeringsspår (HANDOFF: "custom-domäner"). Idag subdomän `salong.corevo.se`.
- **Zivars devtools-lager (M7)** — djup per-tenant-anpassning, premium. Detaljspecas i M7.
- Blogg, flerspråk (sv+en), A/B-test, egen CSS-editor för ägaren — senare/aldrig-för-ägaren (CSS = Zivars lager).

---

## 6. Öppet kvar

Inget blockerande. Exakt vilka copy-fält som är redigerbara per tema finputsas vid bygge (håll listan kort = leksakslåda).
