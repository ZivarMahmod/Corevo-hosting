/* Corevo M6 Build Spec — content data. Rendered by spec-render.js. */
window.SPEC = {

  principles: [
    ["Inga döda toggles", "Varje kontroll är sann-kopplad eller borttagen. Slår ägaren på bokningsbekräftelse ska den skickas på riktigt. En toggle som inte gör något får inte finnas."],
    ["Sidor menar vad de heter", "\u201cBokningar\u201d är till för bokningar — inget brus, ingen analytics som smugits in. Varje yta gör en sak väl."],
    ["Live-koppling / röd tråd", "En ändring på ett ställe slår igenom överallt den rör: avbokning → tid tillbaka på storefront; tjänst → syns på hemsidan; schema → lediga tider."],
    ["Bunden frihet + undo", "Ägaren ska känna \u201cplattform, inte bara hemsida\u201d — men inte kunna förstöra. Tydligt vilken kontroll ändrar vad, och allt går att ångra."],
    ["UI, inte kod", "Allt ägaren gör sker i UI och slår igenom utan deploy. Färg/font läses som runtime tenant_settings, aldrig build-inlinat."],
    ["Kontroll utan plikt", "Verktyget ska vara värt att vara i, aldrig tvångsadmin. Frisören tvingas aldrig spara dagens händelser för att kunna fokusera på klippet."],
  ],

  swBrand: [
    ["--forest", "#1F4636", "Primär — sidofält, rubriker, knappar", "#fff"],
    ["--forest-700", "#173529", "Hover / djup i sidofält", "#fff"],
    ["--gold", "#F5A623", "Accent — aktiv, KPI, highlights", "#3A2A06"],
    ["--gold-100", "#FBEBCB", "Gold-tint fyllning", "#5c4410"],
    ["--cream", "#FAF8F4", "App-bakgrund", "#21261F"],
    ["--paper", "#FFFFFF", "Kort / paneler", "#21261F"],
    ["--paper-2", "#F3EFE8", "Alt-fyllning, tabellränder", "#21261F"],
  ],
  swInk: [
    ["--ink", "#21261F", "Primär text", "#fff"],
    ["--ink-2", "#555C50", "Sekundär text", "#fff"],
    ["--ink-3", "#8A8F82", "Dämpad / bildtext", "#fff"],
    ["--line", "#E7E1D6", "Hårlinje på cream", "#21261F"],
    ["--line-strong", "#D8D0C2", "Starkare kant", "#21261F"],
  ],
  swStatus: [
    ["--success", "#4E7A5E", "Klar / betald / på", "#fff"],
    ["--warning", "#A37D3C", "Osparat / obetalt", "#fff"],
    ["--danger", "#9E5A57", "Avbokad / avboka", "#fff"],
    ["--info", "#5E748C", "Skyddat / hint", "#fff"],
  ],
  typeScale: [
    ["h-display", "Playfair 40 · 700", 40, "var(--display)", 700, "var(--forest)", "Sidrubrik på hero-ytor"],
    ["h1", "Playfair 28 · 700", 28, "var(--display)", 700, "var(--forest)", "Sidtitel (PageHead)"],
    ["h2", "Inter 19 · 600", 19, "var(--ui)", 600, "var(--ink)", "Kortrubrik"],
    ["h3", "Inter 15 · 600", 15, "var(--ui)", 600, "var(--ink)", "Underrubrik"],
    ["body", "Inter 14 · 400", 14, "var(--ui)", 400, "var(--ink-2)", "Brödtext"],
    ["eyebrow", "Inter 11 · 700 · caps", 11, "var(--ui)", 700, "var(--gold-600)", "Etikett ovanför titel"],
  ],
  radii: [["xs",4],["sm",8],["md",12],["lg",18],["pill",999]],
  spacing: [4,8,12,16,24,32,48,64],

  buttons: [["primary","Spara schema","check"],["gold","Publicera","check"],["ghost","Se din sida","ext"],["subtle","Spara","plus"],["danger","Avboka","x"]],
  badges: [["neutral","Drop-in"],["success","Klar · betald"],["warning","Väntar"],["danger","Avbokad"],["info","Skyddat namn"],["gold","Guld"]],
  statusBadges: [["gold","Bokad","gjord"],["success","Klar · betald","klar"],["danger","Avbokad","avbokad"]],

  redtrad: [
    ["Kund avbokar", "Kundportal → \u201cAvboka\u201d (storefront-världen)", "kund"],
    ["Tillstånd skrivs", "booking.status = avbokad, paid = false, systemnotering loggas", "system"],
    ["Tid frigörs", "Slot åter bokningsbar på storefront (M3 äger slot-logiken)", "m3"],
    ["Speglas överallt", "Salong-admin visar \u201cAvbokad\u201d · frisörens dag tappar passet · dashboard räknar om", "all"],
    ["Bekräftelse", "Toast: \u201cTid 17:00 frigjord — åter bokningsbar\u201d", "toast"],
  ],

  /* ---------------- NODES ---------------- */
  nodes: [
    {
      num:"01", title:"Salong-dashboard", role:"Salong-admin", route:"/admin", m6:"§3.8",
      img:"img/dashboard.png", cap:"Kontrollcenter — inte bara dagens bokningar.",
      intent:"Ägarens första vy. Ett kontrollverktyg man <b>vill</b> vara i: dagen i en blick, utan adminpyssel. Tyngdpunkten hänger fortfarande i Bokningar — detta är överblicken.",
      parts:[
        "<b>PageHead</b> — eyebrow \u201cStudio Salvia · tis 2 juni\u201d, Playfair-hälsning \u201cGod morgon, Elin\u201d, sub. Höger: <code>Se din sida</code> (ghost) + <code>Ny bokning</code> (primary).",
        "<b>Fyra KPI-kort</b> (<code>Stat</code>): Idag · Denna vecka · Beläggning · Nya lojalitetskunder. Siffran i <b>Playfair 38 forest</b>, eyebrow gold, liten ikon-ruta uppe höger, delta/hint under.",
        "<b>Kommande idag</b> — kort med klickbara rader (tid · namn · tjänst · frisör · status). Klick → öppnar bokningen. \u201cAlla bokningar →\u201d länkar till Bokningar.",
        "<b>Tjänste-mix</b> — staplad horisontell bar som summerar 100% + tvåkolumns-legend med färgprick och %.",
        "<b>Dagens topptimmar</b> — enkel stapelgraf (när flest kunder). Högsta stapeln i gold, övriga forest-300.",
        "<b>\u201cDin sida, live\u201d</b> — forest-kort, gold eyebrow \u201cRöd tråd\u201d, CTA <code>Öppna salvia.corevo.se</code>. + Stripe-statuskort.",
      ],
      data:[
        ["Kommande / antal","bookings","status ≠ avbokad. \u201cKvar\u201d = status gjord. Härled siffrorna, hårdkoda inte."],
        ["Tjänste-mix","bookings → services","aggregera andel per tjänstekategori."],
        ["Topptimmar","bookings.time","gruppera på starttimme."],
        ["Se din sida","tenants.subdomain","öppnar storefront i ny flik."],
      ],
      behavior:[
        "Klick på kommande rad → Bokningar med den bokningen öppen.",
        "\u201cSe din sida\u201d finns både här och i topbaren (samma mål).",
        "Beläggning = bokade slots / totala slots för dagen.",
      ],
      accept:[
        "Ingen trafik-/klick-analytics (struket i v1).",
        "Alla siffror härledda från live-data, inga magiska konstanter.",
        "\u201cSe din sida\u201d-länk finns på dashboard.",
        "KPI-siffror i Playfair (display), inte Inter.",
      ],
      pitfalls:[
        ["dont","Stat-siffran får inte renderas i Inter — den ska vara Playfair/display, det är hela tyngden i kortet."],
        ["dont","Lägg inte tillbaka analytics-widgets \u201cför att fylla ut\u201d. De är medvetet borttagna."],
        ["principle","Tjänste-mix-baren måste summera exakt 100% — annars ser den trasig ut."],
      ],
    },
    {
      num:"02", title:"Bokningar — fyra vyer", role:"Salong-admin", route:"/admin/bokningar", m6:"§3.2",
      img:"img/bok-lista.png", cap:"Lista-vyn. Vyväljaren uppe till höger byter mellan fyra vyer; valet auto-sparas.",
      intent:"Kontroll-nav, inte plikt. Filtrerbart, sökbart, status syns. <b>Ägaren väljer vy</b> — och den vyn är den de alltid landar i tills de byter (auto-spar i <code>localStorage</code>, nyckel <code>corevo.bookings.view</code>).",
      parts:[
        "<b>Sök</b> (kund/tjänst/frisör) + <b>statusfilter</b> (Alla/Bokade/Klara/Avbokade med antal). Filtren visas i Lista & Tidslinje; Tavla grupperar redan på status.",
        "<b>Vyväljare</b> — segmenterad: <code>Lista</code> · <code>Tidslinje</code> · <code>Tavla</code>, samt Vecka. Aktiv = paper-kort + shadow. Onclick → spara i localStorage.",
        "<b>Röd-tråd-banner</b> (gold-tint) som uppmanar: avboka en rad → tiden frigörs.",
        "<b>Live-koppling</b>: avbokning skriver status + frigör tid + fyrar toast (logik i M3).",
      ],
      extraFigs:[
        ["img/bok-tidslinje.png","Tidslinje — proportionell dygnsaxel (09–18). Passets höjd = tjänstens längd, så en 120-min färg är dubbelt så hög som en 60-min klippning. Vänster statusspine i statusfärg."],
        ["img/bok-vecka.png","Vecka — Mån–Fre. Idag fyllt med riktiga bokningar; övriga dagar visar bokningsbara slots (lediga). Matar M3:s slot-generering visuellt."],
        ["img/bok-tavla.png","Tavla — kanban grupperad i Bokade / Klara / Avbokade med antal per kolumn. Betald-badge på klara. Avbokade överstrukna."],
      ],
      data:[
        ["Rader","bookings","customerId (ej gäst-i-note!), serviceId, staffId, time, dur, status, paid, channel, notes[]"],
        ["Vyval","localStorage","corevo.bookings.view — persisteras client-side per användare/enhet."],
        ["Slots i Vecka","working_hours","explicita starttider per dag (se nod 07)."],
      ],
      behavior:[
        "Vyval sparas direkt vid byte och läses vid montering — ägaren landar alltid i sin vy.",
        "Alla fyra vyer öppnar samma detalj-drawer (nod 03) vid klick.",
        "Status/färg är delad — avboka i en vy syns i alla.",
        "Sortering på tid i alla vyer.",
      ],
      accept:[
        "Fyra vyer fungerar och delar dataselektion.",
        "Vyval överlever sidladdning (auto-spar).",
        "Status syns alltid: gjord/avbokad/klar.",
        "Avbokad rad är överstruken & dämpad, försvinner aldrig.",
      ],
      pitfalls:[
        ["dont","Tvinga aldrig ägaren att spara dagens händelser. Funktionen finns, men aldrig som krav."],
        ["principle","Auto-klar: en passerad, ej klarmarkerad bokning blir klar ikväll — men <b>försvinner aldrig</b> ur listan."],
        ["dont","Tidslinjen får inte ha fasta radhöjder — höjden ska vara proportionell mot <code>dur</code>."],
      ],
    },
    {
      num:"03", title:"Bokningsdetalj (drawer)", role:"Salong-admin", route:"slide-over", m6:"§3.2 + §4 + §8",
      img:null, specimen:"drawerBooking",
      intent:"Höger-ankrad panel som öppnas från valfri bokningsvy. Bär kund-identitet + <b>tidsbunden</b> PII, tjänstedetalj, noteringar mot raden, och åtgärder. Här bor två skydd från M6.",
      parts:[
        "<b>Header</b>: statusbadge + kundnamn (visningsnamn) + \u201ctjänst · 09:00–10:00\u201d.",
        "<b>Skydd-callouts</b>: <em>auto-klar</em>-info (passerad tid) och <em>betalnings-guard</em> (sen/no-show markeras aldrig klar+betald).",
        "<b>Kund</b>: avatar + nivå + besök + \u201cskyddat namn\u201d-badge. <b>Kontaktuppgifter maskade</b> tills <code>Visa</code> trycks (loggas, tidsbundet 15 min).",
        "<b>Tjänst & bokning</b>: tjänst, längd, frisör, kanal, bokad-datum, betalning.",
        "<b>Noteringar mot bokningen</b>: kundens meddelanden landar här (chatt mot rad, inte mejltråd). Input för egen notering.",
        "<b>Footer-actions</b>: Avboka (danger) + Markera klar; för klar: Markera betald + Öppna igen; för avbokad: Återställ.",
      ],
      data:[
        ["Identitet","customers","stabil id, visningsnamn, nivå, besök, favoritfrisör."],
        ["PII (tidsbunden)","customers","telefon/mejl — maskas; visas i driftfönster, loggas, gallras (M10)."],
        ["Noteringar","bookings.notes[]","{from:'kund'|'frisör'|'system', text, at}. Ersätter gäst-i-note-sömmen."],
        ["Completion","bookings.status/paid","gate mot betalning — princip låst här, beteende i M8."],
      ],
      behavior:[
        "Visa/Dölj PII togglas per kund; default maskat (telefon \u201c070- •• •• ••\u201d, mejl \u201c•••••@•••\u201d).",
        "Avboka → cancel(): status avbokad, paid false, systemnotering, toast, stäng drawer.",
        "Markera klar → status klar; Markera betald → paid true (separata steg).",
        "Drawer: öppen translateX(0), stängd translateX(102%), backdrop klick stänger.",
      ],
      accept:[
        "PII är maskad tills explicit visad; reveal loggas & är tidsbunden.",
        "Avbokning frigör tiden (röd tråd) och bekräftas med toast.",
        "Aldrig automatiskt \u201cklar + betald\u201d vid sen kund / no-show.",
        "Kundens meddelande syns som notering på raden, inte som mejl.",
      ],
      pitfalls:[
        ["dont","Visa aldrig full telefon/mejl by default. Maskning är utgångsläget; reveal är ett aktivt, loggat val."],
        ["dont","Slå inte ihop \u201cklar\u201d och \u201cbetald\u201d till en knapp — de är olika tillstånd med olika regler."],
        ["note","Slide-over är <code>position:fixed</code> — testa att den faktiskt animerar in (translateX) och att backdrop fångar klick."],
      ],
    },
    {
      num:"04", title:"Kunder (kunddatabas)", role:"Salong-admin", route:"/admin/kunder", m6:"§3.1 + §4",
      img:"img/kunder.png", cap:"Ny yta. Återkommande kunder år efter år — utan att PII ligger exponerad.",
      intent:"Den nya ytan. Frisör + admin känner igen återkommande kund; lojalitet (M4) byggs ovanpå <b>identiteten</b>. Det finns ingen snygg väg till \u201ckänner igen dig\u201d + lojalitet utan en stabil kundrad.",
      parts:[
        "Fyra stat-kort: Kunder totalt · Återkommande (≥5 besök) · Guld-nivå · Skyddat namn (kundens val).",
        "Sökfält + tabell: Kund (avatar + sköld om skyddat) · Nivå-badge · Besök · Senaste · Frisör · Lojalitetspoäng (gold).",
        "Klick på rad → kunddetalj-drawer (nod 05).",
      ],
      data:[
        ["Kundrad","customers","stabil id; inloggad → auth-user; gäst → stabil nyckel (kontakt-hash) så återkommande gäst känns igen."],
        ["Visningsnamn","customers.showAs","full / förnamn / initialer — styrs av kunden, påverkar hur namnet visas här."],
        ["Lojalitet","loyalty (M4)","poäng/nivå bygger på identitet, aldrig på exponerad PII."],
      ],
      behavior:[
        "Namn visas enligt kundens showAs (t.ex. \u201cS. L.\u201d för initialer).",
        "Sök filtrerar på fullName internt men respekterar visningsnamn i UI.",
      ],
      accept:[
        "Stabil kundrad finns; gäst-i-note-sömmen migrerad bort.",
        "Visningsnamn respekteras överallt namnet syns.",
        "Lojalitet kopplad till id, inte till telefon/mejl.",
      ],
      pitfalls:[
        ["principle","Identitet och kontakt-PII är <b>olika lager</b>, inte samma fält. Det är hela poängen med modellen (se Appendix A)."],
        ["note","Korsar M4 (portal/lojalitet) och M10-ops (GDPR export/erase, redan byggt). M6 äger ägarens vy."],
      ],
    },
    {
      num:"05", title:"Kunddetalj (drawer)", role:"Salong-admin", route:"slide-over", m6:"§4",
      img:null, specimen:"drawerCustomer",
      intent:"Visar separationen i praktiken: <b>identitet</b> (bestående) överst, <b>visningsnamn</b> som kunden styr, <b>kontakt-PII</b> tidsbunden under, sedan lojalitet och historik.",
      parts:[
        "<b>Identitet · bestående</b>: fullständigt namn, antal besök, favoritfrisör, senaste besök.",
        "<b>Visningsnamn</b> (info-tint): segmenterad väljare Fullt namn / Förnamn / Initialer. \u201cVisas nu som …\u201d uppdateras live.",
        "<b>Kontakt-PII · tidsbunden</b>: maskad telefon/mejl + Visa/Dölj.",
        "<b>Lojalitet</b>: poäng (gold, Playfair) + progressbar mot nästa nivå.",
        "<b>Historik</b>: tidigare besök (tjänst, datum, frisör, pris).",
      ],
      data:[
        ["showAs","customers.showAs","ägaren kan se/ändra, men det är kundens val som styr (speglas i portalen, nod 12)."],
        ["PII","customers.phone/email","maskas; tidsbunden reveal."],
      ],
      behavior:[
        "Byte av visningsnamn uppdaterar direkt hur namnet renderas i hela back-office.",
        "Reveal/hide PII per kund; toast vid reveal.",
      ],
      accept:[
        "Visningsnamn-väljaren ändrar live vad som visas.",
        "Lojalitetsbandet bygger på identiteten.",
      ],
      pitfalls:[
        ["dont","Bygg inte lojalitet på telefonnummer/mejl. Bryts den kopplingen försvinner kundens band vid PII-gallring."],
      ],
    },
    {
      num:"06", title:"Tjänster (storefront-koppling)", role:"Salong-admin", route:"/admin/tjanster", m6:"§3.3",
      img:"img/tjanster.png", cap:"Tabell till vänster, live storefront-placeringskarta till höger.",
      intent:"När en tjänst läggs in/redigeras ska det synas <b>vart på hemsidan</b> den hamnar. UI-ändring i admin → storefront utan kod (M6→M2).",
      parts:[
        "Tabell: Tjänst (+ \u201cPopulär\u201d-badge) · Tid · Pris · Storefront-sektion (select) · Online (toggle) · redigera.",
        "<b>Placeringskarta</b> (höger): sektioner Dam/Herr/Färg/Styling med chip per tjänst. Ändrar man select/toggle flyttas chippet direkt.",
        "Dold tjänst (online av) hamnar i \u201c— dold —\u201d och syns inte på kartan.",
        "Fotnot: \u201cÄndringar slår igenom utan kod eller deploy.\u201d",
      ],
      data:[
        ["Tjänst","services","name, cat, price, dur, online(bool), section(storefront-placering)"],
        ["Storefront","M2 render","läser online + section för att rendera tjänstelistan på salvia.corevo.se."],
      ],
      behavior:[
        "Toggle online → tjänsten visas/döljs på storefront och i kartan.",
        "Byt sektion i select → chippet flyttar sektion i kartan direkt.",
      ],
      accept:[
        "Ägaren ser vart på hemsidan tjänsten hamnar, utan att lämna admin.",
        "Online-av döljer tjänsten överallt publikt.",
      ],
      pitfalls:[
        ["principle","Kartan måste vara <b>live</b> — den är beviset på \u201cUI, inte kod\u201d. En statisk lista räcker inte."],
      ],
    },
    {
      num:"07", title:"Schema (explicita slots)", role:"Salong-admin", route:"/admin/scheman", m6:"§5",
      img:"img/schema.png", cap:"Bokningsbara starttider per dag och frisör — ojämna intervall tillåtna.",
      intent:"Gamla schemat visade <b>fasta arbetstider</b> — fel modell. Rätt modell: explicita bokningsbara <b>starttider</b> per dag. Service-längden styr passets längd, inte ett fast raster.",
      parts:[
        "PageHead + <code>Återställ mönster</code> + <code>Spara schema</code>.",
        "<b>Frisör-väljare</b> (piller med initial-bricka) — schemat sätts per frisör.",
        "Info: upplägget är förinställt från salongens nuvarande mönster (Zivar bootar). Lågt manuellt arbete är ett krav.",
        "<b>Veckorutnät Mån–Fre</b>: varje dag listar slot-chips (grön) med tid + ta-bort, plus en streckad <code>+ Tid</code>. Idag markerad i gold.",
      ],
      data:[
        ["Slots","working_hours","explicita slot-definitioner per dag, ej bara öppen/stäng. Ojämna intervall (12:30, 13:05, 14:00…)."],
        ["Frånvaro","time_off","stänger slots för en period (se nod 11)."],
        ["Genererar","M3","lediga tider = slots + service-längd − befintliga bokningar."],
      ],
      behavior:[
        "Lägg till tid (manuell input, valideras HH:MM) / ta bort tid per dag.",
        "Boot-import speglar nuvarande mönster; ägaren tweakar.",
        "Tider kan auto-föreslås från service-längd men ska vara manuellt justerbara.",
      ],
      accept:[
        "Modellen är explicita starttider, inte öppen/stäng-arbetstid.",
        "Ojämna intervall tillåts.",
        "Schemat hålls rätt med minimalt manuellt arbete.",
      ],
      pitfalls:[
        ["dont","Återinför inte \u201cfrån–till arbetstid\u201d-modellen. Det var felet i gamla schemat."],
        ["note","<code>working_hours</code> behöver stötta explicita slot-definitioner. Matar M3 — re-speca inte slot-logiken här."],
      ],
    },
    {
      num:"08", title:"Personal (spegla verklig dag)", role:"Salong-admin", route:"/admin/personal", m6:"§3.4",
      img:null, specimen:"staffNote", altImg:"img/frisor-idag.png",
      intent:"Mer än CRUD. Visar frisörens roll/bio/specialiteter <b>och</b> speglar deras verkliga dag (samma bokningar som M5-portalen). Bilden visar M5-spegeln nod 11 delar samma data.",
      parts:[
        "Kort per frisör: avatar (egen färg), namn, roll, bio, specialitet-chips, plats/vecka, \u201cX idag\u201d.",
        "Klick → drawer: Om + specialiteter, multi-location-reminder (parkerad), och <b>Verklig dag · idag</b> = frisörens faktiska bokningar med status.",
      ],
      data:[
        ["Personal","staff (staff_id)","namn, roll, bio, specialties[], location, services."],
        ["Verklig dag","bookings","samma rader som M5 — filtrerade på staffId, status ≠ avbokad."],
      ],
      behavior:[
        "Dagslistan i drawern är live-spegel av bokningarna, inte en separat lista.",
      ],
      accept:[
        "Personal-ytan visar mer än namn+tjänster.",
        "Verklig dag = samma data som frisörportalen (M5).",
      ],
      pitfalls:[
        ["note","Multi-location (frisör delad per vecka) är <b>parkerat</b> — visa som reminder, bygg inte allokeringen först. <code>locations</code> finns redan."],
        ["dont","Duplicera inte bokningsdata för personalvyn. Spegla samma källa som M5."],
      ],
    },
    {
      num:"09", title:"Varumärke (live-preview)", role:"Salong-admin", route:"/admin/varumarke", m6:"§3.6",
      img:"img/varumarke.png", cap:"Kontroller vänster, live storefront-preview höger. Färg/font = runtime, ingen deploy.",
      intent:"Ändra bild/färg/font/text och se det <b>direkt</b>. Bunden frihet: tydligt vilken kontroll ändrar vad, med undo. Previewn renderas i <b>storefront-världen</b> — beviset att editorn driver salongens egen sida.",
      parts:[
        "<b>Dirty-bar</b>: \u201cOsparade ändringar — tryck Publicera\u201d (warning) ↔ \u201cAllt publicerat\u201d (success).",
        "Header-actions: <code>Ångra</code> (disabled utan historik) · <code>Visa storefront</code> · <code>Publicera</code> (disabled när inget ändrats).",
        "<b>Kontroller</b>: namn, logga (R2-uppladdning), accentfärg (swatch-rad), rubrik-typsnitt (lista med live-renderade fontnamn), hero, tagline. Varje fält visar en \u201cändrad\u201d-tagg när det nyss ändrades.",
        "<b>Live-preview</b>: browser-chrome + storefront-hero som uppdateras per tangenttryck; nyss ändrat element får en gold outline.",
        "Fotnot: färg/font läses som runtime tenant_settings → därför syns ändring utan deploy.",
      ],
      data:[
        ["Tema","tenant_settings","color, font, hero, tagline — runtime, EJ build-inlinat."],
        ["Logga","R2","bilduppladdning finns redan (rör ej)."],
      ],
      behavior:[
        "Varje ändring pushar till undo-historik; Ångra stegar tillbaka.",
        "Publicera commitar draft → published; dirty-bar växlar till success.",
        "Fallback om full live-render ej går: en preview-knapp (som POS) som öppnar sidan.",
      ],
      accept:[
        "Färg/font ändras utan ny deploy (runtime tenant_settings).",
        "Tydligt vilken kontroll ändrar vad + undo finns.",
        "Preview ligger i storefront-världen, inte Corevo-grönt.",
      ],
      pitfalls:[
        ["dont","Build-inlina aldrig färg/font. Då krävs deploy och hela poängen faller."],
        ["principle","Bunden frihet: ge kontroll men inte så mycket att ägaren kan förstöra sidan. Allt ångrbart."],
      ],
    },
    {
      num:"10", title:"Inställningar (sanna toggles)", role:"Salong-admin", route:"/admin/installningar", m6:"§3.7",
      img:"img/installningar.png", cap:"Varje reglage är på riktigt kopplat. \u201cAKTIV/AV\u201d-status + bevis under aktiva.",
      intent:"Inga döda toggles. Slår ägaren på bokningsbekräftelse → den skickas på riktigt. Vill de inte ha funktionen → ta bort den. En toggle som inte gör något får inte finnas.",
      parts:[
        "<b>Bokning</b>: Bokningsbekräftelse (med bevis-callout när på), SMS-påminnelse, Kund-konton, Drop-in synligt. Varje rad visar AKTIV/AV-etikett.",
        "<b>Betalning</b>: Betalning vid bokning (+ completion-guard-callout) + Stripe-anslutningskort.",
      ],
      data:[
        ["Toggles","tenant_settings","varje boolean styr en verklig funktion."],
        ["Stripe","StripeConnectCard","finns redan (rör ej)."],
      ],
      behavior:[
        "Toggle på → funktion aktiv på riktigt (ej kosmetisk).",
        "Aktiva toggles visar kort bevis/konsekvens under sig.",
      ],
      accept:[
        "Ingen toggle utan verklig effekt.",
        "Betalning-vid-bokning visar completion-guarden (ej falskt klar+betald).",
      ],
      pitfalls:[
        ["dont","Lämna aldrig en kosmetisk toggle kvar. Antingen sann-koppla den eller ta bort den."],
      ],
    },
    {
      num:"11", title:"Frisörens egna sida — Idag", role:"Frisör (M5)", route:"frisörportal", m6:"§3.4 / §8",
      img:"img/frisor-idag.png", cap:"M5-spegel. Samma bokningar som salong-admin, frisörens vy. Kund-noteringar inline.",
      intent:"Frisörens egen yta: dagen live, utan adminpyssel — \u201cbara klippa\u201d. Speglar samma store som salong-admin. Kundens meddelanden landar som noteringar på raden.",
      parts:[
        "<b>Nästa kund</b>-hero (forest): tid (Playfair), namn, tjänst, <code>Markera klar</code> (gold).",
        "Dagslista: kort per bokning med tid/längd, statusspine, namn, tjänst, <code>Klar</code>-knapp eller status-badge.",
        "<b>Kund-notering</b> inline (gold-tint) under bokningen — t.ex. \u201cKan ni ta lite extra på sidorna?\u201d med avsändare + tid.",
      ],
      data:[
        ["Dag","bookings","filtrerat på inloggad frisör (staff_id), status ≠ avbokad."],
        ["Noteringar","bookings.notes[]","från='kund' visas; ägaren/frisören kan lägga egna."],
      ],
      behavior:[
        "Markera klar → samma store-action som admin; syns direkt i admin.",
        "Frisören tvingas inte göra något — knapparna finns, men dagen rullar utan dem (auto-klar).",
      ],
      accept:[
        "Speglar admin-data (ingen separat sanning).",
        "Kund-notering syns på raden, inte som mejl.",
        "Ingen tvångsadmin för att se sin dag.",
      ],
      pitfalls:[
        ["principle","Kontroll utan plikt: frisören ska kunna fokusera på klippet. Inga obligatoriska sparmoment."],
      ],
    },
    {
      num:"12", title:"Kundens sida (portal)", role:"Kund (M4)", route:"storefront · mina sidor", m6:"§4 / röd tråd",
      img:"img/kund-portal.png", cap:"I salongens EGET tema (sage), inte Corevo-grönt. Stänger röd tråd-loopen.",
      intent:"Inloggade kundens yta <b>på salongens sida</b>. Avsiktligt i storefront-världen (salongens tema) — respekterar två-världar. Här avbokar kunden → tiden frigörs och syns avbokad i salong-admin direkt.",
      parts:[
        "Header i salongens tema (Cormorant-serif, sage). Hälsning.",
        "<b>Lojalitetskort</b> (sage): nivå, poäng (en rad, ingen wrap), progressbar mot nästa nivå.",
        "<b>Mina bokningar</b>: kort med datum/tid, tjänst, frisör, <code>Omboka</code> / <code>Avboka</code>. Avboka → röd tråd. Meddelande-fält → landar som notering hos frisören.",
        "<b>Tidigare besök</b>: historik med pris + intjänade poäng.",
        "<b>Integritet</b>: visningsnamn-väljare (kunden styr → slår mot admins kundvy), kontaktfält, samtycke-toggle (annars gallras PII).",
      ],
      data:[
        ["Mina bokningar","bookings","customerId = inloggad kund; delar id med admin-store."],
        ["Visningsnamn","customers.showAs","kundens val styr hur frisören ser namnet (nod 04/05)."],
        ["Samtycke","customers.consent","av → kontaktuppgifter gallras efter besöket."],
      ],
      behavior:[
        "Avboka → cancel('kund'): status avbokad, tid tillbaka, syns i admin + frisör + dashboard.",
        "Skicka meddelande → addNote(from:'kund') på bokningsraden.",
        "Ändra visningsnamn → speglas i salong-admins kundvy.",
      ],
      accept:[
        "Portalen är i storefront-världen (salongens tema), aldrig Corevo-grönt.",
        "Avbokning här stänger röd tråd-loopen mot admin.",
        "Kunden styr sitt visningsnamn och sitt samtycke.",
      ],
      pitfalls:[
        ["dont","Rendera aldrig kundportalen i Corevo-grönt. Det är salongens sida — använd <code>[data-world=\"storefront\"]</code> + temaklass."],
        ["note","Korsar M4 (portal/lojalitet). M6 äger identitet + visningsnamn; M4 äger portal/lojalitetslogik."],
      ],
    },
    {
      num:"13", title:"Onboarding — temaval med live-preview", role:"Super admin", route:"/onboarda", m6:"§3.6 (bonus)",
      img:"img/onboard-tema.png", cap:"Bonus. Varje mall visas som en riktig mini-storefront så ägaren ser vad de väljer.",
      intent:"När en ny salong onboardas ska temasteget <b>visa</b> mallen, inte bara en färgruta. Varje val renderar en live mini-storefront (typsnitt, färg, ton) så valet inte kräver gissning.",
      parts:[
        "Stegindikator (Namn → Temamall → Branding → Ägare).",
        "Mall-rad: Salvia / Leander / Zigge / Linnea / Edit — varje knapp visar \u201cAa\u201d i mallens typsnitt + accentstreck.",
        "<b>Live-preview</b>: browser-chrome + storefront-hero i vald mall (hero, eyebrow, tjänste-chips, bild). Byter man mall byts hela previewn.",
      ],
      data:[
        ["Mall","theme templates","speglar storefront-temats tokens (font, färg, radie, caps)."],
      ],
      behavior:[
        "Klick på mall → preview + vibe-text uppdateras (\u201cMörk & rå barber\u201d osv).",
        "Salongsnamnet skrivs in i previewns hero live.",
      ],
      accept:[
        "Temat förhandsvisas som en riktig sida, inte en swatch.",
        "Previewn ligger i storefront-världen.",
      ],
      pitfalls:[
        ["do","Visa mallen som den verkligen ser ut. En platt färgruta tvingar ägaren att gissa — det var det vi ville bort från."],
      ],
    },
  ],

  dmRename: [
    ["salons","tenants","\u201cSalong\u201d = \u201ctenant\u201d genomgående"],
    ["salon_settings","tenant_settings","färg/font/toggles läses runtime härifrån"],
    ["staff_schedules","working_hours","behöver stötta explicita slots, ej bara öppen/stäng"],
    ["staff_time_off","time_off","frånvaro stänger slots"],
    ["(saknades)","locations","finns redan (byggt i G04) — multi-location-lager"],
    ["barber_id","staff_id","genomgående"],
  ],
  dmCust: [
    ["Identitet · bestående, intern", ["Stabil kund-rad med id","Frisör känner igen återkommande kund år efter år","Lojalitet (M4) byggs HÄR","Visningsnamn kunden själv väljer (valt namn / initial)"], "do"],
    ["Kontakt-PII · minimerad, tidsbunden", ["Telefon / mejl","Syns bara i driftfönstret kring bokningen","Maskas / gallras efter (GDPR-väg finns i M10-ops)","Lojalitet bygger ALDRIG på exponerad PII"], "dont"],
  ],

  pitfalls: [
    ["Två världar blandade","Back-office-grönt läckte in i storefront/kundportal.","Scopea allt under rätt <code>data-world</code>. Kundportal + previews = storefront-tema."],
    ["Falskt \u201cklar + betald\u201d","Sen kund/no-show auto-markerades betald.","Completion-gate: när betalning-vid-bokning är på får no-show aldrig auto-bli klar+betald. (Princip M6, beteende M8.)"],
    ["Bokning försvann","Passerade bokningar föll ur listan.","Auto-klar markerar, men raden stannar. Bokningar raderas aldrig (build-once-never-delete)."],
    ["PII exponerad","Telefon/mejl visades by default.","Maskat utgångsläge; reveal är aktivt, loggat, tidsbundet."],
    ["Fasta arbetstider","Schemat byggdes som öppen/stäng.","Explicita bokningsbara starttider, ojämna intervall, service-längd-styrt."],
    ["Färg/font build-inlinat","Varumärkesändring krävde deploy.","Läs som runtime tenant_settings. Ingen deploy för färg/font/text."],
    ["Döda toggles","Reglage utan effekt fanns kvar.","Sann-koppla eller ta bort. Inget mittemellan."],
    ["Gäst-i-note","Gästkontakt låg i bookings.note.","Migrera till stabil kund-id (gäst = kontakt-hash)."],
    ["Analytics i v1","Trafik-/klick-widgets på dashboard.","Struket. Ersatt av \u201cSe din sida\u201d-länk."],
    ["Tidslinje med fast radhöjd","Alla pass lika höga oavsett längd.","Höjd proportionell mot <code>dur</code> (en 120-min är dubbelt så hög som 60-min)."],
  ],
};
