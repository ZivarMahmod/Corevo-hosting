# HANDOFF — Corevo Superadmin (ny UX)

> Till: Claude Code, i repot **ZivarMahmod/Corevo-hosting** (superbooking-portalen).
> Uppgift: implementera den nya superadmin-designen i den **befintliga** kodbasen — samma stack,
> samma datamodell, samma funktioner. Detta är en **omdesign av skalet + IA**, inte en omskrivning av logiken.

---

## 0. Vad det här är

`design/Corevo Superadmin.dc.html` är en **hi-fi designreferens i HTML** — en klickbar prototyp av hela
superadminen (alla vyer, båda temana, onboarding hela vägen). Den är **inte** produktionskod att kopiera in.
Återskapa den pixelnära i portalens befintliga miljö (Next.js App Router + Supabase + befintliga mönster).

- **Fidelity: HI-FI.** Färger, typografi, radier, avstånd och copy i filen är facit.
- `SPEC.md` = fullständig funktionsinventering per vy (vad varje knapp gör). Läs den parallellt.
- `design/Källa - Hårspa.dc.html` + `support.js` följer med bara för att prototypen ska gå att öppna
  och för att Sida-flikens inbäddade live-preview ska fungera. I produktion är previewen er riktiga
  storefront-render (iframe mot subdomänen), inte den här filen.
- All data i prototypen är mock. Verklig data kommer från era befintliga tabeller
  (`tenants`, `tenant_modules`, `audit_log`, billing, RLS via `private.tenant_id()` osv).

## 1. Informationsarkitektur — det viktigaste bytet

Sidopanelen (13 poster) ersätts av **toppnav med 5 destinationer**. Onboarding är inte längre en egen värld —
samma toppnav ligger kvar, flödet är en vy under Kunder.

| Ny destination | Innehåll | Ersätter (gamla routes) |
|---|---|---|
| **Översikt** `/` | health, KPI, kundtabell, händelser | `/` |
| **Kunder** `/kunder` | kundlista → kundkort `/kunder/[id]` → Ny kund `/kunder/ny` | `/salonger`, `/salonger/[id]`, onboarding-studion |
| **Ekonomi** `/ekonomi` | faktureringsunderlag (flöde 2) | `/fakturering` |
| **Insyn** `/insyn` | undertabbar: Slutkunder · Personal · Loggar | `/kunder` (cross-tenant), `/personal`, `/loggar` |
| **Plattform** `/plattform` | undertabbar: Branscher · Integrationer · Domäner · Roller · Inställningar | resp. gamla sidor |

Topbar höger: **⌘K-sök** (kommandopalett: kunder + destinationer) · **+ Ny kund** (accent) ·
**tema-switch** (ljust/mörkt, persistent) · avatar-meny (superbooking@corevo.se, logga ut).
Undertabbar renderas som pill-tabbar under sidrubriken — aldrig en andra sidopanel.

**Kundkortet är heligt.** Flikarna (Översikt · Tjänster · Kunder · Personal · [modulflikar] · Sida ·
Integrationer · Drift) och Sida-flikens struktur (sid-flikar + sticky live-preview) behåller exakt
den funktionalitet som finns idag. Modulflikar visas bara när modulen är live/utkast — som nu.

## 2. Designtokens

Två teman via CSS-variabler på `body[data-cvtheme]`. Ateljé Vinter-anda: varmvitt, bläck, tunna hårlinjer.

**Ljust:** `--bg #FAFAF8` · `--sf #FFFFFF` · `--sf2 #F2F2ED` · `--sf3 #E9E9E3` ·
`--ink #26261F` · `--ink2 #5A5A52` · `--ink3 #8C8C85` · `--line #ECECE6` · `--line2 #D8D8D0` ·
`--acc #26261F` · `--on-acc #FFFFFF` · `--ok #55755F` · `--warn #A8813C` · `--bad #A85248` · `--info #5F7186` ·
`--sh 0 1px 2px rgba(38,38,31,.04)` · `--sh2 0 10px 30px rgba(38,38,31,.08)`

**Mörkt:** `--bg #141412` · `--sf #1B1B18` · `--sf2 #22221E` · `--sf3 #2A2A25` ·
`--ink #EAEAE4` · `--ink2 #B4B4AA` · `--ink3 #82827A` · `--line #2A2A25` · `--line2 #3B3B34` ·
`--acc #E8E8E2` · `--on-acc #1A1A17` · `--ok #84A98F` · `--warn #C9A15F` · `--bad #C9847B` · `--info #8FA3BC`

**Accent är temamedveten** (par ljust/mörkt). Tre kuraterade toner — Bläck är default:
Bläck `#26261F/#FFF` ↔ `#E8E8E2/#1A1A17` · Skogsgrön `#1F4636/#FFF` ↔ `#8FB4A3/#10201A` ·
Djup teal `#1D5E54/#FFF` ↔ `#7FB0A6/#0E1E1B`. Tinter görs med `color-mix(in srgb, var(--x) N%, var(--sf))`.

**Typografi:** Instrument Sans (all UI) + IBM Plex Mono (slugs, koder, belopp, tider, tekniska chips).
Google Fonts, vikter 400–700. Skala: eyebrow 11px/650/ls .08em/versaler/`--ink3` · H1 26px/650/ls -.01em ·
kortrubrik 14–15px/650 · brödtext 13–13.5px/1.5–1.6 · small 11–12px · KPI-tal 30px/650 (mono för belopp).
Länkfärg = `--ink` med underline på hover; aldrig webbläsarblå.

