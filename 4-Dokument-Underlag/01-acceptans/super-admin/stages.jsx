/* =====================================================================
   STAGES — super-admin entry · launch sequence · customer storefront ·
   customer's own admin (M6). Each surface is unmistakably labelled so
   there is never any "which role am I?" confusion.
   ===================================================================== */
const { useState: useStateR, useEffect: useEffectR } = React;

/* ---------- demo tenants for the super-admin landing ---------- */
const DEMO_TENANTS = [
  { name: "Studio Salvia", slug: "salvia", branch: "Frisörsalong", theme: "Salvia", dot: "#5E7361", bookings: 312, status: "Aktiv" },
  { name: "Zigge", slug: "zigge", branch: "Barber", theme: "Zigge", dot: "#C8743C", bookings: 701, status: "Aktiv" },
  { name: "Maison Leander", slug: "leander", branch: "Nagelsalong", theme: "Leander", dot: "#7E6E92", bookings: 488, status: "Aktiv" },
  { name: "Tass & Trim", slug: "tasstrim", branch: "Hundsalong", theme: "Salvia", dot: "#5E7361", bookings: 96, status: "Aktiv" },
  { name: "Salong Nord", slug: "nord", branch: "Frisörsalong", theme: "Leander", dot: "#7E6E92", bookings: 0, status: "Onboarding" },
];

function SuperEntry({ onStart }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--c-cream)" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 40px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20, marginBottom: 28 }}>
          <div>
            <SEyebrow>Plattform · superbooking@corevo.se</SEyebrow>
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 34, color: "var(--c-forest)", margin: "8px 0 0" }}>Kunder</h1>
            <p style={{ fontSize: 14, color: "var(--c-ink-2)", margin: "6px 0 0", maxWidth: 520 }}>Dina kunder. Onboarda en ny — vilken bransch som helst — och följ hela bygget i en live preview tills sidan är deployad.</p>
          </div>
          <SBtn variant="primary" size="lg" icon="plus" onClick={onStart}>Onboarda ny kund</SBtn>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          {[["Kunder", "24", "building"], ["Aktiva", "21", "checkCircle"], ["Bokningar · mån", "6 240", "trendUp"], ["Underlag · mån", "24 960 kr", "dollar"]].map(([l, v, ic]) => (
            <SCard key={l}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><SEyebrow>{l}</SEyebrow><div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--c-paper-2)", color: "var(--c-forest)", display: "grid", placeItems: "center" }}><Icon name={ic} size={16} /></div></div>
              <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 30, color: "var(--c-forest)", marginTop: 8 }}>{v}</div>
            </SCard>
          ))}
        </div>

        <SCard pad={0}>
          <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--c-line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 17, color: "var(--c-ink)", margin: 0 }}>Alla kunder</h2>
            <SBadge tone="info" dot={false}>multi-tenant · RLS per tenant_id</SBadge>
          </div>
          {DEMO_TENANTS.map((t, i) => (
            <div key={t.slug} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 22px", borderTop: i ? "1px solid var(--c-line)" : "none" }}>
              <div style={{ width: 38, height: 38, flex: "none", borderRadius: 10, background: t.dot, color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17 }}>{t.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--c-ink)" }}>{t.name}</div>
                <div className="num" style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>{t.slug}.corevo.se · {t.branch}</div>
              </div>
              <span className="num" style={{ fontSize: 13, color: "var(--c-ink-2)" }}>{t.bookings} bokn.</span>
              <SBadge tone={t.status === "Aktiv" ? "success" : "info"}>{t.status}</SBadge>
            </div>
          ))}
          <div style={{ padding: "16px 22px", borderTop: "1px solid var(--c-line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "color-mix(in srgb, var(--c-gold) 6%, var(--c-paper))" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--c-gold-100)", color: "var(--c-gold-600)", display: "grid", placeItems: "center" }}><Icon name="plus" size={19} /></div>
              <div><div style={{ fontWeight: 600, fontSize: 14, color: "var(--c-ink)" }}>Onboarda en ny kund</div><div style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>Bransch → moduler → branding → live. Live preview hela vägen.</div></div>
            </div>
            <SBtn variant="gold" icon="arrowRight" iconRight onClick={onStart}>Starta</SBtn>
          </div>
        </SCard>
      </div>
    </div>
  );
}

