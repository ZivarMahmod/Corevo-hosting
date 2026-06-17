/* =====================================================================
   KUND-ADMIN — DATA SPINE (modul-driven)
   ---------------------------------------------------------------------
   Poängen: kundens admin är INTE salongsspecifik. Den byggs av de
   MODULER som valdes i onboarding. Aktiverar du Webshop i onboarding →
   "Produkter" + "Ordrar" tänds i adminen. Stänger du av en modul →
   dess ytor släcks. Detta speglar tenant_modules.state (live/draft/off).

   Allt här är DEMO-data (i minnet). I prod kommer det ur Postgres via RLS.
   Väljaren högst upp i adminen = simulera onboarding-utfallet.
   ===================================================================== */

/* ---- branschpresets: exakt vad onboarding föraktiverar (verticals) ---- */
const PRESETS = {
  frisör:     { name: "FreshCut", staffWord: "Stylist", serviceWord: "Behandling", serviceLabel: "Tjänster", modules: { booking: "live", lojalitet: "live", presentkort: "draft", shop: "off", offert: "off", blogg: "off" } },
  restaurang: { name: "Leander", staffWord: "Personal", serviceWord: "Rätt", serviceLabel: "Meny", unit: "bord", modules: { booking: "live", meny: "live", presentkort: "draft", lojalitet: "off", shop: "off", blogg: "off" } },
  florist:    { name: "Blomstra", staffWord: "Florist", serviceWord: "Tjänst", serviceLabel: "Tjänster", modules: { booking: "live", shop: "live", offert: "live", presentkort: "draft", lojalitet: "off", blogg: "off" } },
  bilverkstad:{ name: "Motorhället", staffWord: "Mekaniker", serviceWord: "Servicetyp", serviceLabel: "Tjänster", modules: { booking: "live", offert: "live", fordon: "live", orderstatus: "live", shop: "off", lojalitet: "off" } },
  generell:   { name: "Ditt företag", staffWord: "Personal", serviceWord: "Tjänst", serviceLabel: "Tjänster", modules: { booking: "live", shop: "off", offert: "off", lojalitet: "off", presentkort: "off", blogg: "off" } },
};

/* ---- modul-register: vilka ADMIN-ytor varje modul tänder ----
   surface = en sida i vänsternavet. position: 'main' moduler styr
   storefront-sektioner; 'konto' moduler styr Mitt konto-data.        */
const MODULE_DEFS = {
  booking:     { name: "Bokning", pos: "main", core: true, surfaces: [
                   { key: "bokningar", label: "Bokningar", icon: "calendar" },
                   { key: "tjanster", label: "{serviceLabel}", icon: "scissors" },
                   { key: "personal", label: "Personal", icon: "users" },
                   { key: "schema", label: "Schema", icon: "clock" },
                 ], tables: ["bookings", "services", "staff", "working_hours"] },
  shop:        { name: "Webshop", pos: "main", surfaces: [
                   { key: "produkter", label: "Produkter", icon: "bookmark" },
                   { key: "ordrar", label: "Ordrar", icon: "creditCard" },
                 ], tables: ["shop_products", "shop_orders"] },
  offert:      { name: "Offert", pos: "main", surfaces: [{ key: "offerter", label: "Offerter", icon: "message" }], tables: ["offert_requests"] },
  lojalitet:   { name: "Lojalitet", pos: "main", surfaces: [{ key: "stammis", label: "Stammis", icon: "heart" }], tables: ["loyalty_ledger"] },
  presentkort: { name: "Presentkort", pos: "main", surfaces: [{ key: "presentkort", label: "Presentkort", icon: "gift" }], tables: ["gift_cards"] },
  meny:        { name: "Meny", pos: "main", surfaces: [{ key: "meny", label: "Meny", icon: "menu" }], tables: ["menu_items"] },
  blogg:       { name: "Blogg", pos: "main", surfaces: [{ key: "blogg", label: "Journal", icon: "edit" }], tables: ["blog_posts"] },
  fordon:      { name: "Fordon", pos: "konto", surfaces: [{ key: "fordon", label: "Fordon", icon: "settings" }], tables: ["vehicle_profiles"] },
  orderstatus: { name: "Orderstatus", pos: "konto", surfaces: [{ key: "orderstatus", label: "Orderstatus", icon: "checkCircle" }], tables: ["work_orders"] },
};

