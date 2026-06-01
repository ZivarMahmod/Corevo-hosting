# Corevo Booking Platform — Onboarding-flöde (ny salongskund)

**Senast uppdaterad:** 2026-05-31
**Status:** Planering — ingen kod
**Gäller:** Hur Corevo tar in en ny salongskund (tenant) i M7 Platform Admin

---

## Vad detta dokument är

Steg-för-steg-trappan när en ny salong blir kund. En kodbas, ny kund = ny **tenant + config** (inte ny template).

**Målet:** Kunden gör steg 3 helt själv. Corevo rör bara steg 1, 5 och 6. Minimera support.

---

## 1. Översikt — onboarding-trappan (steg 1–6)

| Steg | Vad | Vem | Var i systemet | Klart när |
|------|-----|-----|----------------|-----------|
| 1 | Skapa tenant | Corevo | M7 Platform Admin | Tenant finns med eget id + abonnemang |
| 2 | Branding (logga, färg, tema) | Corevo + kund | M7 (Corevo) / M6 (kund) | Logga + minst en färg satt |
| 3 | Salonger, personal, tjänster, priser | **Kund (self-service)** | M6 Salon Admin (wizard) | Minst 1 salong, 1 personal, 1 tjänst m. pris |
| 4 | Koppla Stripe-konto | **Kund (self-service)** | M6 → Stripe-hostat flöde | Stripe-konto verifierat (`charges_enabled`) |
| 5 | Peka domän (freshcut.se) | Corevo (hjälper) | M7 + Cloudflare | Domän verifierad + SSL aktivt |
| 6 | Lansera (live) | Corevo | M7 Platform Admin | Sajten är live på kundens domän |

**Snabbläsning:** Corevo = steg 1, 5, 6. Kund själv = steg 3, 4. Delat = steg 2.

---

## 2. Varje steg i detalj

### Steg 1 — Skapa tenant (Corevo)

| | |
|---|---|
| **Vad händer** | Corevo skapar en ny tenant. Den får ett eget tenant-id som all data taggas med. |
| **Fält/data** | Företagsnamn, org-nr, kontaktperson (namn, e-post, telefon), val av abonnemang (Bas/Plus/Pro) |
| **Modul** | M7 Platform Admin |
| **Self-service?** | Nej — Corevo gör detta |
| **Resultat** | Tenant finns. Kunden kan bjudas in till M6 Salon Admin. |

### Steg 2 — Branding (Corevo + kund)

| | |
|---|---|
| **Vad händer** | Visuell identitet sätts: logga, färger, typsnitt, tema-variant. |
| **Fält/data** | Logga (uppladdning), primärfärg + ev. sekundärfärg, typsnitt, val av layout-variant |
| **Modul** | M7 (Corevo kan sätta) / M6 (kund kan justera) |
| **Self-service?** | Delvis — kund väljer färdig variant + egna färger/logga själv. Custom design = Corevo bygger (tillval, avgift). |
| **Tema (ADR-beslut)** | **Standard:** kund väljer en av flera färdiga layout-varianter + egna färger/logga (self-service). **Custom:** Corevo bygger ett eget tema, tar betalt extra. |
| **Resultat** | Logga + minst en färg satt. |

### Steg 3 — Salonger, personal, tjänster, priser (KUND SJÄLV)

| | |
|---|---|
| **Vad händer** | Kunden fyller plattformen med sitt innehåll, i en guidad wizard. |
| **Fält/data** | **Salong:** namn, adress, öppettider. **Personal:** namn, roll, schema. **Tjänst:** namn, längd, pris, kategori. **Pris:** per tjänst (ev. per personal). |
| **Modul** | M6 Salon Admin (onboarding-wizard) |
| **Self-service?** | **Ja — detta är kärnan i self-service.** Corevo rör inte detta. |
| **Wizard-ordning** | 1) Skapa minst en salong → 2) Lägg till personal → 3) Skapa tjänster m. pris → 4) (leder vidare till Stripe, steg 4). Wizarden visar framsteg + vad som är kvar. |
| **Resultat** | Minst 1 salong, 1 personal, 1 tjänst med pris. |

### Steg 4 — Koppla Stripe-konto (KUND SJÄLV)

