# LOOK #1 — "EDGE" (frisör / barbershop) · källa + spec för native rebuild

> **Status:** SEED för **goal-52** (native rebuild, kit + config). **Referens — INTE import.**
> Zivars egen handbyggda sajt. Redan tokenad och ren → idealisk första native look.
> Källfiler i denna mapp: `index.html` · `css/style.css` · `js/main.js` · `assets/` (favicon + 5 SVG).

---

## Vad det är
En komplett barbershop-sajt Zivar byggt från grunden ("EDGE by Tofi"). Allt ligger redan i CSS-variabler (tokens) och rena sektioner → porten till native är mest mekanisk: lyft tokens, mappa sektioner, byt boka/tjänst mot Corevos moduler.

## Sektionskarta (hans sektion → Corevo)
| # | Hans sektion (`index.html`) | Blir i Corevo |
|---|---|---|
| 1 | `header.site-header` + `nav.primary-nav` + mobil-meny | **kit: nav** (content_slots: logo + länkar) |
| 2 | `section.hero` — slider, 3 bilder, "SKARPT KLIPPT. SKÖNT MOTTAGEN." | **kit: hero-slider** (content_slots: bilder, rubrik, CTA) |
| 3 | `#tjanster` "Hantverket, presenterat." | **booking-modulens tjänstelista** (live priser) — annars kit: services-grid |
| 4 | `#om-oss` "En barbershop med hantverk." | **kit: about** (content_slots: bild + text) |
| 5 | `#plats` "Hittar du hit?" | **kit: plats** (content_slots: adress / öppettider / karta) |
| 6 | `#boka` CTA "Redo för en ny stil?" | **booking-modulen** (live boka-flöde, ej statisk) |
| 7 | `footer.site-footer` | **kit: footer** (content_slots) |

## Tema-tokens (lyft EXAKT ur `css/style.css` — aldrig ögonmått)
**Palett:** `--paper #F4F1EA` · `--paper-2 #EEEADF` · `--ink #1A1714` · `--ink-soft #5A5247` · `--muted #6B645A` · **accent `--brass #A8772E`** · `--brass-ink #8A6520` · `--brass-line #C9A45E` · `--hair #DDD6C8` · `--on-brass #F8F4EC`
**Typsnitt:** display `"Tenor Sans" / Trajan, serif` · body `"Cormorant Garamond", serif`
**Layout:** `--wrap-max 1280px` · `--header-h 84px` · `--section-y clamp(4.5rem,9vw,9rem)` · ease `cubic-bezier(.22,1,.36,1)`

→ Detta är "EDGE"-temat: varmt papper + mässing-accent + klassiska serifer. Blir look #1:s token-tema.

## Modul-slots (live, inte statisk markup)
- `#boka` → **booking-modulen** (det riktiga boka-flödet).
- `#tjanster` → **booking-modulens tjänster + priser** (live), om Zivar vill — annars statisk services-grid via content_slots.
- Övriga sektioner = content-sektioner (redigerbara via content_slots).

## Byggregel (goal-52)
- Bygg **native i kitet** — porta sektionerna till kit-komponenter, lyft tokens exakt. `js/main.js` (hero-slider, mobil-meny) = **referens** för interaktion → bygg native motsvarighet, importera inte filen.
- Boka/tjänst = **Corevo-modul** (live), aldrig statisk kopia.
- Design-trohet: live ska bli en exakt känsla-kopia av EDGE — px/hex/font ur källan, **render-verify 0 FAIL**, oberoende verify.
- = **look #1** i goal-52. Resten av de 5 byggs på samma kit efteråt.

## Källa
Original-zip: `Fris-ren.zip` (uppladdad 2026-06-26). Backend (functions/worker/.wrangler/sqlite) medvetet utelämnad — Corevos moduler ersätter den.
