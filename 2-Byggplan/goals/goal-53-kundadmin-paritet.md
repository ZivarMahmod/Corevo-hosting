# goal-53 — Kund-admin-paritet (booking.corevo.se)

**Zivars order (2026-07-08):** kund-adminens yta ligger långt efter super-adminens
kundkort. Kunden (frisör) ska få ett SUPER-smidigt UX, känna att den fått ett
system och inte är beroende av Zivar — och det Zivar ändrar i kundkortet ska
ändras hos kunden med (samma data, samma redigerare).

## Delar

### A. Modulstyrd nav ✅
Sidomenyn + ⌘K-paletten visar BARA aktiverade moduler (`tenant_modules`;
off/saknad = dold, tom grupp döljs). Obyggda/vilande moduler (webshop, blogg,
offerter, lojalitet, presentkort, bildbibliotek) ligger på is tills de
aktiveras per kund av super-admin. FreshCut: bara booking live → ren meny.

### B. Sida-paritet ✅
Ny `/admin/sida` = EXAKT samma SidaStudio som kundkortets Sida-flik
(mall/färger/typsnitt/texter/bilder/team/kontakt/öppettider/boknings-vy +
live-preview). Nyckelbeslut: **delade actions med dubbel-guard `sidaCtx`**
(lib/platform/guard.ts) — platform_admin redigerar valfri tenant (tenantId ur
form), salon_admin ENDAST sin egen (tenantId tvingas ur JWT). Ytorna kan
aldrig glida isär eftersom komponenter + actions + preview-rutt är samma kod.
`/admin/varumarke` → redirect (tre-formulärs-sidan ersatt).
Preview-rutten `/salong-preview/<slug>` släpper in salongens egen admin.

**Sajtbyggaren (gamla SiteEditor):** förblir dubbel-gatad AV (env + per-tenant)
och osynlig — SidaStudio ÄR kundens sido-redigering nu. Ingen kod revs i detta
goal (bygg-once); rivning kan tas som separat städ-goal.

### C. Schema-ytan (byggs)
/admin/scheman: vecko-översikt (personal × mån–sön, ?week= bläddring framåt/
bakåt, bokningsantal per dag), frånvaro-admin (time_off CRUD — största
funktionsgapet: admin kunde inte se/lägga frånvaro alls), plats-filter vid >1
plats, mall-redigeraren kvar som grundtider.

### D. Bokningsytan (byggs)
?week=-bläddring (även historik), per-frisör-filter, kundnamn i stället för
"Gäst" (privacy-maskad), död "Ny bokning"-knapp ersatt, plats-kolumn/filter
vid >1 plats.

### E. Polish (byggs)
Platser-sidan till Card/Drawer-standard + tz-select; plats-väljare i
Personal-drawern (lovades av en Callout som saknade kontrollen);
delete-bekräftelse på tjänster + media; dublett-vakt i bilduppladdningen.

## Verifierat i kartläggningen (inga byggen behövs)
- **Samtidig inloggning** super_admin (superbooking) + salon_admin (booking):
  fungerar redan — AUTH_COOKIE_DOMAIN tom → host-låsta cookies, två oberoende
  sessioner. Dörr-isolering på login-action + middleware.
- **Dubbelbokningsskydd:** `no_double_booking` EXCLUDE per staff oavsett plats +
  staff↔location-fence i create_public_booking. Bokningar kan inte överlappa.
- **Öppettider:** två lager — working_hours (styr bokningen, per medarbetare i
  Scheman) + settings.opening_hours (visnings-override, redigeras i Sida →
  Kontakt). Läggs in en gång, statiskt tills ändrat.

## Status
**LIVE PROD som `v1.6.0`** (A+B commit `4563467`, C/D/E + säkerhetsfix i
`v1.6.0`-committen). Render-verifierat 2026-07-08 med RIKTIG salon_admin-session
(temporär verify-användare, raderad efteråt) mot BÅDE localhost och
booking.corevo.se: 9/9 PASS — inkl. assertions att nav INTE läcker inaktiva
moduler, att "Ny bokning"-lögnen är borta och att previewen renderar för
salongens egen admin. Adversariell review fann 1 äkta hål
(removeTenantStorefrontImage kunde R2-radera annan tenants bild via
klient-URL) — fixat med slot-medlemskaps-fence före delete.

KVAR (medvetet, rapporterat): admin kan inte SKAPA bokning i back-office
(walk-in/telefon — surrogatlänk till storefronten); vecko-rastret i Bokningar
aggregerar alla frisörer till en kolumn/dag (personal-filtret ger
en-persons-vecka); SlotManagers medarbetar-chips tappar vald vecka;
bokningsantal i schemagriden är inte plats-filtrerat; lojalitet-admin
read-only. Zivars visuella genomgång återstår innan flytt till klart/.

