/* =====================================================================
   Corevo back-office — demo data.
   Shared across super-admin / salong-admin / personal / kund so the
   "röd tråd" (live coupling) is literal: a cancellation in one surface
   frees the slot and reflects everywhere. Bookings live in a runtime
   store (Shell.jsx) seeded from BOOKINGS below.
   ===================================================================== */

const TODAY = "tis 2 juni";

const SALONS = [
  { name: "Studio Salvia", sub: "salvia.corevo.se", city: "Linköping", status: "Aktiv", theme: "Salvia", bookings: 312, owner: "Elin Sandberg", dot: "#5E7361", locations: 1 },
  { name: "Maison Leander", sub: "leander.corevo.se", city: "Linköping", status: "Aktiv", theme: "Leander", bookings: 488, owner: "Sofia Leander", dot: "#7E6E92", locations: 2 },
  { name: "Zigge", sub: "zigge.corevo.se", city: "Linköping", status: "Aktiv", theme: "Zigge", bookings: 701, owner: "Ziggy Demir", dot: "#C8743C", locations: 2 },
  { name: "Klippoteket", sub: "klippoteket.corevo.se", city: "Norrköping", status: "Pausad", theme: "Salvia", bookings: 54, owner: "Petra Holm", dot: "#5E7361", locations: 1 },
  { name: "Barber & Co", sub: "barberco.corevo.se", city: "Jönköping", status: "Aktiv", theme: "Zigge", bookings: 367, owner: "Markus Falk", dot: "#C8743C", locations: 1 },
  { name: "Salong Nord", sub: "nord.corevo.se", city: "Linköping", status: "Onboarding", theme: "Leander", bookings: 0, owner: "Ida Ek", dot: "#7E6E92", locations: 1 },
];

/* ---- Kundmodell: identitet (bestående) vs kontakt-PII (minimerad) ----
   showAs styr hur namnet visas publikt/för frisör. PII (telefon/mejl)
   är tidsbunden — visas bara i driftfönstret kring bokningen.            */
const CUSTOMERS = [
  { id: "c1", fullName: "Anna Bergström", showAs: "full",    phone: "070-412 88 31", email: "anna.b@mail.se",   since: 2022, visits: 18, tier: "Guld",   points: 1840, favStaff: "Elin",    lastVisit: "8 maj 2026", consent: true,  pii: "öppet" },
  { id: "c2", fullName: "Johan Ek",        showAs: "first",   phone: "073-220 14 092",email: "johan.ek@mail.se", since: 2024, visits: 6,  tier: "Silver", points: 620,  favStaff: "Maja",    lastVisit: "21 apr 2026", consent: true,  pii: "öppet" },
  { id: "c3", fullName: "Sara Lind",       showAs: "initial", phone: "076-880 33 12", email: "sara.l@mail.se",   since: 2021, visits: 27, tier: "Guld",   points: 2710, favStaff: "Elin",    lastVisit: "14 maj 2026", consent: true,  pii: "skyddat" },
  { id: "c4", fullName: "Mikael Strand",   showAs: "full",    phone: "070-661 20 77", email: "m.strand@mail.se", since: 2025, visits: 3,  tier: "Brons",  points: 180,  favStaff: "Johanna", lastVisit: "2 apr 2026",  consent: false, pii: "gäst" },
  { id: "c5", fullName: "Lisa Nyqvist",    showAs: "first",   phone: "072-145 90 04", email: "lisa.n@mail.se",   since: 2023, visits: 11, tier: "Silver", points: 980,  favStaff: "Maja",    lastVisit: "29 mar 2026", consent: true,  pii: "öppet" },
  { id: "c6", fullName: "Erik Holm",       showAs: "full",    phone: "—",             email: "—",                since: 2026, visits: 1,  tier: "Ny",     points: 40,   favStaff: "Johanna", lastVisit: "—",           consent: true,  pii: "gäst" },
  { id: "c7", fullName: "Eva Karlsson",    showAs: "initial", phone: "070-339 71 55", email: "eva.k@mail.se",    since: 2020, visits: 34, tier: "Guld",   points: 3320, favStaff: "Elin",    lastVisit: "16 maj 2026", consent: true,  pii: "skyddat" },
];

/* display name resolved from privacy setting */
function custName(c) {
  if (!c) return "Okänd";
  if (c.showAs === "full") return c.fullName;
  if (c.showAs === "first") return c.fullName.split(" ")[0];
  const p = c.fullName.split(" ");
  return p[0][0] + ". " + (p[1] ? p[1][0] + "." : "");
}

