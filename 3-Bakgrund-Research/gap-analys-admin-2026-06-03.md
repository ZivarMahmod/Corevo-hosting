# Gap-analys — vad en multi-tenant booking-SaaS bör ha som Corevo (ännu) saknar
Datum: 2026-06-03 · Källa: research-runda (web) vägd mot Corevos faktiska bygge (HANDOFF).

> Syfte: hitta det viktiga vi saknar, prioriterat. Inte "allt artiklar säger är sant" — bara det som passar VÅR sak (salong, Sverige, Next.js + Supabase RLS + Cloudflare Workers + Stripe Connect, white-label).

## ✅ Det vi redan gör bra (behåll — bekräftat mot best practice)
- **Tenant-isolering på DB-nivå** (RLS + `private.tenant_id()`) — research rankar detta som #1; vi gör det rätt (inte bara UI-filter).
- **EU-datahemvist** — Supabase `eu-north-1` = data i EU → stark GDPR-position (många missar detta).
- **Audit-logg** (append-only) · **rate-limiting** (login + bokning) · **säkerhetsheaders** (CSP/HSTS) · **secrets-skan** · **dubbelbokningsskydd** (EXCLUDE).
- **GDPR self-service** (export + radering, behåller betalningar ~7 år/Bokföringslagen).
- **Backup** (PITR + R2-versioning) · **mejl-bekräftelse + påminnelse-cron** · **strukturerad logg + Sentry-krok**.

## 🔴 MÅSTE (legal / säkerhet — högsta prio)
1. **Personuppgiftsbiträdesavtal (DPA)** — Corevo är *personuppgiftsbiträde* åt salongerna (de = ansvariga för sina kunders data). GDPR **kräver** ett DPA mellan Corevo och varje tenant. Vi har inget. → mall + accept i onboarding (super-admin) eller signerat dokument. *Detta är ett juridiskt krav, inte en feature.*
2. **SCA / 3D Secure verifierat** — kortbetalning i EES kräver Strong Customer Authentication. Stripe sköter mycket automatiskt, MEN M8 är oprövad live → **verifiera att PaymentIntent-flödet triggar 3DS korrekt** (annars failar betalningar eller tappar ansvarsförskjutningen vid tvist). Hör hemma i Stripe-verifieringen.
3. **MFA/2FA — åtminstone för super_admin** — research: "non-negotiable" för admin. En super_admin-läcka = alla salonger. Saknas idag (2FA "planerat").
4. **Dispute/chargeback-webhook** — vi hanterar `charge.refunded` men inte `charge.dispute.*`. En bestriden betalning ska fångas + bokningen markeras. Glapp.

## 🟠 PRODUKTVÄRDE (booking-specifikt — det här SÄLJER + skyddar salongens intäkt)
5. **Depositioner / no-show-avgift** — research: deposit vid bokning sänker no-shows dramatiskt (en leverantör: −71% med påminnelser + deposit + väntelista). Vi har betalning men ingen "betala deposit för att boka". Stor värde-lucka.
6. **Avbokningspolicy som tvingas** — obligatoriskt att acceptera policy före bokning + avgift enforced inom fönstret. Vi har avboknings-fönster men inte policy-accept + avgift.
7. **Väntelista** — kund kryssar "meddela mig vid tidigare tid"; fyller luckor automatiskt. Vanlig salongsfeature, saknas.
   *(Påminnelser har vi redan ✓.)*

## 🟡 DRIFT / SKALA (när fler salonger kommer på)
8. **Audit-logg som går att SE i UI** — vi loggar, men ingen kan läsa det. Koppar till "bokningar får inte tyst försvinna".
9. **Per-tenant hälsa/övervakning + larm** — research: övervaka varje tenant, larma vid problem/limit. Vi har ingen per-salong-övervakning.
10. **Testad restore (DR-drill)** — vi har PITR/R2, men har vi *provat* återställa? Research stressar testade restores + geo-spridda kopior. Kör en restore-drill en gång.
11. **Incident-playbook + status-sida** — definierade severity-nivåer + en publik status-sida (förtroende när en salongssida är nere). Vi har `backup-restore.md`, utöka.
12. **Pentest-kadens** — vi kör interna adversariella reviews (bra), men ingen extern/strukturerad pentest. Bra att veta inför försäljning till större kunder (+ SOC 2 om B2B-kunder kräver det — troligen för tidigt nu).

## Hur detta möter WORKFLOW-03
- VÅG 1 (rollgränser) + VÅG 5 (mangling) täcker #3-route-delen + #8-spårbarhet delvis.
- #4 (dispute) + #2 (SCA) hör till Stripe-verifieringen (gatad på test-nycklar).
- Resten (#1 DPA, #5–7 booking-value, #9–12 drift) = nya kort EFTER baseline. **Inte baka in i WF-03** — den är redan full; dessa planeras separat.

## Källor
- [Secure Multi-Tenancy checklist — DZone](https://dzone.com/articles/secure-multi-tenancy-saas-developer-checklist) · [Multi-tenant SaaS security — esso.dev](https://esso.dev/blog-posts/multi-tenant-saa-s-security-best-practices-guide) · [Multitenancy checklist — Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/checklist)
- [Salon booking features — GlossGenius](https://glossgenius.com/blog/appointment-booking-apps) · [Square Salon](https://squareup.com/us/en/beauty/salons) · [Booksy Biz](https://biz.booksy.com/en-us)
- [Data Protection Sweden 2026 — Chambers](https://practiceguides.chambers.com/practice-guides/data-protection-privacy-2026/sweden) · [IMY — rights](https://www.imy.se/en/individuals/data-protection/your-rights-as-a-data-subject/) · [verksamt.se — personal data](https://verksamt.se/en/agreement-invoicing/personal-data)
- [Stripe SCA guide](https://stripe.com/guides/strong-customer-authentication) · [Stripe Connect refunds & disputes](https://docs.stripe.com/connect/marketplace/tasks/refunds-disputes) · [Stripe Connect risk](https://docs.stripe.com/connect/risk-management)
- [SaaS DR guide — Phoenix Strategy](https://www.phoenixstrategy.group/blog/disaster-recovery-for-saas-companies-guide) · [SaaS status page — Watchman Tower](https://www.watchmantower.com/blog/saas-status-page-importance) · [Incident mgmt SaaS — Azure WAF](https://learn.microsoft.com/en-us/azure/well-architected/saas/incident-management)
