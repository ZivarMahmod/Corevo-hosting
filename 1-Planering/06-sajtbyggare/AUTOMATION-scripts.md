# Automation- & verifierings-script — Sajtbyggaren

> Zivars krav 2026-06-16: lägg in script som **automatiserar** det repetitiva och
> **säkerställer att saker blir som tänkt** när han väljer det han vill.

## Språkgräns (läs först — annars byggs fel)
- **Python** → offline-verktyg på dev/CI: parsa/normalisera vendor-mallar (BeautifulSoup),
  bild-optimering (Pillow), data-audits, en-gångs-jobb. **Kör ALDRIG i Workern.**
- **Node/TS** → checks som måste känna appens typer/modul-register (markör-validator),
  och **all render-logik**.
- 🔴 **Render-vägen (få modulen att hamna rätt live) = TS/React på Cloudflare Workers.
  Python kan inte köra där.** Det är den hårda gränsen. Python automatiserar runt om +
  vaktar resultatet; TS bygger själva sidan.

## Var de bor
- Scripten: `5-Kod/scripts/` (offline/CI) — aldrig i `apps/web`-runtimen.
- Varje script byggs i sin skiva och får egna **Klar när**-rader i den skivans goal.

## Script-lagret (mappat till skivorna)

| Script | Vad det gör (automatiserar/säkerställer) | Språk | Skiva |
|---|---|---|---|
| `verify_render` | Hämtar den **deployade** storefront-URL:en → assertar titel/hero + att `<corevo-module>` faktiskt renderade + 0 console-fel; jämför mot originalmallen. **Säkerställer att bron höll efter deploy.** | Python *(eller Node)* | **S0 ⭐** |
| `import_template.py` | Vendor HTML/CSS/assets → "mall som data": extrahera sidor, ladda assets → R2, **markera redigerbara regioner**, generera `templates`/`template_pages`-rader. Automatiserar per-mall-onboarding (spec §2.8 — "INTE noll"). | Python | S1 |
| `validate_markers.mjs` | Scannar en layout/mall → varje `<corevo-module>` = känd modulnyckel + giltig position, inga föräldralösa markörer. **Säkerställer att en modul aldrig hamnar fel / utanför sidan.** | Node/TS *(känner modul-registret)* | S3 |
| `optimize_images.py` | Batch-optimerar uppladdade bilder (storlek/format/komprimering) → R2 `corevo-media`. Krav #6. | Python (Pillow) el. CF Images | S5 |
| `audit_licenses.py` | Scannar mall-katalogen → varje mall: licens-tag matchar `KATALOG.md` **innan** den blir publikt valbar. Säkerställer att vi inte publicerar en betald mall. | Python | S5 |
| `check_tenant_integrity.py` | Varje aktiv tenant: giltiga `tenant_modules`, ingen föräldralös layout, slug ej reserverad, **custom-domän speglad i `wrangler.jsonc`** (annars försvinner den vid deploy). Vakt mot tyst drift. | Python (Supabase) | löpande/CI |

## Princip
Varje skiva levererar sitt script tillsammans med funktionen — automation och
verifiering byggs **med** funktionen, inte som en eftertanke. `verify_render` börjar i S0
så mönstret "deploya → script bevisar att det blev rätt" sitter från första skivan.
