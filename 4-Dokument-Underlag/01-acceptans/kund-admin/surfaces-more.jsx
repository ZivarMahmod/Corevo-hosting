/* =====================================================================
   KUND-ADMIN — modul-ytor + plattforms-ytor
   Modul-ytor (Produkter, Ordrar, Offerter…) tänds bara när modulen är aktiv.
   Plattforms-ytor (Kunddatabas, Varumärke, Inställningar) finns alltid.
   ===================================================================== */
const { useState: useStateM } = React;
const AM = window.ADMIN;
const SC = window.SURFACES_CORE;
const { PageHead: PH, NewBanner: NB, ModuleTables: MT, statusTone: ST } = SC;

function SimpleTable({ cols, rows, foot }) {
  const grid = cols.map(c => c.w || "1fr").join(" ");
  return (
    <SCard pad={0}>
      <div style={{ display: "grid", gridTemplateColumns: grid, padding: "11px 18px", background: "var(--c-paper-2)", borderBottom: "1px solid var(--c-line)" }}>
        {cols.map(c => <div key={c.k} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-ink-3)" }}>{c.k}</div>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: grid, padding: "13px 18px", alignItems: "center", borderTop: i ? "1px solid var(--c-line)" : "none" }}>
          {cols.map(c => <div key={c.k} style={{ fontSize: 13.5, color: "var(--c-ink)" }}>{c.render ? c.render(r) : r[c.k]}</div>)}
        </div>
      ))}
      {foot && <div style={{ padding: "12px 18px", borderTop: "1px solid var(--c-line)" }}>{foot}</div>}
    </SCard>
  );
}

