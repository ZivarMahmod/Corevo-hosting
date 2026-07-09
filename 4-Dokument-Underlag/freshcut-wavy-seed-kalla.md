# FreshCut — källdata från wavy + freshcut.se (seedad 2026-07-09)

Skrapad 2026-07-09 ur book.wavy.nu (Meteor-collections + dagvyer en månad fram,
stabila mönster v.32) och freshcut.se (/priser). Seedad till prod-DB:n med
service-role-skript — detta dokument är facit om något behöver återställas.

## Salong
- **Namn:** FreshCut · "Barbershop med fokus på dig"
- **Adress:** Bokhållaregatan 2, 582 24 Linköping
- **Telefon:** 073 876 71 44 (+46738767144) · **E-post:** info@freshcut.se
- **Instagram:** https://instagram.com/freshcut.lkpg
- **Öppettider:** Mån–Tors 09–18 · Fre 09–19 · Lör 11–18 · Sön stängt
- wavy salon-id: `c93de0f5adcc02391b06f25a` · corevo tenant: `1e472427-…0549`

## Tjänster (7 st — namn ur freshcut.se/priser, längder/beskrivningar ur wavy)
| Tjänst | Längd | Pris | Beskrivning |
|---|---|---|---|
| Herrklippning | 30 min | 369 kr | Tvätt & styling ingår |
| Herrklippning Student | 30 min | 329 kr | Gäller vid uppvisande av giltig studenthandling. |
| Herrklippning, långt skägg, varm handduk | 45 min | 459 kr | Långt skägg |
| Herrklippning kort skägg, varm handduk | 30 min | 419 kr | Kort skägg |
| Pensionärsklippning | 30 min | 329 kr | — |
| Barnklippning (upp till 8 år) | 30 min | 299 kr | Upp till 8 år |
| Skäggtrimning | 15 min | 229 kr | — |

(wavy har även "Blockera tid" 60 min/0 kr — internt blockerings-verktyg, EJ seedad.)

## Personal (4 aktiva barberare — alla utför alla 7 tjänster)
Inaktiva i wavy (EJ seedade): Mustafa, Aras, Said, David, Jacoub.

### Hilal
- Mån–Tors 09–18: 09:00 09:30 10:00 10:30 11:00 11:30 12:00 **12:45 14:15** 15:00 15:30 16:00 16:30 17:00 17:30
- Fre 09–19: 09:00–12:00 (30-steg) **12:30 14:15** 15:00–17:30 18:00 18:30
- Lör 11–18: 11:00 11:30 12:00 **12:45 14:15** 15:00–17:30

### John (jobbar EJ lördag)
- Mån–Tors 09–18: 09:00–12:30 (30-steg) **13:30**–17:30 (30-steg) [lunch 13:00–13:30]
- Fre 09–19: 09:00–12:30 **14:15** 15:00–17:30 18:00 18:30

### Ali (börjar 10:00)
- Mån/Ons/Tors 10–18: 10:00–13:00 (30-steg) **14:00**–17:30 [paus 13:30–14:00]
- Tis: samma MINUS 13:00
- Fre 10–19: 10:00–13:00 14:00–17:30 18:00 18:30
- Lör 11–18: 11:00–17:30 (rent 30-steg, ingen paus)

### Aziz (jobbar EJ lördag)
- Mån–Tors 09–18: 09:00–12:00 **12:45 13:45 14:30** 15:00–17:30
- Fre 09–19: 09:00–12:00 **12:45 14:30** 15:00–17:30 18:00 18:30

## Platser
1. **FreshCut** (primär) — Bokhållaregatan 2 — all personal + alla tider här
2. **Freshcut 2** — Testadress 2, Linköping — multi-plats-test, INGEN personal/tider ännu

## Seedat i DB (verifierat)
tenants.name=FreshCut · 2 locations · 7 services (längd/pris/beskrivning/sort_order)
· 4 staff (title=namn, alla på primär plats; gamla "Zivar"-raden återanvänd som Hilal
för FK-integritet med 2 testbokningar) · staff_services 28 · working_hours 22 ·
working_hour_slots 344 (exakta wavy-mönstren ovan) · settings: contact/opening_hours/
instagram (merge). Publika sajten + admin render-verifierade.

## Multi-plats: varför inget krockar
- Personal är **pinnad till plats** (staff.location_id + varje arbetstid/tid har location_id).
- `no_double_booking` EXCLUDE gäller **per frisör över ALLA platser** — samma frisör
  kan aldrig dubbelbokas ens om han jobbar på två platser.
- staff↔location-fence i create_public_booking: bokning på plats X kräver att
  frisören har tider på plats X.
- Freshcut 2 utan personal ⇒ inga bokbara tider där tills tider läggs på den platsen.

## Kvar till nästa körning (Zivars lista)
Hela boknings-flödet vattentätt (inga missade bokningar) · uppdateringsfrekvens ·
bekräftelse-MAILET till kunden/salongen · SMS-påminnelser (kostnad per SMS) ·
ev. innehålls-texter från freshcut.se in i Sida-copyn.
