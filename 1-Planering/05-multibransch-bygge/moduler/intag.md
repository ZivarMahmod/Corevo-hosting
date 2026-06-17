# Modul: Intag-formulär GDPR (intag)

> En fil per modul. Följer `10-arkitekturprincip-universal-vs-variant.md`. Status: 🆕 **NY MODUL** (finns EJ i DB — kräver tabell + hård RLS + `modules`-rad). DB-sanning §0/§7.2. **KÄNSLIG DATA — hårdast i hela plattformen.** Schema bara på Zivars go.

## 1. Kärna (universell)
Ett strukturerat intag som en patient/kund fyller i **före första besöket** (separat från bokningen) — personuppgifter, symtom/anamnes, samtycke. EN tabell `intake_forms` (NY), krypterad, RLS hårt scopad: **endast behandlare (`role_level() >= 3`) ser innehållet — kunden ser bara att det är ifyllt, aldrig andra kunders intag, aldrig anon.** Samtycke loggas separat (tidsstämpel, ändamål, version). Universell men i praktiken bara klinik aktiverar den; default off.

## 2. Universal vs variant — beslut + axlar
**NY modul (egen tabell), men universell + togglad** — inte klinik-specifik kod. Symtom/anamnes/samtycke är en *fundamentalt annan datamodell* än offert/booking → egen tabell, inte en variant.
- **`variant_schema`**: i praktiken en aktiv variant (`klinik`): personnummer · symtom · GDPR-samtycke. Lämna schemat öppet för fler vårdnära branscher (t.ex. estetik) utan ny modul.
- **Fält** (pnr, symtom, anamnes) = config-driven formulärschema, lagrade krypterat i jsonb — inte en kolumn per symtom.
- **`tenant_modules.config`**: vilka fält som krävs, samtyckes-text/version per klinik.
- **defaultPos = `konto`** (Mitt konto, ej publik sektion) — intaget är aldrig en publik storefront-sida.

## 3. Per bransch
| Bransch | variant-val | UI-skillnad | Funktion/flöde | Varför (verklighet) |
|---|---|---|---|---|
| Privatklinik 🌱 | klinik | Personnummer · symtom · anamnes · **GDPR-samtycke (kryssruta + version)** · "Krypterat — endast din behandlare ser detta" | Skickas separat **före första besök** → endast behandlare läser → underlag inför besöket | Naprapat/kiropraktor/psykolog behöver hälsohistorik innan de träffar patienten; data = särskild kategori (Art 9) |
| (Estetik/övrig vård, framtid) | (öppen) | Anpassat hälsoformulär | Samma mönster | Samma känslighet — återanvänd modulen, ny config |
| Alla andra branscher | (off) | — | — | Ingen hälsodata; aktivera ALDRIG utan vårdkontext |

## 4. DB-form (NY) + hård RLS
**Förslag `public.intake_forms`** (ej skapad):
- `id` uuid PK · `tenant_id` uuid NOT NULL FK→tenants · `customer_id` uuid FK→customers (set null)
- `data_encrypted` — krypterat nyttolast (pnr, symtom, anamnes). **Inte klartext-kolumner per fält.** Kryptering: pgcrypto/`pgsodium` el. app-lager-kryptering; pnr aldrig i klartext, aldrig i index.
- `consent` jsonb — `{given: bool, purpose, policy_version, ts, ip?}` (samtyckes-snapshot)
- `status` text (t.ex. submitted, reviewed) · `created_at` · `updated_at`
- Separat **samtyckeslogg**: skriv till befintlig `audit_log` (append-only, §4.3) vid varje samtycke/återkallelse — aldrig överskrivbart.

**RLS (HÅRD — striktare än customer_notes):**
- `using/with check`: **`role_level() >= 3` AND `tenant_id = private.tenant_id()`** (+ `is_platform_admin()` bypass endast för superadmin-drift). Som `customer_notes`: **kunden ser INTE ens sitt eget intag** i admin-vyn; kunden interagerar bara via Mitt konto-formuläret.
- **Ingen anon-policy** (vare sig SELECT eller INSERT). Inskick sker av inloggad kund via SECURITY DEFINER-RPC som krypterar och sätter tenant, ELLER via behandlare. Aldrig direkt anon INSERT (till skillnad från offert).
- Grants minimala: ingen `anon`. `authenticated` endast genom RLS-grinden.

## 5. Två ytor — Storefront + Admin
- **Storefront/Mitt konto** (design `super-admin/preview.jsx` → ModIntag): kunden fyller formuläret; UI visar **"Krypterat · endast din behandlare ser detta"** + rader Personuppgifter/Symtom & anamnes/GDPR-samtycke med status (Ifyllt/Godkänt). Ingen publik sida. MODULE_FACE sf: *"Kunden fyller intagsformuläret (krypterat) i Mitt konto."*
- **Admin**: behandlare läser intaget — **RLS-låst** (designens MODULE_FACE adm: *"Behandlaren läser intaget — RLS-låst, känslig data."*). Ingen design-yta i `surfaces-more.jsx` ännu (intag = roadmap) → byggs när klinik onboardas. Admin-läsning loggas (vem läste vilket intag, när) i audit_log.