/* ---------- launch sequence overlay ---------- */
function LaunchSequence({ cfg, onDone }) {
  const tasks = [
    "Skapar tenant (slug + settings + ägarroll)…",
    `Aktiverar ${Object.values(cfg.modules).filter(s => s && s !== "off").length} moduler (tenant_modules)…`,
    "Publicerar layout (draft → publicerad)…",
    `Reserverar ${cfg.slug}.corevo.se (wildcard-route)…`,
    "Skickar magic-link till ägaren…",
    "Bustar tenant-cache · sidan är live.",
  ];
  const [n, setN] = useStateR(0);
  useEffectR(() => {
    if (n >= tasks.length) { const t = setTimeout(onDone, 700); return () => clearTimeout(t); }
    const t = setTimeout(() => setN(n + 1), n === tasks.length - 1 ? 600 : 460);
    return () => clearTimeout(t);
  }, [n]);
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 200, background: "var(--c-forest)", display: "grid", placeItems: "center" }}>
      <div style={{ width: 460, maxWidth: "90vw" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--c-gold)", color: "var(--c-forest-700)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22 }}>C</div>
          <div><div style={{ fontFamily: "var(--font-display)", color: "#fff", fontWeight: 700, fontSize: 20 }}>Lanserar {cfg.name || "kunden"}</div><div className="num" style={{ color: "var(--c-on-forest-2)", fontSize: 13 }}>{cfg.slug}.corevo.se</div></div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {tasks.map((task, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, opacity: i <= n ? 1 : 0.3, transition: "opacity .3s" }}>
              <span style={{ width: 24, height: 24, flex: "none", borderRadius: 999, background: i < n ? "var(--c-gold)" : "rgba(255,255,255,.1)", color: i < n ? "var(--c-forest-700)" : "#fff", display: "grid", placeItems: "center", border: i < n ? "none" : "1px solid rgba(255,255,255,.2)" }}>
                {i < n ? <Icon name="check" size={14} /> : i === n ? <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--c-gold)", animation: "cpulse 1s infinite" }} /> : null}
              </span>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13.5, color: i <= n ? "#fff" : "var(--c-on-forest-2)" }}>{task}</span>
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes cpulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
    </div>
  );
}

/* ---------- admin table helper ---------- */
function AdmTable({ cols, rows, foot }) {
  const grid = cols.map(c => c.w || "1fr").join(" ");
  return (
    <SCard pad={0}>
      <div style={{ display: "grid", gridTemplateColumns: grid, padding: "11px 18px", borderBottom: "1px solid var(--c-line)", background: "var(--c-paper-2)" }}>
        {cols.map(c => <div key={c.k} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--c-ink-3)" }}>{c.k}</div>)}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: grid, padding: "13px 18px", borderTop: i ? "1px solid var(--c-line)" : "none", alignItems: "center" }}>
          {cols.map(c => <div key={c.k} style={{ fontSize: 13.5, color: "var(--c-ink)" }}>{r[c.k]}</div>)}
        </div>
      ))}
      {foot && <div style={{ padding: "12px 18px", borderTop: "1px solid var(--c-line)" }}>{foot}</div>}
    </SCard>
  );
}

/* ---------- per-module ADMIN view — what the owner manages (M6) ----------
   The admin face of each module. Storefront shows it to visitors; here the
   owner edits it. Mirrors modules.* behaviour per type. */
