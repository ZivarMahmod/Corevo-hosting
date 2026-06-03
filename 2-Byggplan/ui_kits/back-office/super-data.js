/* =====================================================================
   Corevo SUPER ADMIN (M7) — demo data.
   "Supabase-kraft med mitt UI" — operativ datakontroll utan kod.
   Allt här mappar mot riktiga tabeller/flöden i backenden:
     tenants · tenant_settings · customers · staff · staff_services ·
     working_hours · time_off · locations · audit_log · billing (flöde 2)
   Top-tier i två-nivå-modellen: ägaren = leksakslådan, Zivar = full kontroll.
   ===================================================================== */

/* ---- Rik tenant-data (utöver SALONS i data.js) — nyckel = sub-slug ---- */
const SU_TENANTS = {
  salvia: {
    slug: "salvia", name: "Studio Salvia", owner: "Elin Sandberg", ownerEmail: "elin@studiosalvia.se",
    ownerPhone: "070-412 88 31", city: "Linköping", status: "Aktiv", theme: "Salvia", variant: "Steg-för-steg",
    billing: "per_booking", rate: 4, bookings: 312, completed: 287, staff: 3, locations: 1, customers: 412,
    created: "12 jan 2024", lastActive: "för 4 min", onboardStep: 6, reviewLink: "g.page/studiosalvia",
    stripe: "Ansluten", sms: "På", domain: "subdomän", domainStatus: "Aktiv", dot: "#5E7361",
    level: 2, hueNote: "Token-branding (no-code) aktiv · nivå-3 overrides via kod",
  },
  leander: {
    slug: "leander", name: "Maison Leander", owner: "Sofia Leander", ownerEmail: "sofia@maisonleander.se",
    ownerPhone: "073-118 40 22", city: "Linköping", status: "Aktiv", theme: "Leander", variant: "Drawer",
    billing: "per_booking", rate: 4, bookings: 488, completed: 451, staff: 5, locations: 2, customers: 690,
    created: "3 mar 2024", lastActive: "för 1 tim", onboardStep: 6, reviewLink: "g.page/maisonleander",
    stripe: "Ansluten", sms: "På", domain: "subdomän", domainStatus: "Aktiv", dot: "#7E6E92",
    level: 3, hueNote: "Premium nivå-3 scoped CSS-overrides (kod i säker miljö)",
  },
  zigge: {
    slug: "zigge", name: "Zigge", owner: "Ziggy Demir", ownerEmail: "ziggy@zigge.se",
    ownerPhone: "076-900 11 27", city: "Linköping", status: "Aktiv", theme: "Zigge", variant: "Kompakt",
    billing: "flat_monthly", rate: 0, flat: 1490, bookings: 701, completed: 668, staff: 4, locations: 2, customers: 904,
    created: "21 nov 2023", lastActive: "för 12 min", onboardStep: 6, reviewLink: "g.page/zigge",
    stripe: "Ansluten", sms: "På", domain: "egen domän", domainStatus: "Väntar DNS", dot: "#C8743C",
    level: 2, hueNote: "Token-branding aktiv · egen domän under provisionering (parkerat spår)",
  },
  klippoteket: {
    slug: "klippoteket", name: "Klippoteket", owner: "Petra Holm", ownerEmail: "petra@klippoteket.se",
    ownerPhone: "070-220 65 18", city: "Norrköping", status: "Pausad", theme: "Salvia", variant: "Steg-för-steg",
    billing: "per_booking", rate: 4, bookings: 54, completed: 49, staff: 2, locations: 1, customers: 88,
    created: "9 feb 2025", lastActive: "för 18 dagar", onboardStep: 6, reviewLink: "—",
    stripe: "Frånkopplad", sms: "Av", domain: "subdomän", domainStatus: "Pausad", dot: "#5E7361",
    level: 1, hueNote: "Suspenderad → publik storefront blockerad. Data orörd.",
  },
  barberco: {
    slug: "barberco", name: "Barber & Co", owner: "Markus Falk", ownerEmail: "markus@barberco.se",
    ownerPhone: "073-455 90 71", city: "Jönköping", status: "Aktiv", theme: "Zigge", variant: "Snabbboka",
    billing: "per_booking", rate: 4, bookings: 367, completed: 340, staff: 3, locations: 1, customers: 503,
    created: "30 maj 2024", lastActive: "för 2 tim", onboardStep: 6, reviewLink: "g.page/barberco",
    stripe: "Ansluten", sms: "På", domain: "subdomän", domainStatus: "Aktiv", dot: "#C8743C",
    level: 2, hueNote: "Token-branding aktiv",
  },
  nord: {
    slug: "nord", name: "Salong Nord", owner: "Ida Ek", ownerEmail: "ida@salongnord.se",
    ownerPhone: "076-771 30 09", city: "Linköping", status: "Onboarding", theme: "Leander", variant: "Steg-för-steg",
    billing: "per_booking", rate: 4, bookings: 0, completed: 0, staff: 1, locations: 1, customers: 0,
    created: "2 jun 2026", lastActive: "för 1 dag", onboardStep: 3, reviewLink: "—",
    stripe: "Ej påbörjad", sms: "Av", domain: "subdomän", domainStatus: "Ej satt", dot: "#7E6E92",
    level: 1, hueNote: "Mitt i onboarding (steg 3/6). Inga forcerade måste-fält.",
  },
};