/* ---------- WEBSHOP: Produkter ---------- */
function Produkter() {
  return (
    <div>
      <PH title="Produkter" sub="Webshopens sortiment." action={<SBtn variant="gold" icon="plus">Ny produkt</SBtn>} />
      <NB><b>Tändes för att du aktiverade Webshop.</b> Lägg upp produkter, priser, lager och bilder här → de syns i webshopen på din sida. Betalning är pausad i v1 — ordrar skapas men inga pengar dras än.</NB>
      <SimpleTable
        cols={[{ k: "Produkt" }, { k: "Kategori", w: "0.8fr" }, { k: "Pris", w: "0.6fr", render: r => <span className="num" style={{ fontWeight: 600 }}>{r.price} kr</span> }, { k: "Lager", w: "0.6fr", render: r => <span className="num">{r.stock} st</span> }, { k: "", w: "50px", render: () => <Icon name="edit" size={15} style={{ color: "var(--c-ink-3)", cursor: "pointer" }} /> }]}
        rows={AM.MOCK.products} />
      <MT keys={["shop_products"]} />
    </div>
  );
}
/* ---------- WEBSHOP: Ordrar ---------- */
function Ordrar() {
  return (
    <div>
      <PH title="Ordrar" sub="Inkomna beställningar från webshopen." />
      <NB><b>Hör ihop med Webshop-modulen.</b> Varje order från din publika webshop landar här. Du styr status (ny → packad → hämtad). Leveranssätt sattes i onboarding (här: hämtas i butik).</NB>
      <SimpleTable
        cols={[{ k: "Order", w: "0.7fr", render: r => <span className="num" style={{ fontWeight: 600, color: "var(--c-forest)" }}>{r.id}</span> }, { k: "Kund" }, { k: "Antal", w: "0.5fr", render: r => <span className="num">{r.items}</span> }, { k: "Summa", w: "0.6fr", render: r => <span className="num" style={{ fontWeight: 600 }}>{r.total} kr</span> }, { k: "Leverans", w: "1.1fr", render: r => <span style={{ color: "var(--c-ink-2)", fontSize: 13 }}>{r.fulfil}</span> }, { k: "Status", w: "0.8fr", render: r => <SBadge tone={ST[r.status]} dot={false}>{r.status}</SBadge> }]}
        rows={AM.MOCK.orders} />
      <MT keys={["shop_orders", "shop_order_items"]} />
    </div>
  );
}
/* ---------- OFFERT ---------- */
function Offerter() {
  return (
    <div>
      <PH title="Offerter" sub="Förfrågningar från din sida." />
      <NB><b>Tändes för att du aktiverade Offert.</b> Besökare skickar förfrågningar via formuläret på din sida → de landar här. Du svarar med en offert (ny → besvarad → accepterad).</NB>
      <div style={{ display: "grid", gap: 10 }}>
        {AM.MOCK.offers.map((o, i) => (
          <SCard key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div><div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--c-ink)" }}>{o.customer}</div><div style={{ fontSize: 13, color: "var(--c-ink-2)", marginTop: 3 }}>{o.what}</div><div style={{ fontSize: 12, color: "var(--c-ink-3)", marginTop: 5 }}>{o.when}</div></div>
              <SBadge tone={ST[o.status]} dot={false}>{o.status}</SBadge>
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}><SBtn variant="primary" size="sm">Svara med offert</SBtn><SBtn variant="ghost" size="sm">Visa</SBtn></div>
          </SCard>
        ))}
      </div>
      <MT keys={["offert_requests"]} />
    </div>
  );
}
/* ---------- LOJALITET ---------- */
function Stammis() {
  return (
    <div>
      <PH title="Stammis" sub="Dina återkommande kunders poäng/stämplar." action={<SBtn variant="ghost" icon="settings">Regler</SBtn>} />
      <NB><b>Tändes för att du aktiverade Lojalitet.</b> Stämplar/poäng räknas <b>automatiskt</b> när en bokning blir klar — det sker i bakgrunden (DB-trigger), du behöver inte göra något manuellt.</NB>
      <SimpleTable
        cols={[{ k: "Kund" }, { k: "Stämplar", w: "0.7fr", render: r => <SBadge tone="gold" dot={false}>{r.stamps}</SBadge> }, { k: "Senast", w: "0.7fr", render: r => <span style={{ color: "var(--c-ink-2)" }}>{r.last}</span> }]}
        rows={AM.MOCK.loyalty} />
      <MT keys={["loyalty_ledger", "← auto via trigger"]} />
    </div>
  );
}
/* ---------- PRESENTKORT ---------- */
function Presentkort() {
  return (
    <div>
      <PH title="Presentkort" sub="Sålda kort och saldon." />
      <NB><b>Tändes för att du aktiverade Presentkort.</b> Köpta kort listas här med saldo. Du kan lösa in manuellt. Betalning pausad i v1 — kort skapas i UI.</NB>
      <SimpleTable
        cols={[{ k: "Kod", render: r => <span className="num" style={{ fontWeight: 600, color: "var(--c-forest)" }}>{r.code}</span> }, { k: "Värde", w: "0.6fr", render: r => <span className="num">{r.value} kr</span> }, { k: "Saldo", w: "0.6fr", render: r => <span className="num" style={{ fontWeight: 600 }}>{r.balance} kr</span> }, { k: "Sålt", w: "0.7fr", render: r => <span style={{ color: "var(--c-ink-2)" }}>{r.sold}</span> }, { k: "Status", w: "0.9fr", render: r => <SBadge tone={ST[r.status]} dot={false}>{r.status}</SBadge> }]}
        rows={AM.MOCK.giftcards} />
      <MT keys={["gift_cards"]} />
    </div>
  );
}
/* ---------- MENY (restaurang) ---------- */
function Meny() {
  return (
    <div>
      <PH title="Meny" sub="Rätter, kategorier, allergener." action={<SBtn variant="gold" icon="plus">Ny rätt</SBtn>} />
      <NB><b>Tändes för att din bransch är restaurang.</b> Menyn visas på din publika sida (läsning, inga köp). Du redigerar rätter, priser och dagens-flagga här.</NB>
      <SimpleTable
        cols={[{ k: "Rätt" }, { k: "Kategori", w: "0.8fr" }, { k: "Pris", w: "0.6fr", render: r => <span className="num">{r.price} kr</span> }]}
        rows={[{ Rätt: "Toast Skagen", Kategori: "Förrätt", price: 165 }, { Rätt: "Ryggbiff 250g", Kategori: "Varmrätt", price: 295 }, { Rätt: "Crème brûlée", Kategori: "Dessert", price: 110 }]} />
      <MT keys={["menu_items"]} />
    </div>
  );
}
/* ---------- BLOGG ---------- */
function Blogg() {
  return (
    <div>
      <PH title="Journal" sub="Inlägg på din sida." action={<SBtn variant="gold" icon="plus">Nytt inlägg</SBtn>} />
      <NB><b>Tändes för att du aktiverade Blogg.</b> Skriv, redigera och publicera inlägg som syns på din publika sida.</NB>
      <div style={{ display: "grid", gap: 10 }}>
        {[["Säsongens favoriter", "Publicerad"], ["Bakom kulisserna", "Publicerad"], ["Nya öppettider", "Utkast"]].map(([t, s], i) => (
          <SCard key={i}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontWeight: 600, fontSize: 14, color: "var(--c-ink)" }}>{t}</span><div style={{ display: "flex", gap: 10, alignItems: "center" }}><SBadge tone={s === "Publicerad" ? "success" : "neutral"} dot={false}>{s}</SBadge><SBtn variant="ghost" size="sm" icon="edit">Redigera</SBtn></div></div></SCard>
        ))}
      </div>
      <MT keys={["blog_posts"]} />
    </div>
  );
}
/* ---------- FORDON (konto-modul, bilverkstad) ---------- */
function Fordon() {
  return (
    <div>
      <PH title="Fordon" sub="Kundernas fordon kopplade till bokning/offert." />
      <NB><b>Konto-modul.</b> Detta är data kunden fyller i sitt Mitt konto — du ser den kopplad till deras bokningar. Visas inte på den publika sidan.</NB>
      <SimpleTable
        cols={[{ k: "Kund" }, { k: "Reg.nr", render: r => <span className="num" style={{ fontWeight: 600 }}>{r.reg}</span> }, { k: "Fordon" }, { k: "År", w: "0.5fr", render: r => <span className="num">{r.year}</span> }]}
        rows={AM.MOCK.vehicles} />
      <MT keys={["vehicle_profiles", "konto-yta"]} />
    </div>
  );
}
/* ---------- ORDERSTATUS (konto-modul) ---------- */
function Orderstatus() {
  return (
    <div>
      <PH title="Orderstatus" sub="Jobb du flyttar genom statusen." />
      <NB><b>Konto-modul.</b> Du flyttar status (mottagen → under arbete → klar) → kunden följer det i sitt Mitt konto. Ingen publik sida.</NB>
      <div style={{ display: "grid", gap: 10 }}>
        {AM.MOCK.workorders.map((w, i) => (
          <SCard key={i}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><span className="num" style={{ fontWeight: 600, color: "var(--c-forest)", marginRight: 10 }}>{w.id}</span><span style={{ fontSize: 14, color: "var(--c-ink)" }}>{w.what}</span></div><div style={{ display: "flex", gap: 10, alignItems: "center" }}><SBadge tone={ST[w.status]} dot={false}>{w.status}</SBadge><SBtn variant="ghost" size="sm">Nästa steg</SBtn></div></div></SCard>
        ))}
      </div>
      <MT keys={["work_orders", "konto-yta"]} />
    </div>
  );
}

