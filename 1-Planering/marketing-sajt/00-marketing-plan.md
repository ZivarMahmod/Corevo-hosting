# Corevo — Marketing-sajt (ombyggd) — Plan

Status: PLANERING (ingen kod). Hosting: Cloudflare. Separat från boknings-plattformen.

---

## 1. Syfte & målgrupp

**Syfte:** Visa att Corevo gör MER än "AI-kylare" idag — en proffsig verkstad som bygger tekniska produkter och plattformar. Få besökaren att skicka en förfrågan.

| Besökare | Vad de vill | Vad de ska göra |
|---|---|---|
| Salong/frisör | Boknings-/varumärkeslösning | Förfrågan: frisörplattform |
| Butik/kontor/event | Parfymmaskin (doftupplevelse) | Förfrågan: parfymmaskin |
| Verksamhet med kyl-/teknikbehov | AI-kyl | Förfrågan: AI-kyl |
| Företag med egen idé | Skräddarsydd plattform byggd från grunden | Förfrågan: custom platform |
| Osäker besökare | Vet inte vad de behöver | Kör guiden "vilken tjänst passar dig" |

**Primärt mål (CTA):** skicka förfrågan. **Sekundärt:** förstå bredden i Corevos erbjudande.

---

## 2. Sajtstruktur / sitemap

```
/                      Startsida (hero + bredd + 4 tjänster + guide-CTA)
/tjanster             Översikt alla tjänster
  /tjanster/parfymmaskin
  /tjanster/ai-kyl
  /tjanster/frisorplattform     (= Corevo Booking Platform)
  /tjanster/custom-platform     (egen plattform från grunden)
/guide                "Vilken tjänst passar dig?" (frågor → rekommendation)
/kontakt              Kontakt + förfrågnings-formulär
/om                   Om Corevo / kort portfolio (valfri men rekommenderad)
```

Kundportal: INGEN egen sida ännu — visas som "coming soon"-block på startsida + /tjanster.

---

## 3. Per tjänst (rubrik, pitch, CTA)

Alla tjänstesidor samma mall: **Rubrik → kort pitch (2-3 meningar) → 3 punkter "vad du får" → CTA-knapp "Skicka förfrågan"** (skickar tjänstens namn med i formuläret).

| Tjänst | Rubrik (förslag) | Kort pitch (platshållare — Zivar finjusterar) |
|---|---|---|
| Parfymmaskin | "Doftupplevelse för din lokal" | Automatisk doftspridning för butik, kontor eller event. Stärker varumärket och upplevelsen. |
| AI-kyl | "Smart kyla med AI" | Intelligent kylning som optimerar drift och energi. Corevos ursprungsprodukt — nu en av flera. |
| Frisörplattform | "Din egen boknings­plattform" | White-label boknings-SaaS för salonger. Du äger ditt varumärke, vi sköter tekniken. |
| Custom platform | "Plattform byggd från grunden" | Har du en egen idé? Vi bygger en skräddarsydd plattform helt efter ditt behov. |

CTA på varje: **[Skicka förfrågan]** → /kontakt?tjanst=<namn> (förifyllt val).

---

## 4. Förfrågnings-flöde

**Fält (håll kort):**
- Namn *
- Företag
- E-post *
- Telefon
- Tjänst (dropdown: parfymmaskin / AI-kyl / frisörplattform / custom / vet ej) — förifylld från knapp
- Meddelande (fritext)
- (dolt) källa/sida

**Vart det landar:**
1. **E-post till Zivar** (enklast att starta med) — formulär → Cloudflare Worker/Pages Function → e-posttjänst (t.ex. Resend eller MailChannels-ersättare via API-nyckel; obs MailChannels gratis-API för Workers stängdes 2024, så använd Resend/Postmark e.d.).
2. **+ lagra i Cloudflare D1** (SQLite) eller KV som backup/lista — rekommenderas så inget tappas.

**Bekräftelse:** tack-sida/meddelande "Vi hör av oss inom X" + auto-svar-mejl till besökaren (valfritt steg 2).

**Spam-skydd:** Cloudflare Turnstile (gratis, inbyggt).

