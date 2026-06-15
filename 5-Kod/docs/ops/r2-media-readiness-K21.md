# R2 / bildbibliotek — end-to-end readiness (K21, Fas 4)

> Verifierat **read-only** 2026-06-15 (autonom körning). Ingen kod, ingen DB, ingen deploy ändrad.
> Stänger "verify-halvan" av roadmapens Fas 4-punkt *"R2/assets ej end-to-end live-verifierat (bucket + gratis-tier-koll)"*.

## TL;DR
**R2-bildflödet är färdigwirat i kod + infra. Inget byggjobb kvar — bara DIN deploy + 1 toggle-koll + 1 rök-test.**

---

## ✅ VERIFIERAT (grönt idag)

**Infra (Cloudflare-konto, via MCP):**
- Bucket **`corevo-media` FINNS** — skapad 2026-06-01, enda bucketen på kontot.
- **Storage class = Standard** → den gratis-tier-grundande klassen (ej Infrequent Access, som har hämtningsavgift).
- Location WNAM (Western North America).

**Kod (färdigt, väntar bara på deploy):**
- `lib/r2/upload.ts` — komplett: `uploadImage` (2 MB-tak, PNG/JPG/WEBP/SVG/GIF), `pruneRemovedImages`, `deleteByPublicUrl`, `keyFromPublicUrl` (raderar bara objekt vi äger).
- `wrangler.jsonc` — binding **`BUCKET → corevo-media`** (prod **och** `env.staging`), `R2_PUBLIC_BASE_URL = https://pub-8f440f10134347eeb2491f9712f5a6f5.r2.dev`. Vars ligger i config → varje top-level `deploy` återställer dem (FX-14-skyddet).
- `lib/admin/media/actions.ts` — upload → R2 + `media_assets`-rad; rad faller → R2-objektet städas bort (ingen orphan); delete prunar R2 efter commit.
- `ImagePicker.tsx` — lagrar `media_assets.id` i `product.image_asset_id` / `post.cover_asset_id`.

**DB (prod `clylvowtowbtotrahuad`, via SELECT):**
- `media_assets` har **anon SELECT** (`media_assets_public_read`) + authenticated ALL (`media_assets_rls`).
- **Storefront-kedjan är hel:** anon storefront läser `image_asset_id → media_assets.url`; bild-bytena serveras publikt av r2.dev (ingen DB-läs för själva bilden). `tables_without_rls = 0`.

---

## ⏳ KVAR — DITT (kan EJ köras autonomt: toggle/deploy/aktiv tenant)

1. **Toggle-koll (1 min):** R2 → `corevo-media` → Settings → **Public access**. Bekräfta att **"Public Development URL" är PÅ** och att hashen matchar `pub-8f440f10134347eeb2491f9712f5a6f5.r2.dev`.
   - *Varför:* MCP visar att bucketen finns men INTE om publik-toggeln är på. Är den AV (eller annan hash) → alla sparade bild-URL:er ger **404**.
2. **Deploy** (din maskin — rutan överst i `LOG.md`). Binding + `R2_PUBLIC_BASE_URL` rider med `wrangler.jsonc`.
3. **Rök-test efter deploy + aktiv tenant:**
   - Admin → Bildbibliotek → ladda upp → bild syns.
   - Bind bilden till en produkt/blogg → storefront visar den.
   - Ta bort i biblioteket → R2-objektet försvinner.
   - *Blockerat idag:* enda tenant = `corevo-system` (deleted) → ingen aktiv storefront att testa mot ännu.

---

## 💰 KOSTNAD — håller sig gratis
- R2 free tier: **10 GB lagring · 1M Class A · 10M Class B ops/mån · 0 kr egress**.
- Bildbiblioteket (logo/hero/galleri, 2 MB-tak/fil) ligger tryggt inom det. **Inget betalt provisionerat.**
- Public dev-URL (`pub-*.r2.dev`) = gratis men rate-limitad + ej tänkt för hög trafik. **Prod-härdning senare:** eget subdomän **`media.corevo.se`** (redan förutsett i `upload.ts`-kommentaren — `keyFromPublicUrl` hoppar säkert över främmande bas så gamla länkar inte mis-derivas vid bytet).
- Undvik betalfällor: ingen Infrequent Access-klass, ingen Super Slurper-migrering, ingen Data Catalog → stannar gratis.
