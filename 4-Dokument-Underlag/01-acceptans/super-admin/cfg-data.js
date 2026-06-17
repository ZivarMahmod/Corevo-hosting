/* =====================================================================
   COREVO ONBOARDING STUDIO — DATA SPINE (arkitektur-hjärtat)
   ---------------------------------------------------------------------
   Detta är INTE bara prototyp-data. Det är den kanoniska kartan som Code
   bygger emot: vilka branscher som finns, vilka moduler de får, hur varje
   modul skiljer sig per bransch, och exakt vilka DB-tabeller + vad som
   måste byggas för att modulen ska funka på riktigt.

   Källor (1-Planering/):
     00-modulkarta.md · 01-arkitektur/01-DB-schema.md · 04-domanstrategi.md
     02-floden/02-onboarding-flode.md · 06-sajtbyggare/00-DESIGN-sajtbyggare.md
   Allt mappar mot riktiga tabeller: tenants · tenant_settings ·
   tenant_domains · tenant_modules · modules · services · bookings ·
   customers · customer_loyalty_* · media_assets m.fl.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. STOREFRONT-TEMAN (speglar colors_and_type.css [data-theme])
   De 5 byggda React-temana. Varje tenant väljer ETT → tenant_settings.branding.
   --------------------------------------------------------------------- */
const ST_THEMES = {
  Salvia:  { label: "Studio Salvia", primary: "#5E7361", primaryD: "#44543F", bg: "#F6F4EE", surface: "#FFFFFF", fg: "#232520", fg2: "#5C5F55", line: "#E2DED2", display: "'Cormorant Garamond', Georgia, serif", body: "'Jost','Inter',sans-serif", radius: 10, caps: false, vibe: "Lugn · luftig · minimal" },
  Leander: { label: "Maison Leander", primary: "#7E6E92", primaryD: "#5A4C6E", bg: "#FBFAF8", surface: "#FFFFFF", fg: "#2A2630", fg2: "#6A6472", line: "#ECE7EF", display: "'Playfair Display', Georgia, serif", body: "'Inter',system-ui,sans-serif", radius: 14, caps: false, vibe: "Romantisk · editorial" },
  Zigge:   { label: "Zigge", primary: "#C8743C", primaryD: "#A65B29", bg: "#14120E", surface: "#1E1B16", fg: "#F2ECE2", fg2: "#B3A998", line: "#322C24", display: "'Bebas Neue','Archivo',sans-serif", body: "'Archivo','Inter',sans-serif", radius: 4, caps: true, vibe: "Mörk · rå · barber" },
  Linnea:  { label: "Salong Linnea", primary: "#B0693F", primaryD: "#8E5230", bg: "#F4EDE1", surface: "#FFFFFF", fg: "#2E2820", fg2: "#6E6452", line: "#E3D9C8", display: "'DM Serif Display', Georgia, serif", body: "'Inter',system-ui,sans-serif", radius: 12, caps: false, vibe: "Varm · skandinavisk" },
  Edit:    { label: "Edit", primary: "#3A3733", primaryD: "#1F1D1A", bg: "#F8F6F1", surface: "#FFFFFF", fg: "#232220", fg2: "#6B675F", line: "#E5E0D6", display: "'Cormorant Garamond', Georgia, serif", body: "'Inter',system-ui,sans-serif", radius: 2, caps: false, vibe: "Elegant · editorial minimal" },
  Bohem:   { label: "Atelier Bohem", primary: "#BE7A56", primaryD: "#9C5F3F", bg: "#F6ECDF", surface: "#FFFCF7", fg: "#3B342B", fg2: "#7C6F5E", line: "#E8DAC6", display: "'Marcellus', Georgia, serif", body: "'Mulish','Inter',sans-serif", radius: 20, caps: false, vibe: "Mjuk · boho · florist", accentSoft: "#E9D8C2", sage: "#8B9A7B" },
};

/* ---------------------------------------------------------------------
   2. MODUL-REGISTER (tabellen `modules` + livscykel i `tenant_modules.state`)
   Livscykel per tenant: off → draft → live → paused
   Varje modul = en dynamisk React-sektion (RIKTIG DB-data), INTE statisk HTML.
   `variants{}` = hur modulen ändras per bransch (det du listade).
   `live:true`  = finns på riktigt i DB-tabellen `modules` idag (7 st) — BYGG NU.
   `live:false` = ROADMAP. Visar avsikt, har ingen rad i `modules` + ingen tabell
                  än. Behåll i studion (märkt 'Roadmap'), men deploya inte som
                  valbar förrän den seedas (se 02-Arkitektur-sanning §7). Radera INTE.
   --------------------------------------------------------------------- */