---

## 5. "Vilken tjänst passar dig"-guide

Enkel flerstegsguide (3-4 frågor) → rekommenderar 1 tjänst + CTA till förfrågan.

**Fråga 1 — Vad gäller det?**
- Salong / frisör → frisörplattform
- Fysisk lokal/upplevelse → ev. parfymmaskin
- Kyla / teknisk drift → AI-kyl
- En egen idé/produkt → custom platform
- Osäker → fråga 2

**Fråga 2 — Vill du ha en färdig lösning eller något byggt åt dig?**
- Färdig produkt → parfymmaskin / AI-kyl
- Byggt från grunden → custom platform

**Fråga 3 — Hur snart?** (kvalificering, påverkar inte rekommendation, sätter ton)

**Resultat:** "Vi rekommenderar: <Tjänst>" + kort motivering + **[Skicka förfrågan]** (förifyllt).

Bygg som ren klient-logik (ingen backend nödvändig).

---

## 6. Tas bort + Coming soon

**TA BORT helt (syns ej):**
- Shadan
- Föreningsapp
- Kvikta

**Coming soon-block** (visas snyggt, ej klickbart mål):
- **Kundportal** — "Byggs just nu" / "Under construction". Liten teaser, ingen länk.

---

## 7. Teknik-förslag (Cloudflare)

**Rekommendation: Astro (statiskt/SSG) på Cloudflare Workers (Static Assets).**

Viktigt (verifierat mot Cloudflare-dokumentationen 2026): Cloudflare rekommenderar nu **Workers med Static Assets** för ALLA nya projekt — statiska sajter, SPA och full-stack. Pages funkar fortfarande men nya features fokuseras på Workers. Därför: bygg på **Workers**, inte Pages.

Motiv:
- Sajten är marknadsföring + ett formulär — inget tungt app-state. Statiskt = snabbast, billigast, enklast att underhålla.
- Astro ger snygga sidor med minimal JS; guiden + formuläret körs som små "islands".
- Workers Static Assets: gratis, auto-deploy från Git, och samma Worker kan ha en liten `/api`-endpoint för formuläret (en `main` + `ASSETS`-binding). Inga separata Pages Functions behövs.

**Alternativ:** Next.js. Funkar på Cloudflare via **OpenNext (`@opennextjs/cloudflare`)** på Workers (`npm create cloudflare@latest -- --framework=next`). Välj detta BARA om Zivar redan kan Next.js eller vill dela kod med boknings-plattformen. För en marknadsföringssajt är det overkill — Astro är enklare och snabbare.

**Formhantering:** Worker-endpoint (`/api/inquiry`) tar emot POST → validerar → skickar mejl via Resend/Postmark API → skriver rad i **D1**. Turnstile för spam.
Obs: MailChannels gratis-API för Workers stängdes 2024 — använd Resend eller Postmark (API-nyckel som secret i Worker).

**Lagring av förfrågningar:** Cloudflare **D1** (gratis SQLite, en tabell `inquiries`). Mejl är primär notis, D1 är facit.

| Lager | Val |
|---|---|
| Framework | Astro (SSG) |
| Hosting | Cloudflare Workers (Static Assets) |
| Form-endpoint | Worker `/api`-route (samma Worker) |
| E-post | Resend eller Postmark (API) |
| DB | Cloudflare D1 |
| Spam | Cloudflare Turnstile |
| Domän | via Cloudflare DNS |

---

## 8. Öppna frågor — Zivar fyller i (max 6)

1. **Texter per tjänst** — godkänn/justera pitch + "vad du får"-punkter (4 tjänster).
2. **Bilder** — produktbilder (parfymmaskin, AI-kyl) + ev. skärmdumpar av plattformarna.
3. **Priser** — ska pris/"från X kr" visas, eller bara "begär offert"?
4. **E-post** — vilken adress ska förfrågningar gå till? (zivar68@gmail.com eller företagsmejl?)
5. **Domän** — vilken domän ska användas (befintlig corevo-domän?).
6. **Om/portfolio** — vill du ha en om-sida med din historia + referenser, eller hoppa över i v1?
