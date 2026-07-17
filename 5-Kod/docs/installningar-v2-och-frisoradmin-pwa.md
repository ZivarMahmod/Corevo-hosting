# Inställningar v2 och Frisöradmin PWA

Teknisk referens för Goal 71. Dokumentet beskriver paket 04 och 06. Paket 05
Kundportal ingår inte och har inte ändrats.

## Resultat

- `/admin/installningar` är ett responsivt inställningsnav enligt designpaket 04.
- `/personal` är den mörka, mobilanpassade personal-PWA:n enligt designpaket 06.
- `booking.corevo.se` är primär inloggningsdörr för både admin och personal.
- `minbooking.corevo.se` fortsätter servera samma `/personal`-kod som en parallell
  legacy-dörr. Ingen DNS-post, route eller redirect har tagits bort.
- Behörigheter som ägaren sätter i paket 04 används av både adminytorna och
  personal-PWA:n. Kontrollerna finns på servern och i databasen, inte bara i UI.

## Värdar och inloggningsflöde

| Värd                   | Roll        | Landning    | Status           |
| ---------------------- | ----------- | ----------- | ---------------- |
| `booking.corevo.se`    | ägare/admin | `/admin`    | primär           |
| `booking.corevo.se`    | personal    | `/personal` | primär           |
| `minbooking.corevo.se` | personal    | `/personal` | parallell legacy |

Inloggningsactionen accepterar personal på legacy-värden men räknar fortfarande
rollen från det verifierade kontot. Värden ger alltså aldrig extra behörighet.
Auth-cookies är host-only: booking och minbooking kan bära varsin session och vara
öppna samtidigt. Två olika konton på exakt samma värd delar däremot samma
webbläsarcookie; använd två webbläsarprofiler eller privat fönster för det fallet.

## Datamodell

Migration `0081_tenant_member_permissions.sql` lägger till en rad per person och
tenant i `public.tenant_member_permissions`:

| Kolumn                   | Betydelse                                                |
| ------------------------ | -------------------------------------------------------- |
| `tenant_id` + `staff_id` | sammansatt unik identitet och sammansatt FK till `staff` |
| `operational_role`       | `manager` (PLATSCHEF) eller `staff` (FRISÖR)             |
| `can_view_all_calendars` | individuellt tillägg för kollegors kalendrar             |
| `can_manage_customers`   | individuellt kundtillägg                                 |
| `can_edit_site`          | individuellt tillägg för Sida                            |
| `can_view_daily_metrics` | individuellt tillägg för dagens nyckeltal                |
| `notify_*`               | personens tre egna notisval i Min profil                 |

Ägare representeras inte av `operational_role`. Ägarskap kommer fortsatt från
tenantens riktiga rollnivå (`role_level >= 6`) och kan därför inte väljas fram av
en personalanvändare eller manipuleras med formulärdata.

Den sammansatta främmande nyckeln `(tenant_id, staff_id)` förhindrar att en
behörighetsrad pekar på personal i en annan tenant. `profile_id` på den aktiva
staff-raden kopplar raden till `auth.uid()`; ingen parallell personmodell skapades.

## Behörighetsmatris

| Område                                    | Ägare |              Platschef |                              Frisör |
| ----------------------------------------- | ----: | ---------------------: | ----------------------------------: |
| Kalender/bokningar                        |  full |            platsbunden |                      egen arbetsyta |
| Kunder                                    |  full |                     ja | enligt befintlig kundpolicy/tillägg |
| Tjänster                                  |  full |            platsbunden |                                 nej |
| Scheman/frånvaro                          |  full |            platsbunden |                    egen personalyta |
| Personal, konton och aktivering           |  full |                    nej |                                 nej |
| Sida                                      |  full | endast `can_edit_site` |              endast `can_edit_site` |
| Ekonomi, roller och globala inställningar |  full |                    nej |                                 nej |

`private.has_admin_area_permission(area)` är den centrala fail-closed-signalen.
Den kräver verifierad tenant, aktiv staff-rad och rätt roll/tillägg. Next-DAL:en
`requireAdminArea` använder samma områdesnamn före sidrendering och före varje
muterande server action.

