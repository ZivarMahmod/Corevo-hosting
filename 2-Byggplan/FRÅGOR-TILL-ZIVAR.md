# FRÅGOR TILL ZIVAR — frågestunden (en i taget, svara fritt)

Nörden ställer dessa när du säger till. Varje fråga: alternativ + min reko. Svaren låser beslut i FINSLIP-listan.

---

## 💸 Pengar/infra (från research-rapporterna)

**F1. Workers Paid — 48 kr/mån. Slå på nu?**
Free-planens 10 ms CPU-tak är PÅ GRÄNSEN för vår Next.js-rendering redan idag. Vid taket ser kunden en felsida.
- A) Ja, nu (Nördens reko — billigaste försäkringen som finns)
- B) Vänta tills första betalande kund

**F2. Supabase spend cap — står PÅ = tjänsten STANNAR vid tak. Stänga av?**
- A) Av nu (reko när freshcut är skarp — hellre liten faktura än död plattform)
- B) På tills fler kunder

**F3. PITR-backup (+950 kr/mån) — när?**
Idag: dagliga backups, 7 dagar. PITR = återställ till exakt sekund.
- A) Vid första externa betalande kunden (reko)
- B) Nu
- C) Vid 10+ kunder

**F4. Domän-modell för kunder — bekräfta:**
Kunden äger SIN domän (betalar ~150 kr/år själv eller via oss med påslag) och CNAME:ar till oss. corevo.se ligger kvar hos svensk registrar (CF Registrar stöder inte .se).
- A) Kunden äger sin domän, vi guidar (reko — noll domänkostnad för oss)
- B) Vi köper/administrerar åt kunden med påslag på priset

## 💳 Betal-rails

**F5. Ordning på rails?**
- A) ES-API först (kund #1 kör det, öppet API — men kunden betalar ES en API-tilläggsavgift) + Swish Företag parallellt (reko)
- B) Stripe först (snabbast online-betalning, 3DS löst)
- C) Allt samtidigt via adaptern

**F6. ES Stage 0-mejl till api@eskassa.se — får jag skicka utkast till dig för godkännande?**
- A) Ja, skriv utkastet
- B) Du ringer/mejlar själv

## 🏗️ Plattform

**F7. Din inloggsflytt — vilken subdomän?**
- A) admin.corevo.se (reko — kort, tydligt)
- B) platform.corevo.se
- C) intern.corevo.se / annat

**F8. Multi-bransch (bilverkstad) — arkitektur:**
- A) SAMMA databas, vertikal-toggles per tenant (tjänste-typer/terminologi per bransch) — reko, det ÄR uttagsprincipen
- B) Ny databas per bransch

**F9. DNS för nord/barberco/leander/zigge.corevo.se — de pekar ingenstans idag:**
- A) Ta bort ur wrangler-routes tills riktiga kunder (reko)
- B) Peka alla mot plattformen nu

**F10. Test-domänerna kvikta.se + demo.corevo.se i DomänPanelen:**
- A) Ta bort båda (reko — ren prod)
- B) Behåll demo.corevo.se för demos

## 🎨 Produkt

**F11. Reveal-on-scroll på storefront (canon säger bort, HANDOFF sa behåll):**
- A) Bort (reko — den ger "tom sida"-buggen i screenshots)
- B) Behåll

**F12. Per-location-pris:**
- A) Platt pris per tjänst räcker tills någon kund BER om det (reko)
- B) Bygg nu

**F13. Redeem-poäng (kunden använder poängen):**
- A) Efter betal-rails (poäng→rabatt kräver betalflödet) (reko)
- B) Tidigare som ren rabattkod

---

## Svarslogg
| Fråga | Svar | Datum |
|---|---|---|
| — | — | — |