/* deriveOnboarding — 6 stegs-stege (M7). steg 5 (egen domän) spärrat/UI-only. */
const SU_ONBOARD_STEPS = [
  { key: "skapa",     label: "Skapa tenant",     hint: "slug + settings + ägarroll (atomiskt)" },
  { key: "tema",      label: "Temamall + variant",hint: "nav/hero-variant + bokningsvariant" },
  { key: "branding",  label: "Token-branding",   hint: "färg/font/logo — no-code" },
  { key: "personal",  label: "Personal",         hint: "invite-flöde (magic-link)" },
  { key: "domän",     label: "Egen domän",       hint: "spärrat — subdomän räcker tills vidare", locked: true },
  { key: "live",      label: "Live",             hint: "storefront publik" },
];

/* ---- Bokningsvarianter (kopplar M3 + design booking-variants/*) ---- */
const SU_VARIANTS = [
  { id: "wizard",  name: "Steg-för-steg", tag: "Standard", desc: "En sak per skärm, störst träffyta. Bäst på mobil (99% av bokningar).", rec: true },
  { id: "compact", name: "Snabbboka",     tag: "Genväg",   desc: "Kompakt — för stamkunder som vet vad de vill.", rec: false },
  { id: "drawer",  name: "Drawer",        tag: "Desktop",  desc: "Bokningen glider in 'inuti' sidan. Snyggast på desktop.", rec: false },
  { id: "inline",  name: "Inline-sektion",tag: "Native",   desc: "Scrollar in i sidan, allt staplat i ett svep.", rec: false },
];

/* ---- Cross-tenant kundsök (operativ data-kontroll §2.1B) ---- */
const SU_CUSTOMERS = [
  { id: "u1", name: "Anna Bergström", email: "anna.b@mail.se", phone: "070-412 88 31", tenant: "Studio Salvia", slug: "salvia", role: "Kund", auth: "Lösenord", visits: 18, status: "Aktiv", lastLogin: "8 maj 2026" },
  { id: "u2", name: "Sofia Leander", email: "sofia@maisonleander.se", phone: "073-118 40 22", tenant: "Maison Leander", slug: "leander", role: "Ägare", auth: "Lösenord", visits: 0, status: "Aktiv", lastLogin: "idag 07:40" },
  { id: "u3", name: "Ziggy Demir", email: "ziggy@zigge.se", phone: "076-900 11 27", tenant: "Zigge", slug: "zigge", role: "Ägare", auth: "Lösenord", visits: 0, status: "Aktiv", lastLogin: "idag 09:02" },
  { id: "u4", name: "Sara Lind", email: "sara.l@mail.se", phone: "076-880 33 12", tenant: "Studio Salvia", slug: "salvia", role: "Kund", auth: "Lösenord", visits: 27, status: "Skyddat namn", lastLogin: "14 maj 2026" },
  { id: "u5", name: "Erik Holm", email: "—", phone: "—", tenant: "Studio Salvia", slug: "salvia", role: "Gäst", auth: "Gäst-nyckel", visits: 1, status: "Gäst", lastLogin: "—" },
  { id: "u6", name: "Markus Falk", email: "markus@barberco.se", phone: "073-455 90 71", tenant: "Barber & Co", slug: "barberco", role: "Ägare", auth: "Lösenord", visits: 0, status: "Aktiv", lastLogin: "för 2 tim" },
  { id: "u7", name: "Lova Nyström", email: "lova.n@mail.se", phone: "072-145 90 04", tenant: "Zigge", slug: "zigge", role: "Kund", auth: "Lösenord", visits: 9, status: "Aktiv", lastLogin: "29 mar 2026" },
  { id: "u8", name: "Petra Holm", email: "petra@klippoteket.se", phone: "070-220 65 18", tenant: "Klippoteket", slug: "klippoteket", role: "Ägare", auth: "Lösenord", visits: 0, status: "Pausad", lastLogin: "för 18 dagar" },
];