const MODULES = {
  booking: {
    key: "booking", name: "Bokning", icon: "calendar", infra: false, defaultPos: "main", core: false, live: true,
    short: "Kärnan. Boka tid: välj tjänst → tid → bekräftelse.",
    tables: ["bookings", "services", "staff", "staff_services", "working_hours", "time_off", "slot_holds"],
    build: "Bokningsmotor: lediga-tider-sökning (index bookings(barber_id,starts_at)), EXCLUDE-constraint no_double_booking (btree_gist) hindrar dubbelbokning. RSC-sektion läser services+barber_schedules, skriver bookings. payment_status = unpaid/pay_on_site.",
    why: "Alltid live om inget annat sägs (tenant_modules default booking:live). Utan den finns ingen produkt.",
    variants: {
      frisor:      "Personal-val (barber_id) · tjänstetyp (service.category) · kortare tidsslots (duration_min 20–45).",
      klinik:      "Behandlare istället för frisör · behandlingstyp · längre slots (45–90 min) · journalanteckning (bookings.comment, krypterad).",
      bilverkstad: "Drop-off-tid istället för exakt slot · fordonsinfo kopplad (modul fordon) · ingen personal-val.",
      hund:        "Hundstorlek styr slot-längd · ras kopplad till husdjursprofil (modul husdjur).",
      tatuering:   "Artist-val (barber_id som artist) · session-längd · deposit KRÄVS före bekräftelse (modul deposit grindar status).",
      restaurang:  "Antal personer (party_size) istället för tjänst · INGA personalval · längre slots · ingen tjänstetyp.",
      stad:        "Adress (bookings.comment/address) · återkommande-flagga (modul recurring) · access-info.",
      fotograf:    "Shoot-typ (service.category) · plats (on-location vs studio) · längd.",
      skraddare:   "Provning ELLER upphämtning (två slot-typer) · plagg-koppling (modul inlamning).",
      cykel:       "Service-typ · inlämning kopplad (modul inlamning) · ingen personal-val.",
      optiker:     "Syntest-bokning · ingen personal-val · fast slot-längd.",
      nagel:       "Personal-val · tjänstetyp · kortare slots — som frisör.",
      florist:     "(Bokning sällan primär — florister kör shop/offert. Kan vara konsultation.)",
      lassmed:     "Utryckning vs bokad tid · adress · brådska-flagga.",
      cafe:        "(Bordbokning valfri — annars meny+shop primärt.)",
      secondhand:  "(Bokning sällan — inlämningstid via modul inlamning.)",
    },
  },
  shop: {
    key: "shop", name: "Webshop", icon: "bookmark", infra: false, defaultPos: "main", live: true,
    short: "Produkter till salu (frakt/upphämtning). Betal-rails PAUSADE (beslut 14.2) — visar produkter, tar inga pengar än.",
    tables: ["shop_products", "shop_orders", "shop_order_items"],
    build: "Produktgrid + produktsida + varukorg. Checkout-UI finns men betalning är avstängd (Stripe-rails pausade). orders skapas som 'draft'. Bilder från media_assets (R2).",
    why: "Aktiveras per tenant (tenant_modules shop:draft/live). Default off.",
    variants: {
      florist:    "Leverans/upphämtning: datum + adress vid köp. Säsongs-buketter.",
      cykel:      "Standard produktshop (delar, tillbehör).",
      cafe:       "Förbeställning · tårtor (beställ X dagar innan, hämtdatum).",
      optiker:    "Bågbeställning · receptkoppling (kund laddar upp recept).",
      secondhand: "Unika varor (lager = 1) · inlämnings-koppling (modul inlamning ger varorna).",
    },
  },
  offert: {
    key: "offert", name: "Offert", icon: "message", infra: false, defaultPos: "main", live: true,
    short: "'Begär offert'-formulär. Kund skickar förfrågan, salongen svarar (mål 2 dagar). Inga pengar.",
    tables: ["offert_requests"],
    build: "Dynamiskt formulär (fält per bransch, se variants) → quote_requests-rad → salongen svarar i admin (M6). Statuskedja: ny → besvarad → accepterad/avböjd. Filuppladdning → media_assets.",
    why: "För branscher där pris inte är fast. Default off.",
    variants: {
      florist:    "Storbeställning · bröllop/event (datum, antal gäster, stil, budget).",
      bilverkstad:"Servicetyp · fordonsinfo (modul fordon ger regnr/märke).",
      cykel:      "Standard offertformulär.",
      tatuering:  "Storlek · placering · referensbild-upload (media_assets).",
      stad:       "Yta (kvm) · frekvens · typ av städning.",
      fotograf:   "Typ av shoot · antal timmar · plats.",
      skraddare:  "Plaggtyp · material · ändring eller nytt.",
    },
  },
  lojalitet: {
    key: "lojalitet", name: "Lojalitet / Stammis", icon: "heart", infra: false, defaultPos: "main", live: true,
    short: "'Bli stammis' — poäng/stämpel. Lockar återkommande kunder.",
    tables: ["loyalty_ledger"],
    build: "Konto per kund (customer_loyalty_accounts.points_balance). Varje completad bokning/köp → loyalty_transaction (delta). Stämpelkort = transaktioner räknas till mål. Visar progress på storefront + kundportal.",
    why: "Default off. Aktiveras tenant_modules lojalitet:live.",
    variants: {
      frisor:     "Stämpelkort per besök (mål 10 besök → belöning).",
      nagel:      "Stämpelkort per besök.",
      hund:       "Stämpelkort per besök.",
      cafe:       "Poäng per köp — KOPPLAD till webshop (köp ger poäng).",
      restaurang: "Poäng per besök/belopp.",
    },
  },
  presentkort: {
    key: "presentkort", name: "Presentkort", icon: "gift", infra: false, defaultPos: "main", live: true,
    short: "Köp digitalt presentkort (t.ex. 200/500/1000 kr). Betal-rails PAUSADE än.",
    tables: ["gift_cards"],
    build: "Köp-UI (belopp/design) → gift_cards-rad med unik kod + saldo. Inlösen drar från saldo vid bokning/köp. Betalning pausad → kortet skapas men debiteras ej än.",
    why: "Default off. Standard-flöde i alla branscher som kör det.",
    variants: {
      frisor: "Standard.", nagel: "Standard.", florist: "Standard.",
      cafe: "Standard.", restaurang: "Standard.", fotograf: "Standard.",
    },
  },
  blogg: {
    key: "blogg", name: "Blogg / Nyheter", icon: "edit", infra: false, defaultPos: "main", live: true,
    short: "Inläggs-feed (grid, 6/sida). Nyheter/artiklar från salongen.",
    tables: ["blog_posts", "media_assets"],
    build: "CRUD i admin → news_posts (title, body, published, published_at). Storefront renderar publicerade i grid. Bild per inlägg från media_assets.",
    why: "Default off. SEO + engagemang.",
    variants: {},
  },
  portfolio: {
    key: "portfolio", name: "Portfolio / Galleri", icon: "grid", infra: false, defaultPos: "main", live: false,
    short: "Bildgalleri av utfört arbete. Filtrerbart.",
    tables: ["portfolio_items (ny)", "media_assets"],
    build: "Galleri-grid från media_assets + portfolio_items (tagg/kategori/artist). Filter-UI. Lightbox.",
    why: "Default off. Visuellt drivna branscher.",
    variants: {
      tatuering: "Artist-filtrering + stil-tagg (per barber_id + tags).",
      fotograf:  "Shoot-typ-kategorier.",
      nagel:     "Inspirationsfeed (enklare, ingen filtrering).",
    },
  },
  husdjur: {
    key: "husdjur", name: "Husdjursprofil", icon: "heart", infra: false, defaultPos: "konto", live: false,
    short: "Profil per husdjur kopplad till kund. Datafält bokningen läser.",
    tables: ["pets (ny)", "customers"],
    build: "pets-tabell (customer_id, namn, ras, vikt, allergier, anteckningar). Bokning (hund) läser pet för slot-längd. Visas i kundportal.",
    why: "Default off. Driver hundsalongens bokning.",
    variants: { hund: "Ras · vikt · allergier · anteckningar — styr bokningens slot-längd." },
  },
  fordon: {
    key: "fordon", name: "Fordonsinfo", icon: "settings", infra: false, defaultPos: "konto", live: false,
    short: "Fordonsprofil kopplad till kund/bokning.",
    tables: ["vehicles (ny)", "customers"],
    build: "vehicles-tabell (customer_id, regnr, märke, modell, årsmodell, anteckningar). Bokning/offert (bilverkstad) kopplar fordon. Regnr-validering.",
    why: "Default off. Driver bilverkstadens bokning + offert.",
    variants: { bilverkstad: "Regnr · märke · modell · årsmodell · anteckningar." },
  },
  intag: {
    key: "intag", name: "Intag-formulär (GDPR)", icon: "shield", infra: false, defaultPos: "konto", live: false,
    short: "Strukturerat intag före behandling, med samtycke.",
    tables: ["intake_forms (ny)", "customer_profiles"],
    build: "Formulär (personnummer, symtom, anamnes) → intake_forms (KRYPTERAD, RLS hårt scopad). GDPR-samtycke loggas (customer_profiles.marketing_consent + audit_logs). Endast behandlare ser.",
    why: "Default off. KÄNSLIG DATA — kräver extra RLS + kryptering.",
    variants: { klinik: "Personnummer · symtom · GDPR-samtycke (loggas i audit_logs)." },
  },
  recurring: {
    key: "recurring", name: "Återkommande bokning", icon: "repeat", infra: false, defaultPos: "main", live: false,
    short: "Bokning som upprepas (vecka/månad).",
    tables: ["booking_series (ny)", "bookings"],
    build: "booking_series (regel: rrule/intervall) → genererar bookings framåt. Kund kan pausa/avsluta serien. Visas som serie i admin.",
    why: "Default off. Påslag på bokningsmodulen.",
    variants: {
      stad:   "Veckovis / varannan vecka / månadsvis.",
      klinik: "Fast tid varje vecka/månad (behandlingsserie).",
    },
  },
  orderstatus: {
    key: "orderstatus", name: "Orderstatus", icon: "checkCircle", infra: false, defaultPos: "konto", live: false,
    short: "Statusspårning av inlämnat arbete.",
    tables: ["work_orders (ny)", "bookings"],
    build: "work_orders (status: mottagen → under_arbete → klar_för_hämtning) kopplad till bokning/inlämning. Kund ser status i portal + ev. SMS vid statusbyte (46elks).",
    why: "Default off. Påslag för verkstad/skräddare.",
    variants: {
      bilverkstad: "Mottagen → under arbete → klar för hämtning.",
      skraddare:   "Mottagen → under arbete → klar för hämtning.",
    },
  },
  deposit: {
    key: "deposit", name: "Depositbetalning", icon: "creditCard", infra: false, defaultPos: "main", live: false,
    short: "Förskott som grindar bokningen. (Betal-rails pausade — UI klart, debitering senare.)",
    tables: ["payments", "bookings"],
    build: "Vid bokning: kräv deposit (fast belopp ELLER % av offert) → payment (mode online) → bookings.status='booked' först när deposit betald. Stripe pausad → grind simuleras nu.",
    why: "Default off. Skyddar mot no-show (tatuering).",
    variants: { tatuering: "Fast belopp eller % av offert · betalas vid bokning, annars ingen bekräftelse." },
  },
  meny: {
    key: "meny", name: "Meny-visning", icon: "menu", infra: false, defaultPos: "main", live: false,
    short: "Visningsmeny — inga köp. Kategorier + allergener.",
    tables: ["menu_categories (ny)", "menu_items (ny)"],
    build: "menu_items (namn, pris, beskrivning, allergener[], kategori, dagens-flagga). Storefront renderar per kategori. Ingen kassa — ren visning.",
    why: "Default off. Restaurang/café.",
    variants: {
      restaurang: "Kategorier · allergener · INGA köp.",
      cafe:       "Kategorier · dagens-flagga.",
    },
  },
  inlamning: {
    key: "inlamning", name: "Inlämning / Konsignation", icon: "upload", infra: false, defaultPos: "main", live: false,
    short: "Lämna in vara för arbete/försäljning.",
    tables: ["intake_items (ny)", "media_assets", "work_orders (ny)"],
    build: "Inlämningsformulär (beskrivning, bilder, datum) → intake_item → kopplas till work_order (status) eller shop (konsignation). Bilder → media_assets.",
    why: "Default off. Verkstad/skräddare/second hand.",
    variants: {
      cykel:      "Beskrivning av cykel · felbeskrivning · datum.",
      skraddare:  "Plaggbeskrivning · önskad färdigdatum.",
      secondhand: "Produktbeskrivning · skick · önskat pris (→ konsignation i shop).",
    },
  },
  media_library: {
    key: "media_library", name: "Bildbibliotek", icon: "layers", infra: true, defaultPos: null, live: true,
    short: "INFRA — ingen sektion på sajten. Tenantens bildarkiv (500 MB kvot) som övriga moduler + sajtbyggaren hämtar från.",
    tables: ["media_assets"],
    build: "Uppladdning → Cloudflare R2 (bucket corevo-media) → media_assets (r2_key, url, type, alt, size_bytes). Auto-optimering (sharp/Cloudflare Images). Kvot-koll 500 MB/tenant.",
    why: "Alltid tillgänglig som infrastruktur. Ingen storefront-sektion.",
    variants: {},
  },
};