**Form:** kort `border:1px solid var(--line); border-radius:14px; background:var(--sf); box-shadow:var(--sh)` ·
knappar/inputs radius 8–10px · pills/badges radius 99px, 11px/650, tintad bakgrund (`color-mix` 14–16%) ·
valda/aktiva val markeras med `1.5px solid var(--acc)` + svag accent-tint · focus-ring
`0 0 0 3px color-mix(in srgb, var(--acc) 25%, transparent)` · innehållsbredd max 1320px, sidopadding 24px,
kortgap 14–16px. Tabeller: header 11px versaler `--ink3`, rader 13.5px, radhöjd ~48px, hover `--sf2`,
hårlinjer `--line`, siffror högerställda i mono.

**Kontrastregler (viktiga, användarkrav):** text på tint-bakgrund använder alltid fulltonen (`--ok` osv),
aldrig samma ton som bakgrunden; `--ink3` är lägsta tillåtna textkontrast; disabled = opacity .45 + not-allowed.

## 3. Komponentbibliotek (bygg återanvändbart)

- **PageHead** — eyebrow + H1 + undertext vänster, primär/sekundär-knappar höger.
- **StatCard** — etikett (eyebrow-stil) + stort tal + fotnot; ev. SVG-sparkline (polyline, `--acc`, 12 mån).
- **PillTabs** — undertabbar; aktiv = accentfylld pill (`--acc`/`--on-acc`), inaktiv = kantlinje + `--ink2`.
- **SegmentedControl** — modul-livscykel av→utkast→live→pausad som 4 segment, **1 klick = byt state,
  ingen Spara-knapp** (optimistisk skrivning + toast). Aktivt segment fyllt med statens ton.
- **Badge** — status: Aktiv `--ok` · Pausad `--warn` · Onboarding `--info` · Live/Utkast/Av per modul.
- **Dropdown** — custom (inte native select): trigger som input, meny `--sf` + `--sh2`, bock på vald rad.
- **CommandPalette** — ⌘K: overlay, sökfält, grupperade träffar (Kunder/Sidor), piltangenter + Enter.
- **Toast** — nedre högra hörnet, `--ink`-bakgrund/`--bg`-text, auto-dismiss ~2.5s.
- **SaveBar** — sticky dirty-bar (Roller, Billing): "N ändringar · Återställ · Spara".
- **TwoStepDanger** — destruktiva knappar: klick 1 armerar ("Säker? Ta bort"), klick 2 utför; auto-avarmering.
- **HealthPill** — dot + etikett + värde; ej kopplade system visar ärligt "— · ej kopplad" i `--ink3`.
- **StepRail** — onboarding: 3 fasrubriker/6 steg, ✓ klart · ● aktivt · tomt kommande, • = obligatoriskt.
- **PreviewPane** — sticky höger: host-rad (grön dot + `slug.corevo.se` i mono), mall-badge, Ladda om,
  Öppna live ↗, Desktop/Mobil-switch (skala 1360px resp. 390px till kolumnbredd).

## 4. Beteenden som ska med

- Tema: `localStorage('cv_theme')`, default ljust; hela paletten byts via `data-cvtheme`.
- Kort/Lista-val i kundlistan persistent. Sök + filterpills (Alla/Aktiv/Pausad/Onboarding) kombineras.
- Onboarding: bransch förfyller mall + moduler + terminologi (kopia, ägs sedan av kunden); auto-slug av
  namnet (å→a osv) med manuell override; Lansera → pending-overlay → resultatvy med "Öppna & hantera
  kunden" som går RAKT till nya kundkortet. Avbryt går tillbaka till Kunder.
- Kundkort/Drift: modulaktivering är super-admin-spärrad; pausa/aktivera + mjuk 2-stegs-delete
  (build-once-never-delete); allt loggas till audit-feeden.
- CSV-exporter (kundlista, ekonomi, slutkunder, loggar) genererar riktiga filer av filtrerat set.
- Lösenordsreset kräver ägar-epost — annars ärlig inline-varning, ingen tyst no-op.
- Alla tomlägen är ärliga och har en primär åtgärd (t.ex. "Inga tjänster ännu → Lägg till tjänst").

## 5. Implementationsordning (förslag)

1. Tokens + tema-switch + topbar/skal (5 destinationer, ⌘K, avatar-meny).
2. Komponentbiblioteket (§3) som delade komponenter.
3. Översikt → Kunder (lista) → Kundkort (flik för flik, Sida sist — den är störst).
4. Onboarding i nya skalet (återanvänd StepRail + PreviewPane).
5. Ekonomi → Insyn → Plattform (mest tabeller + befintlig logik i nya kläder).
6. Städa bort sidopanelen och gamla route-namn (redirects från /salonger → /kunder).

## 6. Filer i paketet

- `README.md` — detta dokument
- `SPEC.md` — funktionsinventering per vy (facit för vad varje knapp/flik gör + mockdata-nycklar)
- `design/Corevo Superadmin.dc.html` — hi-fi-prototypen (öppna i browser; ljust/mörkt läge i topbaren)
- `design/Källa - Hårspa.dc.html`, `design/support.js` — bara för att prototypen ska rendera komplett

Fråga Zivar innan ni avviker från designen — särskilt kring kundkortet och Sida-fliken.