/* ---- Personal tvärs tenants + invite-flöde (M6 §3.4 / M7 §2.4) ----
   magic-link = engångs-invite (kräver SERVICE_ROLE_KEY som Worker-secret). */
const SU_STAFF = [
  { id: "p1", name: "Elin Sandberg", email: "elin@studiosalvia.se", tenant: "Studio Salvia", slug: "salvia", role: "Salongschef", services: 5, status: "Aktiv", invited: "12 jan 2024" },
  { id: "p2", name: "Johanna Vik", email: "johanna@studiosalvia.se", tenant: "Studio Salvia", slug: "salvia", role: "Frisör", services: 4, status: "Aktiv", invited: "14 jan 2024" },
  { id: "p3", name: "Maja Lund", email: "maja@studiosalvia.se", tenant: "Studio Salvia", slug: "salvia", role: "Frisör", services: 3, status: "Aktiv", invited: "20 jan 2024" },
  { id: "p4", name: "Noor Haddad", email: "noor@maisonleander.se", tenant: "Maison Leander", slug: "leander", role: "Frisör", services: 0, status: "Inbjuden", invited: "för 2 dagar" },
  { id: "p5", name: "Theo Berg", email: "theo@zigge.se", tenant: "Zigge", slug: "zigge", role: "Barber", services: 3, status: "Aktiv", invited: "5 feb 2024" },
  { id: "p6", name: "Wilma Ahl", email: "wilma@salongnord.se", tenant: "Salong Nord", slug: "nord", role: "Frisör", services: 0, status: "Väntar bekräftelse", invited: "för 6 tim" },
];

/* ---- Audit-logg (drift §2.3). frisor3-radering BLOCKERAS med flit (guard). ---- */
const SU_AUDIT = [
  { at: "idag 09:14", actor: "Zivar", action: "Lösenordsreset skickad", target: "anna.b@mail.se · Studio Salvia", tone: "info", icon: "mail" },
  { at: "idag 08:52", actor: "System", action: "Bokning auto-klar", target: "11:30 Färg & slingor · Studio Salvia", tone: "neutral", icon: "clock" },
  { at: "idag 08:30", actor: "Zivar", action: "Google-recensionslänk satt", target: "Barber & Co", tone: "info", icon: "link" },
  { at: "igår 22:10", actor: "Kund", action: "Avbokning → tid åter på storefront", target: "17:00 · Studio Salvia", tone: "success", icon: "repeat" },
  { at: "igår 16:40", actor: "Zivar", action: "Radering BLOCKERAD av audit-guard", target: "frisor3 — skyddad rad (build-once-never-delete)", tone: "danger", icon: "shield" },
  { at: "igår 14:05", actor: "Zivar", action: "Tenant suspenderad", target: "Klippoteket → publik blockerad", tone: "warning", icon: "pause" },
  { at: "igår 11:20", actor: "Zivar", action: "Personal inbjuden (magic-link)", target: "noor@maisonleander.se", tone: "info", icon: "user" },
  { at: "2 jun 10:00", actor: "Zivar", action: "Tenant skapad (atomiskt)", target: "Salong Nord · nord.corevo.se", tone: "success", icon: "plus" },
];