/* ---------------------------------------------------------------------
   3. BRANSCHER (verticals) — multibransch-motorn.
   EN kodbas. Bransch = config + terminologi + rekommenderade moduler.
   `rec` = moduler som föraktiveras (draft) · `opt` = erbjuds som tillägg.
   `terms` = ordbyte i UI (frisör→behandlare osv).
   --------------------------------------------------------------------- */
const BRANCHES = {
  generell:   { live: true, name: "Generell / egen mall", icon: "layers", theme: "Edit", variant: "wizard", staffWord: "Personal", serviceWord: "Tjänst",
                hero: "Välkommen.", eyebrow: "Boka online", tagline: "Boka tid, handla och håll kontakten — allt på ett ställe.",
                services: ["Tjänst 30 min", "Tjänst 60 min", "Konsultation"], rec: ["booking"], opt: ["shop", "offert", "lojalitet", "presentkort", "blogg", "portfolio", "meny", "recurring", "orderstatus", "deposit", "inlamning", "husdjur", "fordon", "intag"] },
  frisor:     { live: true, name: "Frisörsalong", icon: "scissors", theme: "Salvia", variant: "wizard", staffWord: "Frisör", serviceWord: "Behandling",
                hero: "Skarpt klippt. Skönt mottagen.", eyebrow: "Frisörsalong", tagline: "En lugn salong där varje klippning får ta sin tid.",
                services: ["Klippning", "Färg & slingor", "Styling", "Skägg"], rec: ["booking", "lojalitet", "presentkort"], opt: ["blogg", "shop", "portfolio"] },
  florist:    { live: false, name: "Florist", icon: "heart", theme: "Linnea", variant: "inline", staffWord: "Florist", serviceWord: "Arrangemang",
                hero: "Blommor med själ.", eyebrow: "Blomsterhandel", tagline: "Säsongens vackraste buketter, bundna för hand.",
                services: ["Buketter", "Bröllop", "Begravning", "Prenumeration"], rec: ["shop", "offert", "presentkort"], opt: ["booking", "blogg"] },
  klinik:     { live: false, name: "Privatklinik", icon: "shield", theme: "Edit", variant: "wizard", staffWord: "Behandlare", serviceWord: "Behandling",
                hero: "Vård med omtanke.", eyebrow: "Naprapat · Kiropraktor · Psykolog", tagline: "Legitimerade behandlare, trygg och diskret miljö.",
                services: ["Naprapati", "Kiropraktik", "Massage", "Samtal"], rec: ["booking", "intag", "recurring"], opt: ["presentkort", "lojalitet"] },
  bilverkstad:{ live: false, name: "Bilverkstad", icon: "settings", theme: "Edit", variant: "drawer", staffWord: "Mekaniker", serviceWord: "Servicetyp",
                hero: "Din bil i trygga händer.", eyebrow: "Bilverkstad", tagline: "Service, reparation och däckskifte — boka enkelt online.",
                services: ["Service", "Däckskifte", "Reparation", "Besiktning"], rec: ["booking", "fordon", "offert", "orderstatus"], opt: ["shop"] },
  cykel:      { live: false, name: "Cykelbutik", icon: "repeat", theme: "Linnea", variant: "drawer", staffWord: "Mekaniker", serviceWord: "Servicetyp",
                hero: "Rulla vidare.", eyebrow: "Cykel & service", tagline: "Försäljning, service och reparation under ett tak.",
                services: ["Cykelservice", "Punktering", "Växeljustering", "Försäljning"], rec: ["shop", "booking", "inlamning", "offert"], opt: ["orderstatus"] },
  hund:       { live: false, name: "Hundsalong / Grooming", icon: "heart", theme: "Salvia", variant: "wizard", staffWord: "Groomer", serviceWord: "Behandling",
                hero: "Putsad nos, glad svans.", eyebrow: "Hundsalong", tagline: "Trim, bad och pälsvård för alla raser.",
                services: ["Trim", "Bad & borste", "Klovård", "Helkur"], rec: ["booking", "husdjur", "lojalitet"], opt: ["presentkort", "shop"] },
  nagel:      { live: true, name: "Nagelsalong", icon: "sparkle", theme: "Leander", variant: "wizard", staffWord: "Nagelterapeut", serviceWord: "Behandling",
                hero: "Naglar som sitter.", eyebrow: "Nagelsalong", tagline: "Manikyr, gelé och nail art med precision.",
                services: ["Manikyr", "Gelénaglar", "Nail art", "Pedikyr"], rec: ["booking", "lojalitet", "portfolio"], opt: ["presentkort", "shop"] },
  tatuering:  { live: false, name: "Tatueringsstudio", icon: "edit", theme: "Zigge", variant: "wizard", staffWord: "Artist", serviceWord: "Stil",
                hero: "Bläck som betyder något.", eyebrow: "Tattoo studio", tagline: "Boka konsultation med din artist. Deposit säkrar tiden.",
                services: ["Konsultation", "Liten tatuering", "Större motiv", "Cover-up"], rec: ["booking", "deposit", "portfolio", "offert"], opt: ["presentkort"] },
  optiker:    { live: false, name: "Optiker", icon: "eye", theme: "Edit", variant: "wizard", staffWord: "Optiker", serviceWord: "Undersökning",
                hero: "Se skarpare.", eyebrow: "Optiker", tagline: "Synundersökning och bågar för varje ansikte.",
                services: ["Synundersökning", "Linsanpassning", "Bågval"], rec: ["booking", "shop"], opt: ["offert", "presentkort"] },
  cafe:       { live: false, name: "Café / Konditori", icon: "coffee", theme: "Linnea", variant: "inline", staffWord: "Personal", serviceWord: "Produkt",
                hero: "Doften av nybakat.", eyebrow: "Café & konditori", tagline: "Fika, tårtor och förbeställning till fest.",
                services: ["Fikabröd", "Tårtor", "Lunch", "Catering"], rec: ["meny", "shop", "lojalitet"], opt: ["presentkort", "blogg"] },
  skraddare:  { live: false, name: "Skräddare / Ändringsateljé", icon: "scissors", theme: "Edit", variant: "drawer", staffWord: "Skräddare", serviceWord: "Tjänst",
                hero: "Sömlöst sytt.", eyebrow: "Skrädderi", tagline: "Ändringar och måttsöm med hantverkets precision.",
                services: ["Uppläggning", "Ändring", "Måttsöm", "Lagning"], rec: ["booking", "inlamning", "offert", "orderstatus"], opt: ["presentkort"] },
  lassmed:    { live: false, name: "Låssmed", icon: "shield", theme: "Edit", variant: "compact", staffWord: "Låssmed", serviceWord: "Tjänst",
                hero: "Alltid in igen.", eyebrow: "Låssmed", tagline: "Akut öppning, låsbyte och nyckeltillverkning.",
                services: ["Akut öppning", "Låsbyte", "Nyckel", "Säkerhetsdörr"], rec: ["booking", "offert"], opt: ["shop"] },
  fotograf:   { live: false, name: "Fotograf / Fotostudio", icon: "eye", theme: "Edit", variant: "inline", staffWord: "Fotograf", serviceWord: "Shoot-typ",
                hero: "Ögonblick som stannar.", eyebrow: "Fotostudio", tagline: "Porträtt, bröllop och produkt — bokas online.",
                services: ["Porträtt", "Bröllop", "Familj", "Produkt"], rec: ["booking", "offert", "portfolio", "presentkort"], opt: ["blogg"] },
  secondhand: { live: false, name: "Second hand", icon: "bookmark", theme: "Linnea", variant: "inline", staffWord: "Personal", serviceWord: "Vara",
                hero: "Nytt liv, gammal själ.", eyebrow: "Second hand", tagline: "Utvalda begagnade fynd — lämna in och fynda.",
                services: ["Kläder", "Möbler", "Inredning", "Inlämning"], rec: ["shop", "inlamning"], opt: ["blogg", "lojalitet"] },
  stad:       { live: false, name: "Städföretag", icon: "sparkle", theme: "Salvia", variant: "drawer", staffWord: "Städare", serviceWord: "Städtyp",
                hero: "Rent. Punkt.", eyebrow: "Städtjänster", tagline: "Hemstäd, flyttstäd och kontor — återkommande eller enstaka.",
                services: ["Hemstäd", "Flyttstäd", "Kontorsstäd", "Fönsterputs"], rec: ["booking", "recurring", "offert"], opt: ["lojalitet"] },
  restaurang: { live: true, name: "Restaurang", icon: "coffee", theme: "Zigge", variant: "inline", staffWord: "Personal", serviceWord: "Bord",
                hero: "Boka bord. Bara att komma.", eyebrow: "Restaurang", tagline: "Smaker värda att återvända till.",
                services: ["Lunch", "Middag", "Avsmakning", "Privat sällskap"], rec: ["booking", "meny", "lojalitet"], opt: ["presentkort", "blogg"] },
};