/* ---- Tjänster + var de hamnar på storefronten (M6 → M2) ---- */
const SERVICES = [
  { id: "s1", name: "Klippning dam",          cat: "Klippning", price: 695,  dur: 60,  online: true,  section: "Dam",     bookings: 96, popular: true },
  { id: "s2", name: "Klippning herr",         cat: "Klippning", price: 545,  dur: 45,  online: true,  section: "Herr",    bookings: 78, popular: true },
  { id: "s3", name: "Färg & slingor",         cat: "Färg",      price: 1450, dur: 120, online: true,  section: "Färg",    bookings: 41, popular: false },
  { id: "s4", name: "Styling & uppsättning",  cat: "Styling",   price: 850,  dur: 60,  online: true,  section: "Styling", bookings: 22, popular: false },
  { id: "s5", name: "Barn (t.o.m. 12 år)",    cat: "Klippning", price: 345,  dur: 30,  online: true,  section: "Dam",     bookings: 17, popular: false },
  { id: "s6", name: "Skägg & putsning",       cat: "Skägg",     price: 320,  dur: 30,  online: false, section: "Dold",    bookings: 0,  popular: false },
];

/* ---- Personal — rik info + verklig dag (M6 → M5) ---- */
const STAFF = [
  { id: "st1", name: "Elin Sandberg", role: "Salongschef · Färgspecialist", color: "#1F4636", services: 5, bio: "Driver Studio Salvia sedan 2019. Balayage och mjuka övergångar.", specialties: ["Balayage", "Färg", "Klippning dam"], location: "Storgatan", week: 23 },
  { id: "st2", name: "Johanna Vik",   role: "Frisör · Stylist",            color: "#2E7D5B", services: 4, bio: "Stylist med fokus på uppsättningar och bröllop.", specialties: ["Styling", "Uppsättning", "Klippning herr"], location: "Storgatan", week: 23 },
  { id: "st3", name: "Maja Lund",     role: "Frisör",                      color: "#B5760A", services: 3, bio: "Snabb och precis på herrklippning och skägg.", specialties: ["Klippning herr", "Skägg", "Barn"], location: "Storgatan", week: 23 },
];

/* ---- Bokningar (seed för runtime-store). status: gjord | klar | avbokad ----
   tid passerad + ej klarmarkerad → auto-klar (visas, försvinner aldrig).      */
const BOOKINGS = [
  { id: "b1", time: "09:00", end: "10:00", dur: 60, day: TODAY, customerId: "c1", serviceId: "s1", service: "Klippning dam",  staffId: "st1", staff: "Elin",    status: "klar",    paid: true,  channel: "online",  madeAt: "28 maj", notes: [] },
  { id: "b2", time: "10:30", end: "11:15", dur: 45, day: TODAY, customerId: "c2", serviceId: "s2", service: "Klippning herr", staffId: "st3", staff: "Maja",    status: "klar",    paid: true,  channel: "online",  madeAt: "30 maj", notes: [{ from: "kund", text: "Kan ni ta lite extra på sidorna?", at: "idag 08:12" }] },
  { id: "b3", time: "11:30", end: "13:30", dur: 120,day: TODAY, customerId: "c3", serviceId: "s3", service: "Färg & slingor",  staffId: "st1", staff: "Elin",    status: "gjord",   paid: false, channel: "online",  madeAt: "21 maj", notes: [{ from: "kund", text: "Vill gå lite ljusare än sist.", at: "igår 19:40" }] },
  { id: "b4", time: "13:30", end: "14:15", dur: 45, day: TODAY, customerId: "c4", serviceId: "s2", service: "Klippning herr", staffId: "st2", staff: "Johanna", status: "gjord",   paid: false, channel: "drop-in", madeAt: "idag",   notes: [] },
  { id: "b5", time: "14:30", end: "15:30", dur: 60, day: TODAY, customerId: "c5", serviceId: "s4", service: "Styling",        staffId: "st3", staff: "Maja",    status: "gjord",   paid: false, channel: "online",  madeAt: "1 jun",  notes: [] },
  { id: "b6", time: "16:00", end: "16:30", dur: 30, day: TODAY, customerId: "c6", serviceId: "s5", service: "Barn",           staffId: "st2", staff: "Johanna", status: "gjord",   paid: false, channel: "online",  madeAt: "27 maj", notes: [] },
  { id: "b7", time: "17:00", end: "18:00", dur: 60, day: TODAY, customerId: "c7", serviceId: "s1", service: "Klippning dam",  staffId: "st1", staff: "Elin",    status: "avbokad", paid: false, channel: "online",  madeAt: "18 maj", notes: [{ from: "system", text: "Avbokad av kund 1 jun — tiden åter på storefront.", at: "1 jun 22:10" }] },
];