/* ===================== KUNDDATABAS (plattform, alltid) ===================== */
function Kunder() {
  const [showPii, setShowPii] = useStateM(false);
  return (
    <div>
      <PH title="Kunddatabas" sub="Dina kunder — igenkänning år efter år." action={
        <SBtn variant="ghost" icon={showPii ? "eyeOff" : "eye"} onClick={() => setShowPii(v => !v)}>{showPii ? "Dölj kontaktuppgifter" : "Visa kontaktuppgifter"}</SBtn>
      } />
      <NB><b>Identitet skild från kontaktuppgifter (GDPR).</b> Den stabila kundraden gör att du känner igen återkommande kunder och bygger lojalitet — medan telefon/mejl bara visas i driftfönstret kring bokningen och maskas sen. Kunden väljer själv sitt visningsnamn.</NB>
      <SCard pad={0}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 80px 90px 1.2fr", padding: "11px 18px", background: "var(--c-paper-2)", borderBottom: "1px solid var(--c-line)" }}>
          {["Visningsnamn", "Identitet (internt)", "Besök", "Stammis", "Kontakt (drift-fönster)"].map(h => <div key={h} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-ink-3)" }}>{h}</div>)}
        </div>
        {AM.MOCK.customers.map((c, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr 80px 90px 1.2fr", padding: "13px 18px", alignItems: "center", borderTop: i ? "1px solid var(--c-line)" : "none" }}>
            <span style={{ fontSize: 13.5, color: "var(--c-ink)", fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>{c.display}{c.returning && <span title="Återkommande" style={{ color: "var(--c-gold-600)" }}><Icon name="star" size={13} /></span>}</span>
            <span style={{ fontSize: 13, color: "var(--c-ink-2)" }}>{c.full}</span>
            <span className="num" style={{ fontSize: 13, color: "var(--c-ink-2)" }}>{c.visits}</span>
            <span>{c.loyalty > 0 ? <SBadge tone="gold" dot={false}>{c.loyalty}/10</SBadge> : <span style={{ fontSize: 12, color: "var(--c-ink-3)" }}>—</span>}</span>
            <span className="num" style={{ fontSize: 12.5, color: showPii ? "var(--c-ink-2)" : "var(--c-ink-3)", filter: showPii ? "none" : "blur(4px)", transition: "filter .2s", userSelect: showPii ? "auto" : "none" }}>{c.pii}</span>
          </div>
        ))}
      </SCard>
      <MT keys={["customers", "customer_profiles", "PII tidsbunden · GDPR"]} />
    </div>
  );
}

/* ===================== VARUMÄRKE (plattform, alltid) ===================== */
function Varumarke({ cfg }) {
  const [brand, setBrand] = useStateM({ primary: "#1F4636", font: "Playfair Display", hero: "Välkommen till " + cfg.name, tagline: "Modern " + cfg.vertical + " i hjärtat av stan." });
  const [saved, setSaved] = useStateM(brand);
  const dirty = JSON.stringify(brand) !== JSON.stringify(saved);
  const set = (k, v) => setBrand(b => ({ ...b, [k]: v }));
  return (
    <div>
      <PH title="Varumärke" sub="Färg, font, text och bild — ändra själv, se direkt." action={
        <div style={{ display: "flex", gap: 8 }}>
          {dirty && <SBtn variant="ghost" icon="undo" onClick={() => setBrand({ ...saved })}>Ångra</SBtn>}
          <SBtn variant="primary" icon="check" disabled={!dirty} onClick={() => setSaved({ ...brand })}>Spara</SBtn>
        </div>
      } />
      <NB><b>Live-förhandsvisning, ångra och spara utan deploy.</b> Färg och font läses som inställning i runtime — inte inbyggt i koden — så en ändring syns direkt på din sida utan ny lansering. Frihet att forma, men du kan inte förstöra.</NB>
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 18, alignItems: "start" }}>
        <div style={{ display: "grid", gap: 18 }}>
          <SCard>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: "var(--c-ink)", marginBottom: 10 }}>Profilfärg</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {AM.BRAND_PRESETS.map(c => <button key={c} onClick={() => set("primary", c)} style={{ width: 38, height: 38, borderRadius: 10, background: c, cursor: "pointer", border: brand.primary === c ? "3px solid var(--c-gold)" : "2px solid #fff", boxShadow: "0 0 0 1px var(--c-line)" }} />)}
            </div>
          </SCard>
          <SCard><div style={{ display: "grid", gap: 14 }}>
            <SField label="Font (rubriker)" val={brand.font} on={v => set("font", v)} />
            <SField label="Rubrik" val={brand.hero} on={v => set("hero", v)} />
            <SField label="Tagline" val={brand.tagline} on={v => set("tagline", v)} />
          </div></SCard>
          <SCard>
            <div style={{ fontWeight: 600, fontSize: 12.5, color: "var(--c-ink)", marginBottom: 8 }}>Hero-bild</div>
            <div style={{ height: 90, borderRadius: 10, border: "2px dashed var(--c-line-strong)", display: "grid", placeItems: "center", color: "var(--c-ink-3)", fontSize: 12.5, gap: 4, cursor: "pointer", textAlign: "center" }}><Icon name="upload" size={20} /><span>Dra hit en bild eller klicka</span></div>
            <div style={{ marginTop: 8 }}><TChip>media_assets</TChip></div>
          </SCard>
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--c-ink-3)", marginBottom: 8, display: "flex", alignItems: "center", gap: 7 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--c-success)" }} />Live-förhandsvisning</div>
          <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--c-line)", boxShadow: "var(--shadow-md)" }}>
            <div style={{ height: 300, background: `linear-gradient(150deg, ${brand.primary}, color-mix(in srgb, ${brand.primary} 55%, #000))`, display: "grid", placeItems: "center", textAlign: "center", padding: 30 }}>
              <div>
                <div style={{ fontFamily: brand.font.includes("Playfair") ? "'Playfair Display',serif" : brand.font + ",serif", color: "#fff", fontSize: 32, fontWeight: 700, lineHeight: 1.1 }}>{brand.hero}</div>
                <div style={{ color: "rgba(255,255,255,.85)", fontSize: 15, marginTop: 10, fontFamily: "var(--font-ui)" }}>{brand.tagline}</div>
                <div style={{ display: "inline-block", marginTop: 18, background: "#fff", color: brand.primary, fontWeight: 700, fontSize: 14, padding: "11px 24px", borderRadius: 999, fontFamily: "var(--font-ui)" }}>Boka tid</div>
              </div>
            </div>
            <div style={{ padding: "14px 18px", background: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: brand.font.includes("Playfair") ? "'Playfair Display',serif" : "serif", fontSize: 17, color: brand.primary, fontWeight: 700 }}>{cfg.name}</span>
              <span style={{ fontSize: 12.5, color: "var(--c-ink-3)" }} className="num">{cfg.slug}.corevo.se</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== INSTÄLLNINGAR (plattform, alltid) ===================== */
