# M2 – Publik webbplats (Salon Storefront)

> Källa: "Corevo Booking Platform - Modul 2.pdf"

## 1. Syfte
Salongens digitala skyltfönster. SEO-optimerad, snabbladdande webbplats som varje salong får automatiskt.
Det slutkunder ser när de googlar salongen. Mål: professionell webbnärvaro utan webbyrå.

## 2. Funktioner – v1 vs senare

| Funktion | v1? | Not |
|----------|-----|-----|
| Startsida (hero, tjänster, om oss, kontakt) | Ja | |
| Tjänstesida + tjänstedetalj | Ja | Lista med priser |
| Personalsida (team) | Ja | Visa stylister/barberare |
| Kontaktsida (adress, karta, öppettider) | Ja | |
| Galleri (bilder) | Ja | |
| Bokningsknapp (CTA → bokningsmotor M3) | Ja | |
| SEO (meta, sitemap, schema.org) | Ja | |
| Responsiv (mobil/tablet/desktop) | Ja | |
| Subdomän-routing (salong.corevo.se) | Ja | |
| Anpassad domän (egensalong.se) | Nej | v2 |
| Bloggfunktion | Nej | v2 |
| Flerspråksstöd (sv + en) | Nej | v2 |
| A/B-testning | Nej | v2 |
| Egen CSS-editor | Nej | v2 |

## 3. Vyer / sidor som ska byggas
- `/` – Startsida
- `/tjanster` – Tjänster
- `/tjanster/[slug]` – Tjänstedetalj
- `/personal` – Personal/Team
- `/om-oss` – Om salongen
- `/galleri` – Bildgalleri
- `/kontakt` – Kontakt + karta
- `/boka` – länk till bokningsmotor (M3)

## 4. Datatabeller modulen rör
Befintliga (läser): `salons`, `services`, `staff`, `salon_settings`
Nya (skapas i denna modul):
- `salon_pages` (page_type, title, content JSONB, meta_description, published)
- `gallery_images` (image_url, caption, sort_order)

## 5. API-endpoints
- `GET /api/public/[salon-slug]` → salongsinfo
- `GET /api/public/[salon-slug]/services` → tjänster
- `GET /api/public/[salon-slug]/staff` → personal
- `GET /api/public/[salon-slug]/gallery` → galleri
- `GET /api/sitemap/[salon-slug]` → SEO sitemap

## 6. Beroenden
- Tabeller `salons`, `services`, `staff`, `salon_settings` måste finnas → kommer från **M6 Salon Admin**.
- Bokningsknapp pekar mot **M3 Bokningsmotor** (`/boka`).
- Subdomän-routing kräver Cloudflare-provisionering (rör **M7 Platform Admin**).

## 7. Definition of Done
- [ ] Alla publika sidor renderar korrekt
- [ ] Subdomän-routing fungerar
- [ ] SEO meta-taggar på alla sidor
- [ ] Responsiv på mobil/tablet/desktop
- [ ] Sitemap genereras automatiskt
- [ ] Sidor laddar < 2 sekunder
- [ ] Bilder optimeras automatiskt
- [ ] schema.org markup validerar

## 8. Öppna frågor
1. Var redigeras `salon_pages`-innehåll i v1 – via M6 admin eller hårdkodade mallar?
2. Hur sätts subdomän upp tekniskt (Cloudflare-flöde) – manuellt eller automatiskt i v1?
3. Vilken karttjänst för kontaktsidan (Google Maps / OpenStreetMap)?
