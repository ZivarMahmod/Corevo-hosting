# TESTA DETTA — nattkörning 2026-06-02 (Zivar)

Allt nedan är byggt, tsc+eslint-rent, och **deployat live** (worker `bokningsplatformen`, *.workers.dev + booking.corevo.se + demo.corevo.se). Testa på **demo.corevo.se** (storefront) och **booking.corevo.se** (login/plattform).

## 🔐 Säkerhet (klart + verifierat)
- Migr 0009+0010 i prod: en kund kan INTE längre se/ändra andras bokningar (roll-medveten RLS), och bokningar kan inte förfalskas/bakdateras via API. AFTER-test 6/6 grönt.
- **Inget att göra** — bara bra att veta.

## 💇 Storefront — 5 stilar (huvudgrejen)
- Varje salong väljer en av **5 distinkta stilar**: Salvia (luftig/minimal), Leander (elegant/centrerad), Zigge (mörk barber), Linnea (varm/naturlig), Edit (editoriell minimal). De ser GENUINT olika ut (layout+font+form+färg), inte bara färgbyte.
- **Testa:** sätt tema per salong (admin → Varumärke, eller säg till mig). Default = Leander.
- **Namn-flagga:** handoffen döpte dem Salvia/Leander/Zigge/Linnea/Edit; din lista sa Atelier/Brass/Lera/Kontur/Blom. Jag byggde de 5 FAKTISKT designade. Vill du byta visningsnamn → trivialt, säg bara.
- Guld/accent är **tenant-överstyrbart** på storefront (din identitet), fryst i back-office.

## 📅 Bokning (inbäddad, mobil-först)
- **Variant 3 (steg-för-steg)** = default. **Variant 4 (snabbboka, kompakt)** = öppnas via "Snabbboka" eller `?boka=snabb`. Båda i drawer, bekräftelse IN-PAGE (lämnar aldrig sidan). Mobil = bottom-sheet, stora tidschips, CTA i tumläge.
- **Testa hela kedjan:** boka en SPECIFIK frisör på demo → kolla att den syns i den frisörens schema (logga in som personal) och hos salong-admin (Bokningar). Detta ska stämma hela vägen.

## 🖼️ Ägaren byter sina bilder (⭐ nytt)
- Admin → **Varumärke**: ladda upp hero-, galleri-, om-, avslutnings-bilder + team-medlemmar + statistik. Sparas per salong (R2), syns direkt på storefronten. Tomt = snygg standardbild per stil.
- **KRÄVER secret `R2_PUBLIC_BASE_URL`** på workern för att bilderna ska visas (R2-bucket finns). Utan den degraderar den snällt (felmeddelande, ingen krasch). **→ sätt den.**

## ✉️ Notiser (Wire G)
- Admin → Inställningar → "Notiser & integritet": toggla bekräftelse/påminnelse/recensions-nudge, klistra in **Google-recensions-länk** (fält, ej kod).
- **KRÄVER secret `RESEND_API_KEY`** för att riktiga mejl ska gå ut (annars no-op, loggar bara). **→ sätt den.**
- **SMS:** toggle finns (av som default), kroken är byggd men ingen leverantör inkopplad — välj leverantör + sätt `SMS_PROVIDER_API_KEY` senare, ingen omkodning.

## 🙋 Gäst utan konto
- Bekräftelse-mejlet innehåller en **avboka-länk** (säker HMAC-token). Gästen kan avboka via `/avboka/[id]?t=...` utan konto, inom salongens avboknings-fönster (inställning i admin). GET visar bara — knappen avbokar.

## 🍪 Cookie-banner
- EU-consent-banner på storefronten (Acceptera / Endast nödvändiga), av/på per salong (Inställningar → cookie-banner). Default på.

## 🛠️ Back-office (Corevo-look)
- Admin/personal/plattform omskinnade till Corevo-looken (forest+guld på cream, mörk sidebar, Playfair+Inter). Kund-`/konto` är medvetet ORÖRD (egen storefront-nära look).
- **Testa login alla roller:** admin@frisor1.se, klippare@frisor1.se, platform@corevo.se (+ kund-signup på demo om `customer_accounts_enabled` på).

## ⚙️ Secrets att sätta (workern) — utan dessa funkar bygget men vissa features är no-op
| Secret | Ger |
|---|---|
| `RESEND_API_KEY` | Riktiga mejl (bekräftelse/påminnelse/recension/avboknings-mejl) |
| `R2_PUBLIC_BASE_URL` | Visning av ägar-uppladdade bilder + logga |
| `SMS_PROVIDER_API_KEY` | (senare) SMS-notiser |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ redan satt (kundregistrering/cron/gdpr/gäst-avboka) |

## ❗ Kända luckor (ej byggt i natt — flaggat, ej blockerande för demo)
- **Multi-location-val i bokningen (2.2):** demo har 1 ställe → funkar. För salonger med FLERA ställen saknas "välj salong först"-steget + RPC tar bara primär location. Kräver migration (RPC location-param) + wizard-steg. Säg till så bygger jag.
- **Lojalitet/poäng (2.8):** toggle-mönstret finns (kund-konto togglas redan per salong), men poäng-funktionen som sådan är ej byggd (större feature).
- **5 teman pixel-finputs:** byggda pixel-nära handoffen; några stilar kan behöva visuell finjustering — kolla live och peka, så fixar jag.

## Git
Allt committat på `main`. Senaste: design-FAS4 (`ae8b66b`). Se `2-Byggplan/WAVE-3-BUILD-PLAN.md` + `NIGHT-BACKLOG.md` för fullständig logg.
