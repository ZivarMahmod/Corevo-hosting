# ZIVARS ELEMENT — inventering + inbox

**Klistra in NYA element längst ned, under "INBOX".** Allt ovanför är redan inne — lägg inte in det igen.

---

## DEL 1 — DET DU REDAN SKICKAT (uiverse-dumpen)

Fil: `4-Dokument-Underlag/uiverse-komponentbibliotek.md` — 4 820 rader, 126 472 bytes.
**33 färdiga komponenter + 109 CSS-klasser.** Radnumren nedan pekar in i den filen.

### 🛒 Kassa / varukorg / köp
| Rad | Komponent | Vad det är |
|---|---|---|
| 7 | `.cart-loader` | **Kundvagns-loader** — varor som faller ner i en kundvagn. Responsiv (0.7×–1.2×). |
| 4042 | `.master-container` → `.card.cart` | **Hel varukorg** ("Your cart") med rader, priser, checkout-knapp |
| 3803 | `.container` → `.header`/`.footer` | Kort med header + footer (kvitto/summerings-anatomi) |
| 295 | `.card` → `.icon-cart-box` | **Produktkort** med ikon, namn, pris, "Add to cart"-knapp |
| 2720 | `.Btn` → `.svgContainer` | Ikon-knapp som växer ut till text vid hover (köp/dela) |

### 🔘 Knappar
| Rad | Komponent | Vad det är |
|---|---|---|
| 2608 | `.button` | Knapp med SVG-ikon + label |
| 4173 | `.group` (Tailwind) | Knapp som **öppnar upp gap vid hover** |
| 4253 | `.shadow-md` (Tailwind) | Gradient-knapp, lime→gul, hover-gap |
| 4275 | `.relative.group` | Knapp med lager under (skugg-offset som lyfter) |

### 🔀 Toggles / switchar / checkboxar
| Rad | Komponent | Vad det är |
|---|---|---|
| 2016 | `.label` → `.toggle` + `.toggle-state` | **Checkbox med indikator** |
| 2295 | `.switch` → `.slider.round` + `.sun-moon` | **Dag/natt-switch** (sol → måne) |
| 2404 | `.container` → `.line` + `.line-indicator` | Switch som ritar en linje |
| 1656 | `#switch` → `.app`/`.phone` | Hel **telefon-mockup** som byter läge med en switch |

### ⏳ Loaders (7 st, alla olika)
| Rad | Komponent |
|---|---|
| 2812 | `.loader` → `.crystal` — kristaller |
| 3056 | `.loader` → `.box1/2/3` — lådor |
| 3120 | `.loader` → `.circle` — cirklar |
| 3285 | SVG-cirkel som ritas |
| 3291 | SVG-triangel |
| 3297 | SVG-kvadrat |
| 3407 / 3517 / 3626 | `pegtop` 1–3 — tre snurrande SVG-loaders |

### 🃏 Kort
| Rad | Komponent | Vad det är |
|---|---|---|
| 714 | `.content` → `.back`/`.front` | **Flip-kort** (vänder sig) |
| 821 | `.card` → `.card__title` | Enkelt kort med ikon + titel + text |
| 829 | `.card` → `.border` + `.logo` | Kort med animerad ram + logga |
| 1024 | `.container` → `.left-side`/`.right-side` | **Betalkort** (kreditkorts-anatomi) |
| 1349 | `.wrapper` → `.inner` (`--quantity`) | **3D-karusell** — kort i cirkel |
| 1863 | `.card` → `.list`/`.element` | Kort med **menylista** (hover-rader) |
| 1950 | `.separator` | Avdelare i listan |
| 4146 | `.container` → `.pattern-bg`/`.cube-svg` | Kort med mönstrad bakgrund |

### 📱 Sociala ikoner
| Rad | Komponent | Vad det är |
|---|---|---|
| 1764 | `.card` → `.socialContainer` | Sociala ikoner (Instagram m.fl.) som **fylls vid hover** |
| 4743 | `.example-2` → `.icon-content` | Sociala ikoner med **tooltip + färgfyllning** (Discord m.fl.) |

### 💬 Tooltips / hints
| Rad | Komponent | Vad det är |
|---|---|---|
| 4498 | `.tooltip-demo` → `.tip-btn[data-tip]` | Tooltip på knapp |
| 4637 | `.item-hints` → `.hint-radius`/`.hint-dot` | **Pulserande hint-prick** ("Tip") — pekar ut en yta |

---

### ⚠️ Vad som INTE finns i dumpen (så du vet vad som saknas)
- Antals-stepper (−/1/+)
- Formulärfält / inputs med label
- Radio-knappar
- Badges / chips (slutsåld, nyhet, kategori)
- Prisrader / prislista
- Nav / meny / hamburgare
- Steg-indikator (1 av 5) för bokningsflödet
- Accordion / FAQ
- Bildgalleri / lightbox
- Datum-/tidväljare (kalender)

---

## DEL 2 — MALL-KATALOGEN (~100 riktiga sajter du redan lagt in)

`4-Dokument-Underlag/03-template-katalog/` — **kompletta HTML+CSS-paket.**
Relevanta för branscherna:

**Frisör/barber:** `52 haircut`, `BarberX-master`, `barberz-master`, `brber-master`, `razor-master`, `haircare-master`, `hairsal-gh-pages`, `12 studio-master`
**Florist/grönt:** `57 gardener`, `66 farmfresh`, `01 zouFarm`, `07 vegefoods`, `58 fruitkha`
**Klinik/vård:** `42 klinik`, `75 dentcare`, `32 orthoc`
**Restaurang/café:** `23 restoran`, `24 Restaurantly`, `64 feane`, `60 foody2`, `89 cakezone`, `94 baker`
**Bygg/hantverk:** `08 UpConstruction`, `96 arkitektur`, `97 archiark`, `31 painter`, `88 Capiclean`
**Butik/e-handel:** `35 multishop`, `28 productly`
**Övrigt:** hotell, gym, utbildning, fastighet, bil, ekonomi…

Fullständig lista: `03-template-katalog/KATALOG.md`

---

## INBOX — KLISTRA IN NYTT HÄR NEDAN

Allt under den här raden är nytt. Skriv gärna en rad om var det ska sitta (vilken mall, vilken yta) — men bara om det går snabbt. Annars klistrar du bara in, så frågar jag.

---
