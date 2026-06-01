# Corevo Booking — Design System (källa för ALLA FAS 1-agenter)

**Status:** FAS 0.4 leverans. Detta är den enda designsanningen. Varje modulagent
(A–G) bygger mot tokens + komponentmönster här. Avvik inte; om något saknas →
lägg till här först, bygg sen.

Extraherat **live** från Corevo-POS:t (read-only, oförändrat):
`corevo.se` (marknad) + `admin.corevo.se` (dashboard/login) — båda kör **exakt samma**
token-system (shadcn-stil, HSL-tripplar + hex-speglar). `freshcut.se` ej nåbar
(ogiltigt cert) → storefront-referens tas via Corevo-familjen tills den är uppe.

---

## 1. Designspråk (Corevo-familjen)

Lugnt, premium, naturnära. **Skogsgrön + guld på krämvit.** Eleganta serif-rubriker
(Playfair) mot ren sans-brödtext (Inter). Mjuka skogston-skuggor, rundade hörn,
**guld-pill-CTA:er**. Dashboards bär en **mörk skogsgrön sidebar** med guldaccent.
Bokningsappen ska kännas som en familjemedlem till POS:t — inte en främling.

Princip: **brödtext = Inter, rubrik = Playfair, primär = skogsgrön, accent/CTA = guld.**

---

## 2. Färger

HSL = det POS:t definierar (kanon). Hex = spegel för verktyg som vill ha hex.

### Kärnmärke (Corevo-identitet — back-office använder dessa fast)
| Token | HSL | Hex | Roll |
|---|---|---|---|
| `--forest` (primär) | `152 35% 22%` | `#1F4636` | Primärgrön, rubrik-på-ljus, ring |
| `--forest-deep` | `152 40% 14%` | `#163127` | Mörkare grön, hover/djup |
| `--forest-soft` | `150 25% 40%` | `#4A8170` | Dämpad grön, sekundär text |
| `--gold` (accent) | `38 70% 55%` | `#F5A623` | CTA-fyllning, accent, fokus-glow |
| `--gold-deep` | `43 60% 52%` | `#D4AF37` | Guld hover/kant |
| `--gold-muted` | `38 40% 85%` | `#EBD9B8` | Guld-tonad yta |
| `--ink` (fg) | `150 30% 7%` | `#0E1411` | Starkaste text |
| `--cream` | `40 33% 97%` | `#F4F1EA` | Märkeskräm |
| `--paper` (bg) | `40 30% 99%` | `#FEFCF7` | Kort/yta-vit |

### Semantiska (shadcn-mappning, från POS:t)
| Token | HSL | Hex |
|---|---|---|
| `--background` | `40 33% 97%` | `#FAF8F4` |
| `--foreground` | `150 30% 12%` | `#15281F` |
| `--card` / `--popover` | `40 30% 99%` | `#FEFDFB` |
| `--primary` | `152 35% 22%` | `#1F4636` |
| `--primary-foreground` | `40 33% 97%` | `#F4F1EA` |
| `--secondary` | `145 15% 90%` | `#DEE8E3` |
| `--muted` | `140 12% 93%` | `#E9EEEB` |
| `--muted-foreground` | `150 10% 45%` | `#677E73` |
| `--accent` | `38 70% 55%` | `#F5A623` |
| `--accent-foreground` | `150 30% 12%` | `#15281F` |
| `--border` / `--input` | `140 15% 88%` | `#DCE5DF` |
| `--ring` | `152 35% 22%` | `#1F4636` |
| `--destructive` | `0 65% 50%` | `#D62F2F` |
| `--success` | `145 50% 42%` | `#36A165` |
| `--warning` | `38 80% 55%` | `#ECA62A` |
| `--info` | `205 60% 50%` | `#338CCC` |

### Dashboard-sidebar (mörk skogschrome — platform/admin/personal-nav)
| Token | HSL | Hex |
|---|---|---|
| `--sidebar-background` | `152 35% 16%` | `#1A3429` |
| `--sidebar-foreground` | `40 20% 88%` | `#E6E1D6` |
| `--sidebar-primary` (accent) | `38 70% 55%` | `#F5A623` |
| `--sidebar-accent` | `152 30% 22%` | `#274A3A` |
| `--sidebar-border` | `152 25% 24%` | `#2E4D3F` |

