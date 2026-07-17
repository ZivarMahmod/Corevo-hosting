# Modulkarta — Corevo

Corevo är en generell multi-bransch-plattform. Produktens fulla arkitektur finns i
`01-arkitektur/multibransch-plattform-arkitektur.md`; denna fil är bara ingången.

## Plattformskärna

- Multi-tenant, roller, RLS, platsbehörighet och audit.
- Modulkatalog och tenantstyrd aktivering.
- Domänupplösning, tema, innehåll, media och publicering.
- Betalningar, drift, observability och säkerhetsgrindar.

## Aktiverbara verksamhetsmoduler

- Bokning, schema, personal, kunder och lojalitet.
- Webshop, order, presentkort och betalning.
- Offert, fordon, inlämning/intag och återkommande uppdrag.
- Blogg, meny, portfolio, galleri, kurser och övrigt tenantinnehåll.

En tenant får bara de moduler som är aktiverade. En implementation får aldrig göra
en enskild branschs ord, data eller navigering till plattformsstandard.

## Arbetsingångar

- Aktuell ordning: `../2-Byggplan/ROADMAP.md`
- Designlag: `../4-Dokument-Underlag/01-acceptans/`
- Kod: `../5-Kod/`
- Manuell verifiering: `../6-Testing/`