/* ---------------------------------------------------------------------
   4. BOKNINGSVARIANTER (kopplar M3 · design booking-variants/*)
   --------------------------------------------------------------------- */
const BOOKING_VARIANTS = [
  { id: "wizard",  name: "Steg-för-steg", tag: "Standard", rec: true,  desc: "En sak per skärm, störst träffyta. Bäst på mobil (99 % av bokningar)." },
  { id: "compact", name: "Snabbboka",     tag: "Genväg",   rec: false, desc: "Kompakt — för stamkunder som vet vad de vill." },
  { id: "drawer",  name: "Drawer",        tag: "Desktop",  rec: false, desc: "Bokningen glider in 'inuti' sidan. Snyggast på desktop." },
  { id: "inline",  name: "Inline-sektion",tag: "Native",   rec: false, desc: "Scrollar in i sidan, allt staplat i ett svep." },
];

/* ---------------------------------------------------------------------
   5. ONBOARDING-FASER & STEG (most important first → skippable last)
   Speglar onboarding-flode.md (steg 1–6) men uppdelat finkornigt så Zivar
   klarar mest möjligt i verktyget. `req` = krävs för att kunna lansera.
   --------------------------------------------------------------------- */
const PHASES = [
  { id: "grund", name: "Grunden", sub: "Det som måste sitta först",
    steps: [
      { id: "branch",  label: "Bransch",            icon: "building", req: true,  hint: "Styr moduler, ord & innehåll" },
      { id: "namn",    label: "Namn & subdomän",    icon: "link",     req: true,  hint: "tenants.slug → <slug>.corevo.se" },
      { id: "tema",    label: "Temamall",           icon: "palette",  req: true,  hint: "Ett av 6 byggda teman" },
    ] },
  { id: "moduler", name: "Moduler", sub: "Det som gör sidan till deras",
    steps: [
      { id: "modval",  label: "Välj moduler",       icon: "layers",   req: false, hint: "Föraktiverade per bransch" },
      { id: "modplace",label: "Placera & ordna",    icon: "grid",     req: false, hint: "Dra till sektion, ordna" },
      { id: "modconf", label: "Modulinställningar",  icon: "settings", req: false, hint: "Bransch-specifika fält" },
    ] },
  { id: "innehall", name: "Innehåll & utseende", sub: "Texten, färgen, känslan",
    steps: [
      { id: "brand",   label: "Branding",           icon: "sun",      req: false, hint: "Logga, accentfärg, font" },
      { id: "text",    label: "Text & hjälte",      icon: "edit",     req: false, hint: "Klicka & skriv direkt i previewen" },
      { id: "tjanster",label: "Tjänster & innehåll",icon: "scissors", req: false, hint: "Datat modulerna visar" },
    ] },
  { id: "konto", name: "Ägare & konto", sub: "Vem som styr sidan",
    steps: [
      { id: "agare",   label: "Ägare & inbjudan",   icon: "user",     req: false, hint: "Magic-link → eget lösen" },
    ] },
  { id: "lansera", name: "Granska & lansera", sub: "Sista koll, sen live",
    steps: [
      { id: "granska", label: "Granska checklista",  icon: "checkCircle", req: false, hint: "Onboarding-checklistan" },
      { id: "live",    label: "Lansera",             icon: "rocket",   req: true,  hint: "Publicera på subdomän" },
    ] },
];

