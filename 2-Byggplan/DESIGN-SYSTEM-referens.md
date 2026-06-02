# DESIGN-SYSTEM — referens (binder Claude Design-bundlen till modulerna)

**Datum:** 2026-06-02
**Status:** Spikad. Kompletterar de 7 modul-doken — de säger *vad* varje yta gör, detta säger *hur den ser ut*.
**Källa:** `Corevo_Booking_Design_System-handoff.zip` (Claude Design).
**Var bundlen ligger i repot:** `2-Byggplan/corevo-booking-design-system v2/project/` (tokens + ui_kits + `handoff-assets/` med M6-byggspec + skärmar). EN mapp, uppdaterad. Code läser den direkt.

> **Bekräftar, river inte.** Designen matchar den byggda arkitekturen (två världar, 5 teman, `data-world`). Code ska **aligna befintliga ytor mot den** — inte bygga om. Där bygget redan matchar = bekräftelse. Där bundlen tillför (token-precision, komponent-states, innehållston, kund-skärmar) = applicera.
>
> ⚠️ **Design läggs PÅ funktionen — den får ALDRIG ändra eller döda hur något funkar.** Funktionen står; det här doket säger hur ytan *ser ut*, inte hur den *funkar*. Finputs/optimering av look sker löpande under bygget — funktion bryts aldrig för designens skull.

---

## 1. Den enda regeln — TVÅ CSS-VÄRLDAR (aldrig blanda)

| | STOREFRONT (värld 1) | BACK-OFFICE (värld 2) |
|---|---|---|
| Vad | Salongens egna sida — **produkten** | Corevos verktyg (super/salon/staff) |
| Domän | `demo.corevo.se`, `frisorN.corevo.se` | `booking.corevo.se` |
| Look | Editorial, foto-drivet, svensk salong | Forest `#1F4636` + gold `#F5A623` på cream |
| Färg/font | **Per-tenant** | Playfair + Inter, fast |
| Corevo-brand | **Aldrig synlig för kund** | Front and center |

Varje yt-root bär `data-world="storefront|backoffice"`. Storefront-roots även `data-theme="salvia|leander|zigge|linnea|edit"`. Tokens i `colors_and_type.css`.

---

## 2. Token-kontrakt (storefront per-tenant)

Branding-editorn (M6 §3.6) sätter per tenant: `--color-primary` · `--color-bg` · `--color-fg` · `--font-display` · `--font-body`. Det bekräftar **M2 §2.4** (runtime-tokens, ej build-inlinat) — det är så live-preview funkar.

**De 5 temana (exakta värden i `colors_and_type.css`):**

| Tema | Mood | Accent | Display-font |
|---|---|---|---|
| Salvia | luftig, minimal, papper | sage `#5E7361` | Cormorant Garamond |
| Leander | romantisk, centrerad | lavendel `#7E6E92` | Playfair Display |
| Zigge | mörk, barber, bold | amber `#C8743C` | Bebas Neue |
| Linnea | varm skandinavisk | clay `#B0693F` | DM Serif Display |
| Edit | elegant editorial | charcoal `#3A3733` | Cormorant Garamond |

Back-office: fast forest+gold på cream, Playfair + Inter, mörk sidebar. Type-roller + shadows + radii alla i token-filen.

---

## 3. Prototyp → modul (vad Code följer per yta)

| ui_kit-prototyp | Modul | Not |
|---|---|---|
| `storefront/Home.jsx` + `layouts/*` | **M2** | 5 teman, sektioner |
| `storefront/Booking.jsx`, `booking-variants/*` | **M3** | inbäddad wizard, Variant 3/4 |
| `storefront/Account.jsx` | **M4** | kundens konto/portal |
| `storefront-mobile/` | M2/M3 | mobil bottom-sheet |
| `back-office/SalonAdmin.jsx`, `ServicesSchema.jsx`, `Branding.jsx`, `Bookings.jsx` | **M6** | ägarens center |
| `back-office/Customers.jsx`, `Customer.jsx` | **M6 §4 + M4/M5** | **kunddatabas + kundkort — design finns redan** |
| `back-office/Staff.jsx`, `StaffSettings.jsx` | **M5/M6** | personal + schema |
| `back-office/SuperAdmin.jsx` | **M7** | plattform/operativ data |
| `icons.jsx` (Lucide-derived) | alla | delad ikon-set |

---

## 4. Innehållston (svenska, två röster)

- **Storefront → kunden:** varm, lugn, personlig "du". Korta sensoriska rader, italic serif-accent. Eyebrow = em-dash + ämne ("— Tjänster"). CTA alltid **"Boka tid"** (aldrig "Boka nu!!"). Ton skiftar per tema men alltid mänsklig.
- **Back-office → operatören:** klar, effektiv, lugn "du". "Onboarda salong", "Dagens bokningar", "Anmäl frånvaro". Status enkla ord: Aktiv · Pausad · Onboarding · Bekräftad · Incheckad.

---

## 5. Booking-design — håll isär två "wavy"

- **Inbäddad bokning, ALDRIG redirect.** Öppnas in-page (drawer/sheet).
- **Benchmark:** `bokning.voady.se` = den *bra* (ren, branded, embedded-känsla).
- ⚠️ **`book.wavy.nu` = design-ANTI-pattern** (generisk extern portal — bygg INTE så). Men: wavy var Zivars **slot-modell**-referens (tiderna 12:30/13:05…, M3 §5). Designmässigt är den motexemplet. Code måste hålla isär: *wavy = slot-tider att härma, inte design att härma.*

---

## 6. Hur Code använder detta (från bundlens README)

- **Recreate pixel-perfekt** i Next/React — matcha visuell output, kopiera **inte** prototypens interna struktur.
- **Läs källan (HTML/CSS/JSX), screenshota inte** — allt (mått, färg, layout) står i koden.
- Tokens (`colors_and_type.css`) är sanningen för färg/spacing/radie/font.

---

## 7. Alla format — tablet + responsivt (låst)

Ingen separat "front-desk-app". Istället, tvärs **både admin och storefront**:
- **Långlivade sessioner på iPad OCH Android-platta** — front-desk loggas inte ut hela tiden.
- **Äkta responsivt över format utan knas** — inget fastnar i en "web-only"-layout; ytorna anpassar sig (telefon / platta / desktop).
- Den responsiva admin-dashboarden **ÄR** front-desk-vyn på en iPad — ingen bespoke skärm behövs i v1.

---

## 8. Sammanfattning för workflowen

Code följer: **detta dok** (mappning + regler) + **`colors_and_type.css`** (tokens) + **rätt ui_kit-prototyp per yta** (§3). Aligna, aligna inte bygg om. Två världar, aldrig blanda. Storefront-look = kod i säker miljö (M7 §2.1A) — det är *här* den koden hör hemma.