---

## 3. Typografi
- **Display/rubriker:** `"Playfair Display", Georgia, serif` — vikt **700**, tight
  tracking (h1 `-0.02em`). POS-skala: h1 60px, h2 38px, h3 21px.
- **Brödtext/UI:** `"Inter", system-ui, -apple-system, sans-serif`.
- UI-alternativ (finns i POS): `"DM Sans"`, `"Manrope"`; kiosk: `"Plus Jakarta Sans"`.
- Fonter laddas via `next/font` (Playfair Display + Inter). Lägg i `app/layout.tsx`.

**Typskala (behåll appens befintliga `clamp()`):**
| Roll | Storlek |
|---|---|
| Hero h1 | `clamp(2.5rem, 6vw, 4rem)` / 700 / Playfair |
| Sektion h1 | `clamp(2rem, 4vw, 2.6rem)` / 800 |
| h2 | `1.7rem` / 700 |
| h3 | `1.1rem` / 700 |
| Brödtext | `1rem` / 1.6 line-height |
| Liten/meta | `0.85rem`, opacity 0.6–0.7 |

> Rubriker = Playfair. UI-etiketter, knappar, tabeller, formulär = Inter.

---

## 4. Radie, skuggor, rörelse (kanon från POS)
**Radie:** bas `--radius: .625rem` (10px). Skala: sm `.375rem`, md `.5rem`,
lg `.625rem`, xl `.75rem`, 2xl `.9rem`, **pill `9999px`** (primär-CTA är pill).

**Skuggor (skogston):**
```
--shadow-soft: 0 2px 15px -3px hsl(150 20% 20% / .08), 0 4px 6px -4px hsl(150 20% 20% / .05);
--shadow-card: 0 4px 24px -6px hsl(150 20% 20% / .1);
--shadow-lg:   0 12px 32px -8px hsl(150 20% 20% / .18);
--shadow-gold: 0 4px 20px -4px hsl(38 70% 55% / .25);
--glow-gold:   0 0 30px -5px hsl(38 70% 55% / .4), 0 0 60px -10px hsl(38 70% 55% / .15);
```

**Rörelse:**
```
--ease-out:    cubic-bezier(.16, 1, .3, 1);
--ease-spring: cubic-bezier(.34, 1.56, .64, 1);
--dur-fast: .15s;  --dur-base: .2s;  --dur-slow: .3s;
```
Mikrointeraktioner: hover lyft/opacity, fokus = guld-ring, vald = guldfyllning.

**Spacing (4px-bas):** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56 / 72 px.
Appens befintliga rytm (`1rem`, `1.25rem`, `1.5rem`, `2.5rem`, `3.5rem`) ligger inom.

---

## 5. ⚠️ Tema-kontraktet (BRYT INTE)
Appen är white-label. Tenants överrider sin look i **runtime** via
`tenant_settings.branding` (jsonb) → `injectTenantTokens()` (`packages/ui/tokens.ts`),
som sätter CSS-variabler på layout-wrappern. **Komponenter refererar BARA variabler,
hårdkoda aldrig färg/font.** Tre nivåer (ADR 01 §3):
1. **config** — logga/färg/font via branding-jsonb (`--color-primary/-bg/-fg`, `--font-body`).
2. **layout-variant** — nav/hero-variant A/B (`components/brand/variants.ts`).
3. **scoped CSS** — `[data-tenant]`-scopad custom CSS (`.hero`, `.service-card` är krokar).

Två scope:
- **Corevo produkt-chrome** (`booking.corevo.se`: platform/admin/personal/auth):
  **fast Corevo-identitet** — forest/guld/kräm, Playfair-rubriker, mörk skogs-sidebar,
  guld-pill-CTA. INTE tenant-överridbar. Default-tokens = Corevo.