/* ---- Integrationer (artiklarnas 'seamless integrations') ---- */
const SU_INTEGRATIONS = [
  { id: "stripe", name: "Stripe Connect", desc: "Betalning vid bokning + veckovis utbetalning per tenant.", status: "Aktiv", tenants: "21 / 24 anslutna", color: "#635BFF", letter: "S", flow: "Flöde 1 (kund betalar salongen direkt)" },
  { id: "google", name: "Google-recensioner", desc: "Recensionslänk per salong — visas i kundportal & bekräftelse.", status: "Aktiv", tenants: "19 / 24 satt", color: "#EA4335", letter: "G", flow: "tenant_settings.review_link" },
  { id: "sms", name: "SMS (46elks)", desc: "Bokningsbekräftelse + påminnelse 24 h innan.", status: "Aktiv", tenants: "20 / 24 på", color: "#1F4636", letter: "S", flow: "Kö via Worker · sann-kopplad toggle" },
  { id: "mail", name: "E-post (Resend)", desc: "Bekräftelser, invites, lösenordsreset.", status: "Aktiv", tenants: "Alla", color: "#0A0A0A", letter: "@", flow: "Transaktionell" },
  { id: "domain", name: "Cloudflare / Domän", desc: "Subdomän salong.corevo.se. Egen domän = parkerat spår.", status: "Delvis", tenants: "1 egen domän väntar", color: "#F38020", letter: "C", flow: "tenant_domains (saknar status-kolumn)" },
  { id: "pos", name: "Corevo POS", desc: "Kassakoppling på plats. Guardrail aktiv.", status: "Pilot", tenants: "2 i pilot", color: "#B5760A", letter: "P", flow: "POS-guardrail på corevo.se" },
];

/* ---- Roller & behörighet (RBAC — artiklarnas 'least privilege') ----
   private.tenant_id() isolerar tenant-data. Matris: ✓ full · ~ egen · — ingen */
const SU_PERMS = ["Tenants", "Kunder", "Bokningar", "Fakturering", "Branding", "Personal", "Drift"];
const SU_ROLES = [
  { name: "Super admin", who: "Zivar", users: 1, tone: "gold",    perms: ["full", "full", "full", "full", "full", "full", "full"], note: "Plattformsägare — full kontroll, kringgår tenant-isolering." },
  { name: "Salongsägare", who: "Ägare", users: 24, tone: "success", perms: ["—", "own", "own", "view", "own", "own", "—"], note: "Leksakslådan: full kontroll i egen tenant, ser aldrig andras." },
  { name: "Frisör", who: "Personal", users: 38, tone: "info",    perms: ["—", "view", "own", "—", "—", "—", "—"], note: "Egen dag + egna kunder. PII tidsbunden." },
  { name: "Support", who: "Corevo-team", users: 2, tone: "neutral", perms: ["view", "view", "view", "—", "—", "—", "view"], note: "Läsläge för felsökning. Kan trigga lösenordsreset." },
  { name: "Ekonomi", who: "Bokföring", users: 1, tone: "warning", perms: ["view", "—", "—", "full", "—", "—", "—"], note: "Endast faktureringsunderlag." },
];

/* ---- Plattformshälsa (dashboard-insyn §2.3) ---- */
const SU_HEALTH = [
  { label: "API-uptid", value: "99,98%", sub: "30 dagar", tone: "success" },
  { label: "Workers", value: "Frisk", sub: "alla regioner", tone: "success" },
  { label: "DB-pool", value: "34%", sub: "Supabase", tone: "success" },
  { label: "Köade SMS", value: "3", sub: "skickas nu", tone: "info" },
];
/* bokningstrend (12 mån) för översikt-drilldown */
const SU_TREND = [3120, 3340, 3580, 3910, 4205, 4480, 4760, 5010, 5290, 5610, 5980, 6240];

window.SU = {
  TENANTS: SU_TENANTS, ONBOARD_STEPS: SU_ONBOARD_STEPS, VARIANTS: SU_VARIANTS,
  CUSTOMERS: SU_CUSTOMERS, STAFF: SU_STAFF, AUDIT: SU_AUDIT,
  INTEGRATIONS: SU_INTEGRATIONS, PERMS: SU_PERMS, ROLES: SU_ROLES,
  HEALTH: SU_HEALTH, TREND: SU_TREND,
};
