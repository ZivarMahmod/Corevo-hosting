# ERPNext self-hostad = eget system ("vår egen Fortnox") — LÅST 2026-07-07

> Beslut (Zivar, efter full audit + flera ronder): **Riktiga ERPNext, self-hostad på Zivars EGEN hårdvara, som ett EGET separat system.** Vi använder ERPNext:s UI och tar ALLT som behövs därifrån. Nuvarande Corevo (Next/Supabase/Workers — storefront, booking, super-admin) **lämnas ORÖRT** — vi adderar inget där (skapar kaos). ERPNext är sin egen värld bredvid.

## Förkastade riktningar (looppa INTE tillbaka)
- ❌ ERPNext på Supabase/Postgres — tekniskt omöjligt (kräver superuser/CREATE DATABASE + MariaDB-först). Löst: ERPNext är separat → egen MariaDB på Zivars burk. Corevo behåller Supabase.
- ❌ Bygga om bokföringen i vår Next/Supabase-stack (Väg 1) — Zivar ångrade: "adderar inget, skapar kaos i hosting-systemet."
- ❌ ERPNext som apex ÖVER Corevo / merga in Corevo i ERPNext. De lever separat.
- ✅ Kärnkrav genom allt: **OBEROENDE** (self-hostad, i Zivars händer, inga moln-avgifter) + **ERPNext:s riktiga UI + funktioner** + **rör inte nuvarande Corevo.**

## Målbild
- **Riktiga ERPNext v15 (stable, ej forkens `develop`-nightly)**, self-hostad via `frappe_docker` på Zivars hårdvara (dev: PC via Docker Desktop/WSL2 — WSL2 finns redan, Ubuntu-22.04).
- **MariaDB** (ERPNext-ägd, på samma burk). **Redis + workers + scheduler + socketio + nginx** = standard Frappe-stacken (Docker sköter det).
- **Åtkomst:** Cloudflare Tunnel (vi äger corevo.se på Cloudflare) → t.ex. `erp.corevo.se`, inga öppna portar.
- **UI = ERPNext:s egen** (Desk för back-office). Vi tar allt vi behöver: bokföring, fakturor, POS, lojalitet, kunder, artiklar/tjänster, lager, moms.
- **Våra tillägg** (senare): EN egen Frappe-app `corevo` ovanpå (aldrig forka kärnan → `bench update` funkar) för booking-modul + svensk lokalisering (BAS/moms/SIE/ROT-RUT). Fortnox-kunskaps-mappen matar det.

## Faser (inget rivs; ERPNext byggs upp separat)
- **Fas 0 — Stå upp lokalt (NU):** Docker Desktop på Zivars PC → `frappe_docker` i WSL-filsystemet (INTE ö-path/OneDrive) → ERPNext v15 + en site (`erp.localhost`) uppe. Zivar loggar in i Desk-UI:t. Bevisa: skapa en kund + en tjänst + en faktura.
- **Fas 1 — Svensk grund:** ladda BAS-kontoplan, sätt svensk moms, konfigurera företaget (Company). Prova en riktig faktura med moms + se GL/balans/resultat.
- **Fas 2 — Egen `corevo`-app:** booking-doctypes (Service/Staff/Booking) + Workspace som städar Desk-navet för salong.
- **Fas 3 — Prod:** Cloudflare Tunnel-exponering; om alltid-på behövs → dedikerad burk hos Zivar. Backups (`bench backup`) → R2.
- **Fas 4 — Svensk lokalisering fullt:** momsdeklaration, SIE-export, ROT/RUT, bank-import (porta erpnext_sweden-idéer).

## Var det bor (filer/repo)
- ERPNext + `frappe_docker` + `corevo`-appen = EGET repo/mapp i **WSL-filsystemet** (`~/frappe`), separat från detta Corevo-repo. Detta repo (`firsör-sas`) rör vi inte för ERPNext-arbetet.
- Planering/beslut om ERPNext = denna mapp (`1-Planering/07-erpnext-apex/`).

## Nästa konkreta steg
1. **Docker Desktop installeras** på Zivars PC (winget eller manuellt) — förutsättning, saknas nu.
2. Claude klonar `frappe_docker` i WSL, drar upp ERPNext v15 + site, verifierar Desk-UI nåbart.
3. Zivar loggar in, vi börjar "ta allt som behövs."
