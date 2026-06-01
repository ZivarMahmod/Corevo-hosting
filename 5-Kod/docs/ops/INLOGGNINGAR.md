# Inloggningar — Corevo Booking (demo/seed)

Lösen för ALLA back-office-konton: **`Demo!1234`** (dev-seed). Byt `platform@corevo.se` innan skarp produktion.

## Back-office — booking.corevo.se
Tenant + roll kommer från det inloggade kontot (inte värden).

| Konto | Roll | Vad du ser |
|---|---|---|
| `platform@corevo.se` | super_admin (lvl 8) | Plattform-dashboard — ALLA salonger, `/salonger`, `/fakturering`. **Din panel.** |
| `admin@frisor1.se` | salon_admin (lvl 6) | Demo-salongens admin: tjänster, personal, scheman, varumärke, Stripe-koppling |
| `klippare@frisor1.se` | staff (lvl 3) | Personalvy: eget schema + frånvaro |

## Storefront — demo.corevo.se (publikt, ingen login)
EN demo-salong ("Frisör Demo"). Publik sajt + `/boka`. Kund-konton PÅ.

## Kundportal — /konto på demo.corevo.se
Ingen kund är seedad. Registrera ett färskt konto på `demo.corevo.se` → ser kundvyn (mina tider, profil, av/omboka).

## Noteringar
- De 3 back-office-kontona funkar **utan** JWT-hooken (claims inbakade i kontot). Hooken behövs först för NYA konton.
- EN demo-salong (ingen frisor1/frisor2-split). Multi-tenant-motorn står kvar i koden — vi seedar bara en.
- Kräver att appen är live på booking.corevo.se + demo.corevo.se (kör G13). LIVE — inget localhost.