- **Tenant-storefront** (`demo.corevo.se` etc., `(public)`-rutter): tenant-branding
  överrider `--color-primary/-bg/-fg/-font-body`. Obrandad default = smakfull
  Corevo-neutral. 3 temamallar (nivå 2) ska se OLIKA ut (krav: bevisa 2 tenants skiljer sig).

> Befintliga `injectTenantTokens` sätter `--color-primary/-bg/-fg/-font-body`. Behåll
> dessa namn. Nya **produkt-tokens** (`--color-accent`/guld, `--font-display`/Playfair,
> `--radius`, skuggor, state-färger, sidebar) är INTE tenant-överridbara — de bär
> Corevo-familjekänslan genom alla teman.

---

## 6. Komponentmönster (återbruk — bygg INTE nytt)
Allt nedan finns redan i `apps/web/app/globals.css`. FAS 1 = **utöka dessa mot
tokens**, inte ersätta. Klassnamn är kontrakt; matcha dem.

| Mönster | Klass(er) | Regel |
|---|---|---|
| Primär-CTA | `.btn-primary` | Guldfyllning, ink-text, **pill**, `--shadow-gold`, hover lyft |
| Sekundär-knapp | (ny) `.btn-secondary` | Outline forest, transparent fyllning |
| Storefront-nav | `.nav`, `.nav-a*`, `.nav-b*` | Variant A (centrerad) / B (split, versal-länkar, accentlinje) |
| Hero | `.hero`, `.hero-1/-2`, `.hero-eyebrow` | h1 Playfair; eyebrow versal guld |
| Tjänstekort | `.service-card`, `.service-*` | Kant via `--border`, pris i guld/primär |
| Sektion | `.section`, `.section-muted/-cta` | `--shadow-card` på upphöjda block |
| Portal-chrome | `.portal-*` | Dashboard: överväg mörk skogs-sidebar (sidebar-tokens) |
| Auth-kort | `.auth-*` | Centrerat kort, guld fokus-ring, ink-fel `#b00020` |
| Boknings-wizard | `.wizard-*` | Steg-pricken aktiv = guld; vald tid/dag = guldfyllning |
| Bekräftelse | `.booking-confirm`, `.confirm-*` | Guld badge, kvitto-summary, betald = success-grön |
| Tabell | `.portal-table` | Versal dämpade rubriker, tunna rader |

**States (varje vy MÅSTE ha alla):** laddar (skeleton/spinner) · tom (vänlig tomtext +
nästa steg) · fel (ink-röd ruta, retry) · lyckat. Inga döda knappar; varje klick gör något.

---

## 7. Integration (FAS 1 steg 0 — SOLO, innan modulagenter)
1. Importera `@corevo/ui/tokens.css` (denna leverans, se `packages/ui/tokens.css`)
   överst i `globals.css` (efter `@import 'tailwindcss'`). Den definierar `:root`
   produkt-defaults = Corevo + scopen ovan.
2. Lägg Playfair Display + Inter via `next/font` i `app/layout.tsx`; sätt
   `--font-display` + `--font-body`.
3. Uppdatera `globals.css` `:root` att referera de nya tokens (ersätt den lösa
   `--color-primary: #b5651d`-defaulten med Corevo forest/kräm/ink).
4. Bekräfta tenant-override fortfarande vinner på storefront (demo behåller sin brand).
5. Bygg från ASCII-väg (`ö`-buggen) vid deploy. Verifiera live före FAS 1-grönt.

> Tills steg 1–3 körs ändras INTE live-utseendet (tokens.css är inert tills importerad).
> Det är avsiktligt: Nörden granskar designsystemet före look-skiftet.

---

## 8. Referenslänkar (live, read-only)
- `corevo.se` — marknadssajt, full tokenuppsättning (sektion 2–4 extraherad härifrån).
- `admin.corevo.se` — dashboard/login, samma tokens + sidebar-chrome.
- `freshcut.se` — flaggskepp-tenant (cert nere; lägg till storefront-noter när uppe).
- POS = **rör aldrig**. Endast browsing tillåten.