function ModuleAdminView({ mod, cfg }) {
  const M = window.CFG.MODULES[mod];
  const b = window.CFG.BRANCHES[cfg.branch] || {};
  const staff = b.staffWord || "Personal";
  const svc = (cfg.content.services && cfg.content.services.length ? cfg.content.services : ["Tjänst 1", "Tjänst 2", "Tjänst 3"]);
  const points = cfg.branch === "cafe" || cfg.branch === "restaurang";
  let view = null;

  if (mod === "portfolio") {
    const tags = cfg.branch === "tatuering" ? ["Alla", "Fine line", "Traditional", "Blackwork"] : cfg.branch === "fotograf" ? ["Alla", "Porträtt", "Bröllop", "Produkt"] : ["Alla", "Nytt", "Populärt"];
    view = (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {tags.map((f, i) => <span key={f} style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, border: `1px solid ${i === 0 ? "var(--c-forest)" : "var(--c-line)"}`, color: i === 0 ? "var(--c-forest)" : "var(--c-ink-3)" }}>{f}</span>)}
          </div>
          <SBtn variant="gold" size="sm" icon="upload">Ladda upp bild</SBtn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 12, overflow: "hidden", background: `linear-gradient(135deg, color-mix(in srgb, var(--c-forest) ${18 + i * 7}%, var(--c-paper-2)), var(--c-paper-2))`, border: "1px solid var(--c-line)" }}>
              <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,.92)", display: "grid", placeItems: "center", color: "var(--c-forest)", boxShadow: "var(--shadow-sm)" }}><Icon name="edit" size={13} /></span>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,255,255,.92)", display: "grid", placeItems: "center", color: "var(--c-danger)", boxShadow: "var(--shadow-sm)" }}><Icon name="trash" size={13} /></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (mod === "booking") {
    view = <AdmTable
      cols={[{ k: "Tid", w: "0.9fr" }, { k: "Kund" }, { k: "Tjänst" }, { k: staff, w: "0.8fr" }, { k: "Status", w: "0.8fr" }]}
      rows={[
        { Tid: "Idag 10:30", Kund: "Anna L.", Tjänst: svc[0], [staff]: "Maja", Status: <SBadge tone="success">Bekräftad</SBadge> },
        { Tid: "Idag 13:00", Kund: "Erik S.", Tjänst: svc[1] || svc[0], [staff]: "Johanna", Status: <SBadge tone="success">Bekräftad</SBadge> },
        { Tid: "Imorgon 09:00", Kund: "Lina K.", Tjänst: svc[2] || svc[0], [staff]: "Maja", Status: <SBadge tone="warning">Väntar</SBadge> },
      ]}
      foot={<SBtn variant="ghost" size="sm" icon="plus">Ny bokning</SBtn>} />;
  } else if (mod === "offert") {
    view = (
      <div style={{ display: "grid", gap: 10 }}>
        {[["Anna L.", "Bröllop 12 aug · 80 gäster", "Ny"], ["Erik S.", "Servicepaket · Volvo V60", "Besvarad"], ["Lina K.", "Större motiv, underarm", "Ny"]].map(([who, what, st], i) => (
          <SCard key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div><div style={{ fontWeight: 600, fontSize: 14, color: "var(--c-ink)" }}>{who}</div><div style={{ fontSize: 12.5, color: "var(--c-ink-2)", marginTop: 3 }}>{what}</div></div>
              <SBadge tone={st === "Ny" ? "warning" : "success"}>{st}</SBadge>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}><SBtn variant="primary" size="sm">Svara med offert</SBtn><SBtn variant="ghost" size="sm">Visa</SBtn></div>
          </SCard>
        ))}
      </div>
    );
  } else if (mod === "shop" || mod === "presentkort" || mod === "meny") {
    const isMenu = mod === "meny", isGift = mod === "presentkort";
    const c2 = isMenu ? "Kategori" : isGift ? "Värde" : "Pris";
    const c3 = isMenu ? "Allergener" : isGift ? "Sålda" : "Lager";
    const items = isGift ? ["200 kr", "500 kr", "1000 kr"] : svc.slice(0, 4);
    view = <AdmTable
      cols={[{ k: "Namn" }, { k: c2, w: "0.7fr" }, { k: c3, w: "0.7fr" }, { k: "", w: "44px" }]}
      rows={items.map((it, i) => ({
        Namn: it,
        [c2]: isMenu ? ["Förrätt", "Varmrätt", "Dessert", "Dryck"][i % 4] : isGift ? it : `${[249, 395, 179, 320][i % 4]} kr`,
        [c3]: isMenu ? "Gluten" : isGift ? `${[12, 4, 7][i % 3]} st` : `${[12, 4, 30, 8][i % 4]} st`,
        "": <Icon name="edit" size={14} style={{ color: "var(--c-ink-3)" }} />,
      }))}
      foot={<SBtn variant="gold" size="sm" icon="plus">{isMenu ? "Lägg till rätt" : isGift ? "Lägg till valör" : "Lägg till produkt"}</SBtn>} />;
  } else if (mod === "blogg") {
    view = (
      <div style={{ display: "grid", gap: 10 }}>
        {[["Säsongens favoriter", "Publicerad"], ["Bakom kulisserna", "Publicerad"], ["Nya öppettider", "Utkast"]].map(([title, st], i) => (
          <SCard key={i}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--c-ink)" }}>{title}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}><SBadge tone={st === "Publicerad" ? "success" : "neutral"}>{st}</SBadge><SBtn variant="ghost" size="sm" icon="edit">Redigera</SBtn></div>
          </div></SCard>
        ))}
        <SBtn variant="gold" size="sm" icon="plus" style={{ width: "fit-content" }}>Nytt inlägg</SBtn>
      </div>
    );
  } else if (mod === "lojalitet") {
    const c2 = points ? "Poäng" : "Stämplar";
    view = <AdmTable
      cols={[{ k: "Kund" }, { k: c2, w: "0.7fr" }, { k: "Senast", w: "0.8fr" }]}
      rows={[
        { Kund: "Anna L.", [c2]: points ? "450 p" : "6 / 10", Senast: "3 dgr sen" },
        { Kund: "Erik S.", [c2]: points ? "120 p" : "2 / 10", Senast: "1 vecka sen" },
        { Kund: "Lina K.", [c2]: points ? "880 p" : "9 / 10", Senast: "Idag" },
      ]} />;
  } else if (mod === "husdjur" || mod === "fordon" || mod === "intag") {
    const rec = {
      husdjur: { cols: ["Kund", "Husdjur", "Ras", "Anteckning"], rows: [["Anna L.", "Bella", "Golden retriever", "Allergisk mot kyckling"], ["Erik S.", "Max", "Border collie", "Nervös vid trim"]] },
      fordon: { cols: ["Kund", "Regnr", "Bil", "År"], rows: [["Anna L.", "ABC 123", "Volvo V60", "2019"], ["Erik S.", "XYZ 789", "VW Golf", "2021"]] },
      intag: { cols: ["Kund", "Status", "Samtycke", "Uppdaterad"], rows: [["Anna L.", "Komplett", "Godkänt", "2 dgr sen"], ["Lina K.", "Väntar", "—", "Idag"]] },
    }[mod];
    view = <AdmTable
      cols={rec.cols.map(k => ({ k }))}
      rows={rec.rows.map(r => Object.fromEntries(rec.cols.map((k, j) => [k, (k === "Status" || k === "Samtycke") ? <SBadge tone={(r[j] === "Godkänt" || r[j] === "Komplett") ? "success" : "neutral"}>{r[j]}</SBadge> : r[j]])))} />;
  } else if (mod === "orderstatus" || mod === "recurring" || mod === "inlamning" || mod === "deposit") {
    const sb = {
      orderstatus: [["#1042 · Volvo service", "Under arbete"], ["#1041 · Bromsbyte", "Klar för hämtning"], ["#1040 · Däckskifte", "Mottagen"]],
      recurring: [["Hemstäd · Anna L.", "Varannan vecka"], ["Kontorsstäd · Acme AB", "Veckovis"]],
      inlamning: [["Herrcykel · trasig växel", "Mottagen"], ["Kavaj · uppläggning", "Under arbete"]],
      deposit: [["Tatuering · Lina K.", "Betald 500 kr"], ["Tatuering · Sam", "Väntar"]],
    }[mod];
    view = (
      <div style={{ display: "grid", gap: 10 }}>
        {sb.map(([what, st], i) => (
          <SCard key={i}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--c-ink)" }}>{what}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <SBadge tone={/Klar|Betald|Veckovis|vecka/.test(st) ? "success" : (st === "Väntar" || st === "Mottagen") ? "warning" : "info"}>{st}</SBadge>
              {(mod === "orderstatus" || mod === "inlamning") && <SBtn variant="ghost" size="sm">Nästa steg</SBtn>}
            </div>
          </div></SCard>
        ))}
      </div>
    );
  } else {
    view = <SCard><p style={{ fontSize: 13.5, color: "var(--c-ink-2)", lineHeight: 1.6, margin: 0 }}>{M.adm || M.short}</p></SCard>;
  }

  return (
    <div>
      <p style={{ fontSize: 13.5, color: "var(--c-ink-2)", margin: "0 0 8px", lineHeight: 1.5 }}>{M.adm || M.short}</p>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        <SBadge tone={M.defaultPos === "konto" ? "info" : "success"} dot={false}>{M.defaultPos === "konto" ? "Visas i kundens Mitt konto" : "Visas på publika sidan"}</SBadge>
        {M.sf && <span style={{ fontSize: 12, color: "var(--c-ink-3)" }}>↳ {M.sf}</span>}
      </div>
      {view}
      <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>{M.tables.slice(0, 3).map(tb => <TChip key={tb}>{tb}</TChip>)}</div>
    </div>
  );
}