/* ---------------------------------------------------------------------
   6. STOREFRONT-SEKTIONER (var moduler kan ligga) — render-bron §6.1
   Mallens statiska kapitel + modul-markörer <corevo-module type=… pos=…>.
   --------------------------------------------------------------------- */
const SECTIONS = [
  { id: "header", name: "Header", fixed: true,  note: "Logotyp + nav + 'Boka tid'-CTA. Mallens chrome." },
  { id: "hero",   name: "Hjälte", fixed: true,  note: "Stor rubrik + bild. Redigerbar text. Mallens hero." },
  { id: "main",   name: "Huvudyta", fixed: false, note: "Här vävs moduler in (booking/shop/offert…) via markörer." },
  { id: "konto",  name: "Mitt konto", fixed: false, note: "Kundportal-moduler (husdjur, fordon, intag, orderstatus)." },
  { id: "footer", name: "Footer", fixed: true,  note: "Kontakt, öppettider, sociala länkar." },
];

/* ---------------------------------------------------------------------
   7. ONBOARDING-CHECKLISTA (onboarding-flode.md §5) — vad lansering kräver
   --------------------------------------------------------------------- */
const LAUNCH_CHECK = [
  { key: "tenant",  label: "Tenant skapad",                  detail: "slug + tenant_settings + ägarroll (atomiskt)", auto: true },
  { key: "brand",   label: "Branding satt",                  detail: "tema + minst en färg (tenant_settings.branding)", needs: "tema" },
  { key: "modules", label: "Minst en modul aktiv",            detail: "tenant_modules: minst en modul i state live", needs: "modval" },
  { key: "content", label: "Innehåll ifyllt",               detail: "minst 1 tjänst med pris (services + service_prices)", needs: "tjanster" },
  { key: "owner",   label: "Ägare inbjuden",                 detail: "magic-link → users-rad + roll (level 6)", needs: "agare" },
  { key: "domain",  label: "Subdomän reserverad",            detail: "<slug>.corevo.se · gratis Universal SSL (single-level) · skrivs i wrangler vid onboarding", auto: true },
  { key: "stripe",  label: "Betalning (valfritt nu)",        detail: "Stripe Connect — PAUSAT (beslut 14.2). Bokning funkar på-plats utan.", optional: true },
];