## UX-audit-pass 2 (2026-07-09, Zivars order — LIVE som v1.6.2)
Full UX-audit (Explore-agent, 13 fynd) + fixar, prod-verifierat 6/6 med riktig
salon_admin-session:
- **Schema-lås:** grundtiderna låsta varje sidbesök; "Lås upp" → Ja/Nej +
  automatisk kopia i `settings.schedule_backup`; "Återställ till innan
  upplåsningen" tar tillbaka allt exakt (unlockScheduleWithBackup/
  restoreScheduleBackup i schedule-actions.ts, ScheduleLock.tsx, inert-gating).
- **Mall-val plattforms-only:** kundens /admin/sida saknar Mall-sektionen
  (canChangeTemplate=false) och setTenantTheme nekar salon_admin server-side.
- **Tjänst-tidsbuggen:** duration step=5+min=1 gjorde 30/45/60 ogiltiga → step=1;
  pris required.
- **Ärlighet:** fejk-"Spara schema" borta (seed omdöpt "Fyll tider från
  arbetstiderna"); dashboardens fantom-CTA:er ("Ny bokning"/"Lägg till kund")
  ersatta med ärliga; ta-bort-medarbetare kräver två-stegs-arm; frånvaro
  till≥från klient-side; tjänster-2col kollapsar på mobil; pausad-preview-copy
  hänvisar kund till Corevo.
KVAR från auditen (P2, medvetet): SettingsForm/CustomerPrivacyForm ger inline-
feedback i stället för toast (funkar, bara inkonsekvent).

## Bokningsflödes-redesign (2026-07-09, Zivars order — LIVE som v1.7.0)
Designpaketet `4-Dokument-Underlag/01-acceptans/Frisörbokningsformulär redesign/
design_handoff_bokningsflode/` implementerat rakt av (paketet = LAG), uttryckt
på kontrakts-tokens så VARJE salongs tema styr färgerna (--fc-*/--tkt-* ur
--color-accent/-fg/-bg; forest #2E5A46 fast success; radius 0; Caslon/Franklin/
Plex Mono via next/font):
- **Wizard-rendern ombyggd** (BookingWizard.tsx) — editorial look, kalender- ELLER
  dag-remse-picker, grupperade tider (Morgon/Dagtid/Kväll), biljett-steg 5;
  state-maskin/idempotens (request_id) orörda. Bokningsfönster 90 dagar
  (BOOKING_WINDOW_DAYS — fixar "kalendern slutar 22 juli").
- **Biljettsidorna** — bekräftelsen = stub med BEKRÄFTAD-stämpel (+ alla
  betalgrenar/.ics kvar), avboka = stub + utfallstexter (app/ticket.css).
  Avboka kräver HMAC-token ?t= — utan token "Ogiltig länk" by design.
- **Mail-mallarna** i samma biljettspråk (alla 5, inline-hex).
- **NY kund-yta /admin/bokning "Bokningsflöde"** — kunden väljer bokningssätt
  (4 presentationer m. mini-schema), picker (kalender/dag-remsa), avatarläge
  (foto/initialer/namn), färger + live-preview; spegel i super-adminens
  kundkort. Prefs: readPickerMode/readStaffAvatarMode (booking-variant.ts),
  merge-aldrig-clobber i tenant_settings.settings.booking.
- **Personal-på-sidan** (Zivars mid-order): staff.avatar_url + show_on_site
  (migration 0049, applicerad), loadStaffTeam-chokepoint i getTenantBySlug —
  aktiv+synlig personal ersätter legacy-teamlistan; utan foto = silhuett-SVG;
  foto + "Visa/Dölj på sidan" i /admin/personal och Sida-studions Om oss-flik.
Prod-verifierat (riktig salon_admin-session + äkta bokning via publika RPC:n):
/, /om (4 barberare), /boka (fc-scope), bekräftelse (BEKRÄFTAD-stub), avboka
(token + stub), idempotens (samma request_id → samma bokning), /admin/bokning,
nav, /admin/sida, /admin/personal — ALLA GRÖNA. Test-bokningen avbokad
(hard-delete blockeras av trigger, korrekt).
KVAR (medvetet, rapporterat): POPULÄR-taggen saknar datakälla (services.badge?);
pre-save-previewn färgar bara om (bokningssätt syns efter Spara); compact
behåller e-postfältet (servern kräver det); plan-styrd låsning av val per kund
ej byggd; CRON_SECRET väntar på Zivars OK (påminnelse-cron verkningslös tills dess).
