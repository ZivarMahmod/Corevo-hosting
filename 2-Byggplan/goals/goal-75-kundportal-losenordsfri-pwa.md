# goal-75 — Lösenordsfri kundportal och PWA

> Startad 2026-07-22 på Zivars uttryckliga prioritering. Goal-74 är driftsatt
> och full SMS-PIN-finalisering är verifierad men ligger kvar i väntan på den
> separata e-postfallback-canaryn.

## Mål

Efter en verifierad bokning får kunden en säker länk till `mina.corevo.se`
och ser direkt sina egna bokningar utan traditionell inloggning. Portalen minns
den verifierade enheten med en separat, hashad och revokerbar portalsession och
kan installeras som en neutral PWA. Ingen tenant, kund eller bokning får kunna
läcka mellan sessioner.

## Designlag

- `4-Dokument-Underlag/01-acceptans/kundportal-losenordsfri-pwa-v1/`
- `4-Dokument-Underlag/02-design-brief/kundportal-losenordsfri-pwa-v1-designspec.md`
- `1-Planering/19-lanseringsprogram/02-kundportal-implementation-map.md`

## Acceptans

- `mina.corevo.se` är host-isolerad och alla andra routes/hosts fail-closed.
- Magic-link-token finns bara i URL-fragment, förbrukas via POST och rensas
  omedelbart från adressfältet.
- Bara token- och sessionshashar lagras; råhemligheter finns aldrig i databasen.
- Portalens cookie är `__Host-corevo-portal`, Secure, HttpOnly, SameSite=Lax,
  host-only och revokerbar server-side.
- Tenant och customer härleds alltid ur verifierad session i smala RPC:er.
- Bokningslista, historik och detalj visar endast tillåtna presentationsfält.
- Okänd eller felägd bokning ger samma neutrala svar.
- Avbokning kontrollerar ägarskap och aktuell policy atomiskt och producerar
  exakt ett beständigt event vid en verklig transition.
- `Boka igen` går till en servervaliderad aktiv tenantdomän, aldrig fri redirect.
- Manifest, ikoner och cache innehåller ingen tenant- eller persondata.
- Legacy `/konto` och publik bokning fortsätter fungera oförändrat.
- Hela designpaketets acceptansmatris och probe slutar med 0 FAIL/BLOCKER.

## Status

- [x] D0 designgrind oberoende verifierad
- [x] T1 portalhost och route-brandvägg implementerad och oberoende granskad
- [x] T2 privata tabeller och service-role-RPC:er
- [x] T3 magic-link exchange och portalsession
- [ ] T4–T8 bokningsdata, detalj, avbokning, kalender och boka igen
- [ ] T9–T11 profil, recovery, säkerhet och PWA
- [ ] T12 full regression, oberoende verifiering och kontrollerad release