/* ---------------------------------------------------------------------
   8. DOMÄN-FAKTA (domanstrategi.md) — för lanseringsskärmen
   --------------------------------------------------------------------- */
const DOMAIN = {
  pattern: "corevo.se",
  reserved: ["booking", "admin", "app", "www", "api", "superbooking", "minbooking"],
  note: "Single-level wildcard *.corevo.se täcks av Cloudflares gratis Universal SSL (ingen extra kostnad). Plattform-Worker host-parsar slug → tenant_id. RLS isolerar datan. Subdomänen skrivs in i wrangler vid onboarding så nästa deploy inte tappar den. Egen domän (freshcut.se) via Cloudflare for SaaS = SPÄRRAD tills du säger KÖR.",
};

/* ---------------------------------------------------------------------
   2b. MODUL-ANSIKTEN — varje modul har TVÅ ytor som beter sig olika:
   `sf`  = vad BESÖKAREN ser/gör på den publika storefronten (eller i Mitt konto)
   `adm` = vad ÄGAREN gör i sin admin (M6) för att styra modulen
   Samma data, två vyer. Code bygger båda; RLS skiljer vem som ser vad.
   --------------------------------------------------------------------- */
const MODULE_FACES = {
  booking:      { sf: "Besökaren bokar tid: tjänst → tid → bekräftelse.",            adm: "Ägaren ser bokningskalendern, av-/ombokar och sätter scheman." },
  shop:         { sf: "Besökaren bläddrar produkter och lägger i varukorg (betalning pausad).", adm: "Ägaren lägger upp produkter, priser, lager och bilder." },
  offert:       { sf: "Besökaren skickar en offertförfrågan via formulär.",          adm: "Ägaren läser förfrågningar och svarar med offert (ny → besvarad → accepterad)." },
  lojalitet:    { sf: "Besökaren ser sina poäng/stämplar och blir stammis.",         adm: "Ägaren ställer in reglerna och ser alla medlemmar." },
  presentkort:  { sf: "Besökaren köper ett digitalt presentkort.",                   adm: "Ägaren ser sålda kort, saldon och löser in dem." },
  blogg:        { sf: "Besökaren läser publicerade inlägg.",                          adm: "Ägaren skriver, redigerar och publicerar inlägg." },
  portfolio:    { sf: "Besökaren bläddrar galleriet (filtrerbart).",                  adm: "Ägaren laddar upp bilder, taggar och ordnar galleriet." },
  husdjur:      { sf: "Kunden ser/fyller sin husdjursprofil i Mitt konto.",          adm: "Ägaren ser husdjursdatan kopplad till bokningarna." },
  fordon:       { sf: "Kunden ser/fyller sitt fordon i Mitt konto.",                  adm: "Ägaren ser fordonsdatan kopplad till bokning/offert." },
  intag:        { sf: "Kunden fyller intagsformuläret (krypterat) i Mitt konto.",     adm: "Behandlaren läser intaget — RLS-låst, känslig data." },
  recurring:    { sf: "Kunden ser och styr sin återkommande bokning.",               adm: "Ägaren ser serierna och de genererade tiderna." },
  orderstatus:  { sf: "Kunden följer statusen på sitt inlämnade jobb.",              adm: "Ägaren flyttar status: mottagen → under arbete → klar." },
  deposit:      { sf: "Besökaren betalar deposit för att bekräfta (UI; rails pausade).", adm: "Ägaren ser depositstatus per bokning." },
  meny:         { sf: "Besökaren läser menyn (kategorier, allergener).",             adm: "Ägaren redigerar rätter, priser och dagens-flagga." },
  inlamning:    { sf: "Besökaren lämnar in en vara via formulär (bild, beskrivning).", adm: "Ägaren tar emot och kopplar till jobb/konsignation." },
  media_library:{ sf: "(Ingen publik yta — infrastruktur.)",                         adm: "Ägaren laddar upp och hanterar bildarkivet (500 MB kvot)." },
};
Object.keys(MODULE_FACES).forEach(k => { if (MODULES[k]) Object.assign(MODULES[k], MODULE_FACES[k]); });

/* expose */
window.CFG = { ST_THEMES, MODULES, BRANCHES, BOOKING_VARIANTS, PHASES, SECTIONS, LAUNCH_CHECK, DOMAIN };