function Installningar({ cfg }) {
  const [toggles, setToggles] = useStateM(Object.fromEntries(AM.SETTINGS.map(s => [s.key, s.on])));
  return (
    <div>
      <PH title="Inställningar" sub="Varje reglage gör något på riktigt." />
      <NB><b>Inga döda reglage.</b> Varje inställning är sann-kopplad — slår du på bokningsbekräftelse så skickas SMS på riktigt. Finns funktionen inte, finns inte heller reglaget.</NB>
      <SCard>
        <div style={{ display: "grid", gap: 4 }}>
          {AM.SETTINGS.map((s, i) => (
            <div key={s.key} style={{ padding: "14px 0", borderTop: i ? "1px solid var(--c-line)" : "none" }}>
              <SToggle on={toggles[s.key]} set={v => setToggles(t => ({ ...t, [s.key]: v }))} title={s.title} desc={s.desc} />
            </div>
          ))}
        </div>
      </SCard>
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--c-ink-3)", marginBottom: 8 }}>Dina moduler</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(cfg.modules).map(([k, state]) => AM.MODULE_DEFS[k] && (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 999, background: state === "live" ? "var(--c-success-bg)" : state === "draft" ? "var(--c-warning-bg)" : "var(--c-paper-2)", fontSize: 12.5, fontWeight: 600, color: "var(--c-ink)", opacity: state === "off" ? 0.55 : 1 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: state === "live" ? "var(--c-success)" : state === "draft" ? "var(--c-warning)" : "var(--c-ink-3)" }} />
              {AM.MODULE_DEFS[k].name}<span style={{ color: "var(--c-ink-3)", fontWeight: 500 }}>{state}</span>
            </span>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--c-ink-3)", marginTop: 10, lineHeight: 1.5 }}>Avstängda moduler finns redan i din sida — superadmin flippar dem till <b>live</b> och deras sidor tänds här. Inget byggs om.</p>
      </div>
    </div>
  );
}

window.SURFACES_MORE = { Produkter, Ordrar, Offerter, Stammis, Presentkort, Meny, Blogg, Fordon, Orderstatus, Kunder, Varumarke, Installningar };