/* kundens egna kommande bokningar (för kundportalen — delar id med store) */
const MY_UPCOMING = ["b3"];      // Sara Lind (c3) är inloggad kund i demon
const MY_HISTORY = [
  { date: "14 maj 2026", service: "Färg & slingor", staff: "Elin", price: 1450, points: 145 },
  { date: "2 apr 2026",  service: "Klippning dam",  staff: "Elin", price: 695,  points: 70 },
  { date: "9 feb 2026",  service: "Färg & slingor", staff: "Elin", price: 1450, points: 145 },
];

/* ---- Schema: explicita bokbara starttider (ojämna intervall tillåtna) ---- */
const WEEK_DAYS = [
  { day: "Mån", date: "1" }, { day: "Tis", date: "2", today: true }, { day: "Ons", date: "3" },
  { day: "Tor", date: "4" }, { day: "Fre", date: "5" }, { day: "Lör", date: "6" }, { day: "Sön", date: "7", closed: true },
];
const SLOT_TEMPLATE = {
  "Mån": ["09:00", "09:45", "10:45", "12:30", "13:15", "14:00", "15:30"],
  "Tis": ["09:00", "10:30", "11:30", "13:30", "14:30", "16:00", "17:00"],
  "Ons": ["09:30", "10:15", "12:00", "13:00", "14:00", "15:00"],
  "Tor": ["09:00", "10:00", "11:00", "13:00", "14:30", "16:00"],
  "Fre": ["10:00", "11:00", "12:00", "13:30", "15:00"],
  "Lör": ["10:00", "11:00", "12:00", "13:00"],
  "Sön": [],
};

/* ---- Dashboard (kontrollcenter) ---- */
const SERVICE_MIX = [
  { name: "Klippning dam",  pct: 38, color: "#1F4636" },
  { name: "Klippning herr", pct: 28, color: "#2E7D5B" },
  { name: "Färg & slingor", pct: 18, color: "#F5A623" },
  { name: "Styling",        pct: 10, color: "#B5760A" },
  { name: "Övrigt",         pct: 6,  color: "#C9C2B4" },
];
const PEAK_HOURS = [
  { h: "09", n: 3 }, { h: "10", n: 5 }, { h: "11", n: 6 }, { h: "12", n: 2 },
  { h: "13", n: 4 }, { h: "14", n: 7 }, { h: "15", n: 5 }, { h: "16", n: 6 }, { h: "17", n: 4 },
];

/* ---- Kund-profil: det som gör att frisören "har koll" (röd tråd) ----
   Samma prefs/minne syns för frisören (igenkänning) OCH speglas mjukt mot
   kunden i portalen ("det här vet Elin om dig"). memo = frisörens privata
   notering. style = sparade referenser/looks. cadence = besöksrytm (veckor). */
const CUST_PROFILE = {
  c1: { prefs: ["Mjuka övergångar", "Går gärna ljusare"], memo: "Vill ha mjukare balayage nästa gång. Dottern Vera börjar klippa sig här med.", cadence: 8, drink: "Kaffe, svart", since: 2022, style: ["Balayage maj-26", "Inspo du delade"] },
  c2: { prefs: ["Kort på sidorna", "Lite längre upptill"], memo: "Snabb i stolen, gillar att prata innebandy.", cadence: 5, drink: "Vatten", since: 2024, style: [] },
  c3: { prefs: ["Mjuka övergångar", "Går gärna ljusare", "Naturligt resultat"], memo: "Siktar på en mjukare balayage — har en idé till nästa gång. Känslig hårbotten, ljummet vatten.", cadence: 9, drink: "Kaffe, svart", since: 2021, style: ["Färg & slingor · maj-26", "Inspo: mjuk ljusbrun", "Uppsättning · feb-26"] },
  c4: { prefs: ["Skägg putsas kort"], memo: "Ny kund, trevlig. Föreslå skäggvård.", cadence: 6, drink: "—", since: 2025, style: [] },
  c5: { prefs: ["Mycket volym", "Stora lockar"], memo: "Bröllop i augusti — boka provstyling i juli.", cadence: 7, drink: "Te", since: 2023, style: ["Provstyling"] },
  c6: { prefs: [], memo: "", cadence: 0, drink: "—", since: 2026, style: [] },
  c7: { prefs: ["Naturlig färg", "Inga starka dofter"], memo: "Föredrar förmiddagstider.", cadence: 6, drink: "Kaffe med mjölk", since: 2020, style: [] },
};

window.BO = {
  TODAY, SALONS, CUSTOMERS, SERVICES, STAFF, BOOKINGS,
  MY_UPCOMING, MY_HISTORY, WEEK_DAYS, SLOT_TEMPLATE, SERVICE_MIX, PEAK_HOURS,
  custName, CUST_PROFILE,
};
