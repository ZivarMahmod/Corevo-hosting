# Corevo Engine Stack

Beslutad 2026-08-14. Detta dokument kompletterar
`multibransch-plattform-arkitektur.md`; den filen är fortsatt produktens
överordnade arkitekturkanon.

## Beslut

Corevo behåller sin produkt-, tenant- och domänmotor. Generisk
plattformsmekanik läggs under eller bredvid den befintliga Next.js-appen genom
smala, fail-closed integrationer:

| Område | Motor | Corevos kvarvarande ägare |
|---|---|---|
| Adminresurs och mutationsstate | Refine Core + TanStack Query | server actions, guards, RLS och befintligt UI |
| Formulärvalidering | React Hook Form + Zod | domämschema och svensk feltext |
| Generiska bakgrundsjobb | Supabase Queues/PGMQ + Cloudflare scheduler | job union, effekter och driftgrindar |
| Loggar och tracing | Cloudflare native logs; native tracing uppskjuten | redaktion, eventnamn och Sentry-fallback |
| Plattformsfakturor | Stripe Billing/Invoicing | prismodell, ledger, operatörsgrind och Connect-separation |

Refine får aldrig direkt tabellåtkomst. Data providern anropar bara godkända
Corevo-serverägare. Klienten skickar aldrig ett auktoritativt `tenantId`.
Serverguards och RLS är alltid säkerhetsfacit; Refines accesskontroll styr bara
vad gränssnittet visar.

## Ägargränser

Följande ersätts inte: bokningsregler, tenantmodell, RLS,
`notifications_outbox`, `payment_refund_jobs`, Stripe Connect, mediaflöden,
storefront, produkter och Corevos UX. Bokningar, kunder, personal, tenants och
site editor blir inte generisk CRUD.

Varje motor får ett tydligt ansvar och en befintlig Corevo-ägare som adapter.
Okända resurser, actions, jobbversioner och jobbtyper nekas. Ingen motor får
skapa en parallell auth-, tenant-, billing- eller domänmodell.

## Införanderegel

Motorerna införs i ordningen observability, tjänsteadministration, generiska
jobb och fakturautkast. Varje fas verifieras, mergas, migreras vid behov och
deployas innan nästa fas börjar. Databasförändringar är additiva och kompatibla
med föregående appversion under utrullningen.

Cloudflare invocation logs och native traces är avstängda så länge replaybara
gäst- och kundcapabilities finns i URL:er. Tracing är fortsatt målarkitektur,
men aktiveras först när capabilities har flyttats bort från URL:er eller en
verifierad redaktion före Cloudflares persistens finns.

Nya abonnemangskostnader, destruktiv cleanup, secret-rotation,
fakturafinalisering, DNS och tenantavstängning ligger utanför beslutet.