/* core-ytor som ALLTID finns (plattform, inte modul) */
const CORE_TOP = [{ key: "dashboard", label: "Översikt", icon: "home" }];
const CORE_BOTTOM = [
  { key: "kunder", label: "Kunddatabas", icon: "user" },
  { key: "varumarke", label: "Varumärke", icon: "palette" },
  { key: "installningar", label: "Inställningar", icon: "settings" },
];

/* ---- mock-innehåll per yta (byts mot DB-rader i prod) ---- */
const MOCK = {
  bokningar: [
    { time: "Idag 09:00", customer: "Anna L.", service: "Klippning dam", staff: "Maja", status: "klar", price: 595, paid: true, dur: 45, booked: "3 dgr sen", phone: "070-123 45 67" },
    { time: "Idag 11:30", customer: "Lina K.", service: "Färg & klippning", staff: "Maja", status: "gjord", price: 1295, paid: false, dur: 60, booked: "5 dgr sen", phone: "073-222 11 00" },
    { time: "Idag 13:00", customer: "Omar H.", service: "Klippning herr", staff: "Johanna", status: "gjord", price: 495, paid: false, dur: 45, booked: "idag", phone: "076-555 44 33" },
    { time: "Idag 14:30", customer: "Sara N.", service: "Lugg/puts", staff: "Maja", status: "avbokad", price: 250, paid: false, dur: 30, booked: "2 dgr sen", phone: "070-333 22 11" },
    { time: "Imorgon 09:30", customer: "Peter S.", service: "Färg & klippning", staff: "Johanna", status: "gjord", price: 1295, paid: false, dur: 60, booked: "idag", phone: "070-111 99 88" },
  ],
  services: [
    { name: "Klippning dam", dur: 45, price: 595, cat: "Klippning", active: true, n: 42 },
    { name: "Klippning herr", dur: 45, price: 495, cat: "Klippning", active: true, n: 58 },
    { name: "Färg & klippning", dur: 60, price: 1295, cat: "Färg", active: true, n: 24 },
    { name: "Slingor", dur: 90, price: 1850, cat: "Färg", active: true, n: 12 },
    { name: "Skägg & trim", dur: 30, price: 320, cat: "Skägg", active: true, n: 31 },
  ],
  staff: [
    { name: "Maja Sjögren", role: "Senior {staffWord}", bio: "Specialist på färg och balayage. 12 år i yrket.", services: ["Klippning dam", "Färg & klippning", "Slingor"], today: 3, active: true },
    { name: "Johanna Ek", role: "{staffWord} & barberare", bio: "Herrklippning och skägg. Utbildad i London.", services: ["Klippning herr", "Skägg & trim"], today: 2, active: true },
    { name: "Vakant tjänst", role: "Junior {staffWord}", bio: "Plats för ny medarbetare.", services: [], today: 0, active: false },
  ],
  schedule: {
    Måndag: ["09:00", "09:45", "10:30", "11:30", "13:00", "13:45", "14:30", "15:30"],
    Tisdag: ["09:00", "09:45", "10:30", "11:30", "13:00", "13:45", "14:30", "15:30"],
    Onsdag: ["10:00", "10:45", "11:30", "13:00", "14:00", "15:00"],
    Torsdag: ["09:00", "09:45", "10:30", "11:30", "13:00", "13:45", "14:30", "15:30", "16:30"],
    Fredag: ["09:00", "10:00", "11:00", "12:00", "13:30", "14:30"],
    Lördag: ["10:00", "11:00", "12:00", "13:00"],
    Söndag: [],
  },
  customers: [
    { display: "Anna L.", full: "Anna Lindqvist", visits: 14, last: "Idag", loyalty: 6, pii: "070-123 45 67 · anna@…", returning: true },
    { display: "Erik S.", full: "Erik Sandberg", visits: 9, last: "Igår", loyalty: 4, pii: "070-987 65 43 · erik@…", returning: true },
    { display: "Lina K.", full: "Lina Karlsson", visits: 22, last: "Idag", loyalty: 9, pii: "073-222 11 00 · lina@…", returning: true },
    { display: "Omar H.", full: "Omar Haddad", visits: 3, last: "Idag", loyalty: 2, pii: "076-555 44 33 · omar@…", returning: true },
    { display: "Gäst", full: "Sara Nilsson", visits: 1, last: "Avbokad", loyalty: 0, pii: "maskerad (gäst)", returning: false },
  ],
  products: [
    { name: "Schampo · Repair", price: 249, stock: 18, cat: "Hårvård" },
    { name: "Balsam · Volume", price: 229, stock: 12, cat: "Hårvård" },
    { name: "Stylingvax · Matt", price: 189, stock: 30, cat: "Styling" },
    { name: "Presentpåse · Liten", price: 99, stock: 8, cat: "Övrigt" },
  ],
  orders: [
    { id: "#1042", customer: "Anna L.", items: 2, total: 478, status: "Ny", fulfil: "Hämtas i salong" },
    { id: "#1041", customer: "Lina K.", items: 1, total: 249, status: "Packad", fulfil: "Hämtas i salong" },
    { id: "#1040", customer: "Erik S.", items: 3, total: 667, status: "Hämtad", fulfil: "Hämtad" },
  ],
  offers: [
    { customer: "Lina K.", what: "Bröllop · 4 personer uppsättning", status: "Ny", when: "2h sen" },
    { customer: "Företag AB", what: "Klippkort 10 anställda", status: "Besvarad", when: "igår" },
  ],
  loyalty: [
    { customer: "Lina K.", stamps: "9 / 10", last: "Idag" },
    { customer: "Anna L.", stamps: "6 / 10", last: "Idag" },
    { customer: "Omar H.", stamps: "2 / 10", last: "Idag" },
  ],
  giftcards: [
    { code: "FC-2026-A1", value: 500, balance: 500, sold: "3 dgr sen", status: "Aktivt" },
    { code: "FC-2026-B7", value: 1000, balance: 350, sold: "2 v sen", status: "Delvis använt" },
  ],
  vehicles: [
    { customer: "Anna L.", reg: "ABC 123", car: "Volvo V60", year: 2019 },
    { customer: "Erik S.", reg: "XYZ 789", car: "VW Golf", year: 2021 },
  ],
  workorders: [
    { id: "#1042", what: "Service · Volvo V60", status: "Under arbete" },
    { id: "#1041", what: "Bromsbyte", status: "Klar för hämtning" },
    { id: "#1040", what: "Däckskifte", status: "Mottagen" },
  ],
};

const BRAND_PRESETS = ["#1F4636", "#3A6B52", "#8B5E3C", "#9C5F3F", "#2C4A6E", "#5A4A7A"];

const SETTINGS = [
  { key: "confirm", title: "Bokningsbekräftelse via SMS", desc: "Kunden får SMS när bokning skapas.", on: true },
  { key: "reminder", title: "Påminnelse 24h innan", desc: "Automatiskt SMS dagen före.", on: true },
  { key: "cancel", title: "Tillåt avbokning online", desc: "Kund kan avboka själv → tiden tillbaka till storefront.", on: true },
  { key: "autoComplete", title: "Auto-markera klar", desc: "Bokning blir 'klar' när tiden passerat (försvinner aldrig).", on: true },
  { key: "waitlist", title: "Väntelista", desc: "Kund kan ställa sig i kö på fullbokade tider.", on: false },
];

window.ADMIN = { PRESETS, MODULE_DEFS, CORE_TOP, CORE_BOTTOM, MOCK, BRAND_PRESETS, SETTINGS };