Databasen kompletterar detta med:

- RLS för behörighetsraden, tjänster, staff-service-kopplingar och schematabeller.
- Platskontroll via `private.can_access_location()`.
- En staff-trigger under RLS och SECURITY DEFINER som gör skapande, aktivering,
  flytt och radering av personal fortsatt ägar-/platsadminlåst.
- En härdad slot-generator som kontrollerar både området `scheman` och exakt plats.
- Ett separat `can_edit_site`-staket för site revisions; PLATSCHEF i sig öppnar inte Sida.
- Revokad `anon`-åtkomst och smala `authenticated`-grants på RPC:erna.

Ändringar av medlemsbehörighet och egna notisval skrivs genom smala RPC:er.
Tenant och person härleds från sessionen. Audit-loggen sparar händelsetyp och
entitets-id utan e-post eller namn i `meta`.

## Inställningar v2

Navet har fem grupper och tolv kategorier. Varje kategori pekar till den befintliga
ägande routen; navet skapar inte en andra kopia av tjänster, schema, betalning eller
sidinnehåll. Sökningen använder designpaketets synonymer och vald kategori speglas i
`?kategori=...`, så bakåt/framåt och delbara länkar fungerar.

Statusprickar används endast för verkliga varningar. Bokningsstatus kommer från
den befintliga booking-modulens livscykel. Aktiva konton räknas bara när både
staff-raden är aktiv och ett `profile_id` finns. Påminnelser visas som aktiva endast
när den riktiga reminder-inställningen inte är avstängd.

På mobil visas först kategorilistan och sedan vald kategori som egen vy. Desktop
följer paketets 308 px navigation, 760 px innehållsyta och exakta mörka tokens.

## Frisöradmin PWA

`/personal` använder en egen mobil shell med två permanenta val: Kalender och Min
profil. Den återanvänder inte kundadminens desktop-sidebar.

Kalendern laddar verkliga bokningar i den valda platsens tidszon. Utan
`can_view_all_calendars` används alltid sessionens egen `staff_id`. Med tillägget
kan användaren välja tillåtna kollegor, men tenant- och plats-RLS gäller fortfarande.
Vald kollega bevaras vid dagbyte.

Bokningssheeten visar verklig tid, kund och tjänst. Snabbbokning/walk-in visas bara
för den egna kalendern och använder verkliga aktiva tjänster. Min profil visar
verkligt konto, schema, kommande frånvaro och tre personliga notisval. Kontosäkerhet
ligger på `/personal/konto`, inte på en adminlåst route.

PWA-manifestets namn, färger och scope är personalanpassade; scope är `/personal`.

## Driftsättning och rollback

Ordningen är viktig:

1. Kör migration 0081 och advisor-cleanup 0082.
2. Driftsätt webbbygget.
3. Smoke-testa ägare på `/admin/installningar`.
4. Smoke-testa personal på `booking.corevo.se/personal`.
5. Smoke-testa samma kodväg på `minbooking.corevo.se/personal`.

Ingen rollback får droppa `tenant_member_permissions` eller ta bort minbooking.
Vid webbproblem kan föregående Worker-version återställas medan migrationen lämnas
kvar additivt. Vid behörighetsproblem återställs en persons rad/roll av ägaren;
tenant- och staff-identiteter raderas inte.

## Automatisk verifiering

- Vitest: 152 testfiler, 1 377 tester gröna 2026-07-17.
- TypeScript: 0 fel.
- ESLint: 0 fel; sju äldre varningar utanför detta bygge.
- Acceptans 04: 4/4 kontrakt gröna, `probe.js` = PASS.
- Acceptans 06: 3/3 kontrakt gröna, `probe.js` = PASS.

Autentiserad visuell produktionstest kräver Zivars riktiga testkonton och görs med
testlistan i `6-Testing/goal-71-installningar-frisoradmin-testlista.md` före deploy.