| | |
|---|---|
| **Vad händer** | Kunden kopplar sitt eget Stripe Connect-konto så att bokningsbetalningar landar hos salongen. Corevo tar transaktionsavgift via plattformen. |
| **Fält/data** | Allt samlas in i Stripes hostade flöde: org-nr/personnr, bankkonto, identitet, adress. Corevo lagrar inget av detta. |
| **Modul** | M6 Salon Admin → knapp "Koppla betalning" → Stripe-hostat onboarding |
| **Self-service?** | Ja — Stripe sköter hela flödet |
| **Resultat** | Stripe-konto verifierat (`charges_enabled = true`, `payouts_enabled = true`). |

Detaljer i avsnitt 3.

### Steg 5 — Peka domän (Corevo hjälper)

| | |
|---|---|
| **Vad händer** | Kundens domän freshcut.se pekas mot plattformen så bokningssajten (M1) ligger på kundens egen adress. |
| **Fält/data** | Domännamn, DNS-post hos kundens registrar, SSL-validering |
| **Modul** | M7 Platform Admin + Cloudflare for SaaS |
| **Self-service?** | Nej — Corevo guidar; kund lägger en DNS-post hos sin registrar |
| **Resultat** | Domän verifierad + SSL aktivt. |

Detaljer i avsnitt 4.

### Steg 6 — Lansera (Corevo)

| | |
|---|---|
| **Vad händer** | Corevo bockar av checklistan, slår på "live" och dubbelkollar att bokning + betalning + domän funkar. |
| **Fält/data** | Status-flagga: live = på. Ev. test-bokning. |
| **Modul** | M7 Platform Admin |
| **Self-service?** | Nej — Corevo gör sista kontrollen |
| **Resultat** | Sajten är live på kundens domän. Kunden kan ta emot bokningar. |

---

## 3. Stripe-kopplingen (steg 4) — verifierat flöde

**Kontotyp:** **Stripe Connect Express** (rekommenderat). Stripe sköter hela onboarding-UI:t och regelefterlevnaden (KYC/identitet) — minst jobb för Corevo, minst support.

### Flödet (verifierat mot Stripes dokumentation, 2026)

| # | Vad händer | Vem |
|---|------------|-----|
| 1 | Kunden klickar "Koppla betalning" i M6 | Kund |
| 2 | Plattformen skapar ett **connected account** (Express) via Accounts API | System (Corevo-plattform) |
| 3 | Plattformen genererar en **Account Link** (engångslänk, tidsbegränsad) med `refresh_url` + `return_url` | System |
| 4 | Kunden skickas till **Stripe-hostat onboarding** och fyller i: org/personnr, bankkonto, identitet, adress | Kund (hos Stripe) |
| 5 | Stripe verifierar (KYC). Kunden skickas tillbaka till `return_url` (M6) | Stripe |
| 6 | Plattformen läser kontostatus. Klart när `charges_enabled` + `payouts_enabled` = true | System |

### Viktigt att veta

- **Account Link är engångs och går ut.** Om kunden inte hinner klart måste plattformen generera en ny länk (det är vad `refresh_url` är till för).
- **Corevo lagrar aldrig bankuppgifter** — allt sker hos Stripe. Plattformen lagrar bara `stripe_account_id` + status.
- **Pengaflöde:** kundens kund betalar → pengar till salongens Stripe-konto → Corevo tar `application_fee` (transaktionsavgift) på varje bokning.
- **Express vs Standard:** Express = Stripe-hostat, enkel "Express Dashboard" för salongen, Corevo styr mer. Standard = salongen har fullt eget Stripe-konto/dashboard men mer egen hantering. **Rekommendation: Express** för minst support och bäst self-service.
- **Status visas i M7:** Platform Admin visar Stripe-status per tenant (kopplat / väntar / verifierat).

---

## 4. Domän-kopplingen (steg 5) — verifierat flöde

**Verktyg:** **Cloudflare for SaaS** med **custom hostnames** (verifierat mot Cloudflares dokumentation, 2026). Detta är standardsättet att låta varje kund ha sin egen domän mot en multi-tenant-plattform.

### Begrepp (kort)

- **Fallback origin:** plattformens standard-origin dit all custom-hostname-trafik går (t.ex. `customers.corevo.se`). Sätts upp en gång.
- **Custom hostname:** kundens domän (freshcut.se) som Corevo registrerar i Cloudflare.
- **DCV (Domain Control Validation):** Cloudflare bevisar att kunden äger domänen → utfärdar SSL automatiskt.