## 6. Verklighets-koll (svensk GDPR — viktigast)
- **Hälsodata = särskild kategori (Art 9 GDPR).** Behandling förbjuden som huvudregel; tillåts via undantag **Art 9.2 h** (vård/medicinsk diagnos) *förutsatt att uppgifterna behandlas av/under ansvar av yrkesutövare med tystnadsplikt*.
- **⚠ Samtycke är oftast FEL rättslig grund i vården.** IMY: i en vårdsituation är samtycke sällan möjligt/lämpligt eftersom förhållandet vårdgivare↔patient är **ojämlikt** (svårt att uppfylla "frivilligt"). Rätt rättslig grund för kliniken: **Art 6.1 c** (rättslig förpliktelse att föra patientjournal, 3 kap. patientdatalagen 2008:355) eller **Art 6.1 e** (allmänt intresse, HSL 2017:30) — **inte** Art 6.1 a.
  - **Konsekvens för bygget:** "GDPR-samtycke" i intaget är (a) klinikens egna icke-vård-ändamål (t.ex. påminnelse-SMS/mejl, marknadsföring) OCH (b) Corevos roll som **personuppgiftsbiträde** (processor) åt kliniken (personuppgiftsbiträdesavtal krävs). Logga samtycket — men förlita dig inte på det som rättslig grund för själva vården.
- **Personnummer:** får bara behandlas när kodade/indirekta uppgifter inte räcker (dataminimering; jfr 7 kap. 8 § patientdatalagen). Aldrig i index, aldrig i klartext, aldrig i loggrad.
- **Kryptering + åtkomst:** IMY rekommenderar portal-inloggning / kryptering; undvik känsliga uppgifter via oskyddad e-post — flytta in till rätt system snarast. → intag skickas via inloggad portal (aldrig mejl), krypteras i vila, RLS-låses.
- **Patientdatalagen** gäller utöver GDPR om kliniken är vårdgivare (journalföring, åtkomstloggning, gallring). Corevo måste stödja: åtkomstlogg, gallring/anonymisering (`scrub_customer_notes_on_anonymize` finns som mönster), och biträdesavtal.
- **Lätt missat:** läsning ska loggas (vem öppnade intaget); samtyckes-VERSION måste sparas (policy ändras); återkallelse av samtycke måste gå att registrera (append i audit_log); gallringsregel per klinik.

## 7. Status idag vs bygg
- **Finns:** inget i DB (ingen `intake_forms`, ingen modules-rad). Endast design-mockup (ModIntag, MODULE_FACE, cfg-data variant `klinik`).
- **Bygg (fas D, per riktig klinik, Zivars go):** migration `intake_forms` + kryptering + hård RLS (role_level≥3) + samtyckeslogg→audit_log + SECURITY DEFINER-inskicks-RPC + Mitt konto-formulär + behandlar-läsvy med åtkomstlogg + biträdesavtal/DPA-flöde. **Inget byggs spekulativt — kräver juridisk avstämning först.**

## 8. Öppna beslut för Zivar
1. **Rättslig grund i produkten:** bygger vi samtycket som *enda* grund (enkelt men IMY-svagt) eller modellerar vi det rätt (vård = Art 6.1c/e + Art 9.2h; samtycke endast för icke-vård + processor-relation)? **Rekommendation: det senare.**
2. **Kryptering var:** pgcrypto/pgsodium i DB vs app-lager-kryptering (KMS)? Påverkar nyckelhantering.
3. **Personuppgiftsbiträdesavtal (DPA):** krävs mellan Corevo och varje klinik — ska det vara ett inbyggt onboarding-steg?
4. **Gallring:** per-klinik retention-policy för intag (patientdatalagen) — config eller hårdkodad standard?
5. **Är Corevo redo för vårddata alls?** Detta är den mest reglerade modulen — bör den vänta tills en betalande klinik faktiskt kräver den (build-once), och först efter juridisk granskning?

## 9. Källor
- IMY, *När får ni behandla känsliga personuppgifter?* (uttryckligt samtycke; e-post/kryptering): https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/introduktion-till-gdpr/personuppgifter/kansliga-personuppgifter/nar-far-ni-behandla-kansliga-personuppgifter/
- IMY, *Frågor och svar — personuppgifter i hälso- och sjukvården (för vårdgivare)* (samtycke ofta olämpligt pga ojämlikt förhållande; Art 9.2h; rättslig grund 6.1c/e; personnummer-minimering): https://www.imy.se/verksamhet/dataskydd/dataskydd-pa-olika-omraden/vard/fragor-och-svar-om-personuppgifter-i-halso--och-sjukvarden--for-vardgivare/
- Patientdatalag (2008:355), Sveriges riksdag (journalföring, kvalitetsregister 7 kap. 8 §): https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/patientdatalag-2008355_sfs-2008-355/
- Internt: DB-sanning §4 (RLS, role_level, customer_notes, audit_log, anonymisering); `cfg-data.js` (MODULES.intag, MODULE_FACES.intag, BRANCHES.klinik); `preview.jsx` (ModIntag); `09-modul-bransch-spec-backlog.md`.