/* ---------- customer's own admin (M6 Salon Admin) ---------- */
function CustomerAdmin({ cfg }) {
  const M = window.CFG.MODULES;
  const t = window.CFG.ST_THEMES[cfg.theme];
  const active = Object.keys(cfg.modules).filter(m => cfg.modules[m] && cfg.modules[m] !== "off");
  const modNav = { shop: ["Webshop", "bookmark"], offert: ["Offerter", "message"], lojalitet: ["Stammis", "heart"], presentkort: ["Presentkort", "gift"], meny: ["Meny", "menu"], portfolio: ["Portfolio", "grid"], blogg: ["Journal", "edit"], husdjur: ["Husdjursprofiler", "heart"], fordon: ["Fordon", "settings"], intag: ["Intagsformulär", "shield"], orderstatus: ["Orderstatus", "checkCircle"], recurring: ["Återkommande", "repeat"], deposit: ["Deposit", "creditCard"], inlamning: ["Inlämningar", "upload"] };
  const nav = [
    ["Dashboard", "home"], ...(cfg.modules.booking !== "off" ? [["Bokningar", "calendar"]] : []),
    ["Kunder", "users"], ["Tjänster", "scissors"], ["Personal", "user"],
    ...active.filter(m => modNav[m]).map(m => modNav[m]),
    ["Varumärke / sajt", "palette"], ["Inställningar", "settings"],
  ];
  const [navi, setNavi] = useStateR("Dashboard");
  const navKey = Object.keys(modNav).find(k => modNav[k][0] === navi) || (navi === "Bokningar" ? "booking" : null);
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, borderRadius: 16, overflow: "hidden", border: "1px solid var(--c-line)", boxShadow: "var(--shadow-lg)" }}>
      <aside style={{ width: 220, flex: "none", background: "var(--c-forest)", color: "var(--c-on-forest)", padding: "20px 14px", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 18px" }}>
          <div style={{ width: 32, height: 32, flex: "none", borderRadius: 8, background: cfg.branding.accent || t.primary, color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16 }}>{(cfg.name || "S")[0]}</div>
          <div style={{ minWidth: 0 }}><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cfg.name || "Salongen"}</div><div style={{ fontSize: 9.5, color: "var(--c-on-forest-2)", letterSpacing: ".08em", textTransform: "uppercase" }}>Adminpanel</div></div>
        </div>
        {nav.map(([l, ic]) => {
          const on = navi === l;
          return <button key={l} onClick={() => setNavi(l)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: on ? 600 : 500, background: on ? "var(--c-forest-700)" : "transparent", color: on ? "#fff" : "var(--c-on-forest-2)", borderLeft: on ? "2px solid var(--c-gold)" : "2px solid transparent", marginBottom: 2 }}><Icon name={ic} size={16} />{l}</button>;
        })}
      </aside>
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "var(--c-cream)", padding: 28 }}>
        <SEyebrow>{cfg.owner.name ? "Inloggad: " + cfg.owner.name : "Ägarens vy"}</SEyebrow>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26, color: "var(--c-forest)", margin: "6px 0 4px" }}>{navi}</h1>
        {navi === "Dashboard" ? (
          <>
            <p style={{ fontSize: 13.5, color: "var(--c-ink-2)", margin: "0 0 20px" }}>Välkommen! Din sida är live på <b className="num">{cfg.slug}.corevo.se</b>. Här styr du allt utan att se någon annan salongs data (RLS).</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
              {[["Bokningar idag", "0"], ["Kunder", "0"], ["Aktiva moduler", String(active.filter(m => !M[m].infra).length)]].map(([l, v]) => (
                <SCard key={l}><SEyebrow>{l}</SEyebrow><div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28, color: "var(--c-forest)", marginTop: 6 }}>{v}</div></SCard>
              ))}
            </div>
            <SCard>
              <h3 style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 15, color: "var(--c-ink)", margin: "0 0 12px" }}>Dina aktiva moduler</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {active.filter(m => !M[m].infra).map(m => (
                  <div key={m} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 12px", borderRadius: 9, background: "var(--c-paper-2)" }}>
                    <span style={{ width: 28, height: 28, flex: "none", borderRadius: 7, background: "var(--c-forest)", color: "#fff", display: "grid", placeItems: "center" }}><Icon name={M[m].icon} size={14} /></span>
                    <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--c-ink)", flex: 1 }}>{M[m].name}</span>
                    <SBadge tone="success">live</SBadge>
                  </div>
                ))}
              </div>
            </SCard>
            <SCard style={{ marginTop: 14, background: "color-mix(in srgb, var(--c-gold) 7%, var(--c-paper))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><Icon name="sparkle" size={15} style={{ color: "var(--c-gold-600)" }} /><span style={{ fontWeight: 600, fontSize: 14 }}>Nästa steg för dig</span></div>
              <div style={{ display: "grid", gap: 7 }}>
                {["Fyll på dina tjänster & priser", "Bjud in din personal (magic-link)", "Koppla Stripe när betalningar släpps på"].map(s => (
                  <div key={s} style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13, color: "var(--c-ink-2)" }}><Icon name="arrowRight" size={14} style={{ color: "var(--c-gold-600)" }} />{s}</div>
                ))}
              </div>
            </SCard>
          </>
        ) : navKey ? (
          <div style={{ marginTop: 14 }}><ModuleAdminView mod={navKey} cfg={cfg} /></div>
        ) : (
          <SCard style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13.5, color: "var(--c-ink-2)", lineHeight: 1.6, margin: 0 }}>
              <b>{navi}</b> — kundens egen vy. Här hanterar ägaren detta utan kod. Allt RLS-isolerat till denna tenant.
            </p>
            <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
              <TChip>tenant_id = {cfg.slug}</TChip><TChip>RLS scopad</TChip>
            </div>
          </SCard>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { SuperEntry, LaunchSequence, CustomerAdmin, DEMO_TENANTS });