### Flödet (verifierat)

| # | Vad händer | Vem |
|---|------------|-----|
| 1 | Corevo har en fallback origin uppsatt i Cloudflare (engångs, för hela plattformen) | Corevo (en gång) |
| 2 | Corevo skapar custom hostname för freshcut.se via Cloudflare (dashboard/API) | Corevo |
| 3 | Kunden lägger en **CNAME** hos sin registrar: `freshcut.se → fallback origin` (t.ex. `customers.corevo.se`) | Kund (Corevo guidar) |
| 4 | Cloudflare kör **DCV** (TXT-, HTTP- eller CNAME-validering) och utfärdar SSL automatiskt | Cloudflare |
| 5 | Domän verifierad + SSL aktivt → trafik routas till plattformen, taggas till rätt tenant | System |

### Viktigt att veta

- **Kunden gör bara EN sak:** lägger en DNS-post (CNAME) hos sin registrar. Corevo sköter resten i Cloudflare.
- **SSL är automatiskt** — Cloudflare provisionerar och förnyar certifikat. Ingen manuell cert-hantering.
- **M7 visar domän-status** (väntar på DNS / validerar / verifierad).
- **Tips för minst support:** ge kunden en färdig copy-paste-instruktion med exakt CNAME-värde.

---

## 5. Onboarding-checklista (den M7 visar Corevo per ny kund)

Platform Admin visar en checklista med status per steg, så Corevo direkt ser var kunden är.

- [ ] Tenant skapad
- [ ] Branding satt (logga + minst en färg)
- [ ] Minst en salong skapad
- [ ] Minst en personal tillagd
- [ ] Minst en tjänst med pris
- [ ] Stripe-konto kopplat och verifierat (`charges_enabled`)
- [ ] Domän pekad och verifierad (SSL aktivt)
- [ ] Lanserad (live)

**Status-färg per steg:** ej påbörjad / pågår / klar. Corevo agerar bara på det som fastnar.

---

## 6. Automatisering — v1 (manuellt) vs v2 (automatiserat)

| Område | v1 (start) | v2 (senare) |
|--------|------------|-------------|
| Skapa tenant | Corevo gör manuellt i M7 | Self-service signup-formulär → tenant skapas automatiskt |
| Branding | Kund laddar upp, ev. Corevo hjälper | Auto-förslag på färger från logga; live-förhandsvisning |
| Steg 3 (salong/personal/tjänst) | Guidad wizard (redan self-service) | Importera från CSV / Google Business; mallar per salongstyp |
| Stripe | Kund kör Stripe-flödet, Corevo kollar status manuellt | Webhook uppdaterar status automatiskt + auto-påminnelse om kunden inte slutfört |
| Domän | Corevo skapar custom hostname + guidar kund | Kund anger domän i UI → custom hostname skapas via Cloudflare API automatiskt; auto-DCV-status |
| Lansering | Corevo bockar av + test-bokning manuellt | Auto-lansering när alla checklist-punkter gröna |
| Påminnelser | Manuellt | Auto-mejl till kund om steg fastnar (t.ex. Stripe ej klar på 48h) |

**Princip:** v1 = få kunden att göra steg 3+4 själv, Corevo kör 1/5/6 för hand. v2 = ta bort Corevo från 1 och 5 också.

---

## 7. Öppna frågor (max 4)

1. **Express eller Standard Stripe Connect?** Express ger minst support och bäst self-service — men bekräfta att salongerna är OK med Express Dashboard (inte fullt eget Stripe-konto).
2. **Subdomän innan egen domän?** Ska varje tenant få en `kund.corevo.se` direkt vid steg 1 (så de kan vara live innan freshcut.se pekats), och egen domän blir steg 5? Skulle göra steg 5 frivilligt/senare.
3. **Vem äger logga/färg-godkännande?** Får kunden publicera branding själv (steg 2 helt self-service) eller ska Corevo godkänna innan lansering?
4. **Custom design — pris och leveranstid?** Behöver fastställas så det kan visas som tydligt tillval i onboarding steg 2 (kopplar till affärsmodellen).
