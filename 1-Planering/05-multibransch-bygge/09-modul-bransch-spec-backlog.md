# 09 — Modul × Bransch: full spec + bygg-backlog (Zivars vision)

> Källa: Zivars per-bransch-spec 2026-06-17. **Detta är den kanoniska listan på ALLA moduler & branscher + byggstatus.** Syfte: inget glöms. Det som inte finns i DB än står här som namngiven backlog, inte bortappat.
> Relaterat: design-kanon `4-Dokument-Underlag/01-acceptans/`, `02-Arkitektur-sanning.md` (DB-sanning), ritning `06-sajtbyggare/02-RITNING-v3-moduler-storefront.md`.

## Status-nycklar
- ✅ **LIVE** — finns i DB (`modules`-rad + tabell). Bygg/justera mot v3 nu.
- 🔧 **VARIANT** — config på en LIVE-modul (`variant_schema` + `verticals.rules`/`terminology`). Ingen ny tabell.
- 🆕 **NY MODUL** — finns EJ i DB. Kräver **tabell + RLS + `modules`-rad**. Fas D / per riktig kund. Schema bara på Zivars go.
- 🌱 **NY BRANSCH** — en `verticals`-rad (billigt). DB har 5 live: frisör, barbershop, nagelstudio, restaurang, generell.

---

## De 7 LIVE-modulerna (finns nu)
`booking` · `shop` · `offert` · `lojalitet` · `presentkort` · `blogg` · `media_library` (infra, ingen publik yta)

## De 9 NYA modulerna (roadmap — namngivna, ej byggda)
| 🆕 Modul | Används av | DB-behov |
|---|---|---|
| Portfolio / Galleri | Tatuerare, Fotograf, Nagel | `portfolio_items` + media_assets + RLS |
| Husdjursprofil | Hundsalong | `pets` (kopplad customers) + RLS |
| Fordonsinfo | Bilverkstad | `vehicles` (kopplad customers) + RLS |
| Intag-formulär (GDPR) | Klinik | `intake_forms` (KRYPTERAD, hård RLS) + samtyckeslogg |
| Återkommande bokning | Städ, Klinik | `booking_series` (rrule) → genererar bookings |
| Orderstatus | Bilverkstad, Skräddare | `work_orders` (status) + notis (SMS/mail) |
| Depositbetalning | Tatuerare | `payments`-grind på bokning (rails pausade) |
| Meny-visning | Restaurang, Café | `menu_items` + kategorier + allergener |
| Inlämning / Konsignation | Cykel, Skräddare, Second hand | `intake_items` + kvittonr + media_assets |

> Varje 🆕 = eget avgränsat bygge (tabell+RLS+modules-rad+yta×2). Görs **per riktig kund som kräver den** (build-once), inte spekulativt allt på en gång.

---

## Per bransch (din spec, taggad med byggstatus)

**🔵 Frisör** ✅bransch — Bokning 🔧 (frisör+tjänst, korta slots) · Lojalitet ✅ (stämpel) · Presentkort ✅ · Webshop ✅ (hårvård)
**🔵 Florist** 🌱 — Webshop 🔧 (leverans/upphämtning + datum/adress) · Offert 🔧 (event/bröllop + inspo-bild) · Presentkort ✅
**🔵 Privatklinik** 🌱 — Bokning 🔧 (behandlare, 45–90 min, anteckning) · Intag-formulär 🆕 (pnr, symtom, GDPR) · Återkommande 🆕
**🔵 Bilverkstad** 🌱 — Bokning 🔧 (drop-off, ingen personal) · Fordonsinfo 🆕 (regnr/märke, sparas på profil) · Offert 🔧 (fel + bild) · Orderstatus 🆕 (mottagen→klar + notis)
**🔵 Cykelbutik** 🌱 — Bokning 🔧 (service, ingen personal) · Inlämning 🆕 (beskriv cykel/fel + kvittonr) · Webshop ✅ · Offert ✅
**🔵 Hundsalong** 🌱 — Bokning 🔧 (60–90 min, ingen personal) · Husdjursprofil 🆕 (ras/storlek/vikt/allergi) · Lojalitet ✅
**🔵 Nagelsalong** ✅bransch — Bokning 🔧 (tjänst + ev. personal) · Lojalitet ✅ · Presentkort ✅ · Portfolio 🆕 (inspo-feed)
**🔵 Tatueringsstudio** 🌱 — Bokning 🔧 (artist, session-längd, deposit-grind) · Offert 🔧 (motiv/placering + ref-bild obl.) · Deposit 🆕 · Portfolio 🆕 (filter/artist/stil)
**🔵 Café / Konditori** 🌱 — Webshop 🔧 (förbeställ tårta + hämtdatum) · Lojalitet 🔧 (poäng/köp) · Presentkort ✅ · Meny-visning 🆕
**🔵 Restaurang** ✅bransch — Bokning 🔧 (antal pers/bord, 90–120 min, ingen tjänst) · Lojalitet 🔧 (poäng) · Presentkort ✅ · Meny-visning 🆕
**🔵 Städföretag** 🌱 — Bokning 🔧 (datum, adress, access-info) · Offert 🔧 (kvm/typ/frekvens) · Återkommande 🆕
**🔵 Fotograf** 🌱 — Bokning 🔧 (shoot-typ, plats, längd) · Offert 🔧 (timmar/bilder) · Presentkort ✅ · Portfolio 🆕
**🔵 Skräddare** 🌱 — Bokning 🔧 (provning/upphämtning) · Offert 🔧 (plagg/material) · Inlämning 🆕 · Orderstatus 🆕
**🔵 Optiker** 🌱 — Bokning 🔧 (syntest, 30–45 min, ingen personal) · Webshop 🔧 (bågar + receptkoppling)
**🔵 Second hand** 🌱 — Webshop ✅ · Inlämning 🆕 (skick/önskat pris + butik godkänner)

---

## Vad det betyder för bygget (sekvens, respekterar låst A→B→C→D)
1. **Nu/snart:** de 7 LIVE byggs/justeras mot v3 (S3-trohet) + **Bokning-varianter** (🔧) via `variant_schema`/`rules` — inkl. booking-bransch-medveten (bord, drop-off, ingen-personal). Mest config, inga nya tabeller.
2. **Fas D (bredd, EFTER bevisa+stabilisera):** de **9 NYA** modulerna — en i taget, per riktig kund som kräver den. Schema bara på Zivars go.
3. **Branscher (🌱):** en `verticals`-rad styck när en kund i den branschen onboardas. Billigt.

**Inget på din lista är borttappat — allt är nu spårat här.** LIVE = bygg nu. 🔧 = config snart. 🆕 = byggs medvetet när kunden finns, aldrig glömt.
