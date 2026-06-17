/* =====================================================================
   KUND-ADMIN — kärn-ytor (Översikt + Bokningsmodulens ytor)
   Allt läser window.ADMIN.MOCK. `cfg` bär terminologi (staffWord m.m.).
   ===================================================================== */
const { useState: useStateS } = React;
const AD = window.ADMIN;

/* terminologi-substitution: "{staffWord}" → cfg.staffWord */
function term(str, cfg) {
  if (!str) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => cfg[k] || _);
}

function PageHead({ title, sub, action }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 22, flexWrap: "wrap" }}>
      <div>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 30, color: "var(--c-forest)", margin: 0, letterSpacing: "-.01em", lineHeight: 1.15 }}>{title}</h1>
        {sub && <p style={{ margin: "5px 0 0", fontSize: 14, color: "var(--c-ink-3)" }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
function NewBanner({ children }) {
  return (
    <div style={{ display: "flex", gap: 11, padding: "12px 15px", background: "var(--c-gold-100)", border: "1px solid var(--c-gold)", borderRadius: 12, marginBottom: 20, alignItems: "flex-start" }}>
      <span style={{ flex: "none", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--c-gold-600)", background: "#fff", padding: "3px 8px", borderRadius: 999, marginTop: 1 }}><Icon name="sparkle" size={12} />Nytt</span>
      <span style={{ fontSize: 13, color: "var(--c-ink)", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}
function ModuleTables({ keys }) {
  return <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>{keys.map(k => <TChip key={k}>{k}</TChip>)}</div>;
}
const statusTone = { klar: "success", gjord: "info", avbokad: "danger", Ny: "warning", Packad: "info", Hämtad: "success", Besvarad: "success", Aktivt: "success", "Delvis använt": "info", "Under arbete": "info", "Klar för hämtning": "success", Mottagen: "warning" };

/* ===================== ÖVERSIKT ===================== */
function Dashboard({ cfg, go }) {
  const B = AD.MOCK.bokningar;
  const hasBooking = cfg.modules.booking && cfg.modules.booking !== "off";
  const revenue = B.filter(b => b.paid).reduce((s, b) => s + b.price, 0);
  const liveModules = Object.entries(cfg.modules).filter(([k, v]) => v === "live").map(([k]) => AD.MODULE_DEFS[k] && AD.MODULE_DEFS[k].name).filter(Boolean);
  const stats = [
    hasBooking && ["Bokningar idag", B.filter(b => b.time.startsWith("Idag")).length, "calendar"],
    hasBooking && ["Klara & betalda", B.filter(b => b.paid).length, "checkCircle"],
    ["Omsättning (betalt)", revenue.toLocaleString("sv-SE") + " kr", "dollar"],
    cfg.modules.lojalitet === "live" && ["Nya stammisar · v.", 3, "heart"],
  ].filter(Boolean);
  return (
    <div>
      <PageHead title={`God morgon, ${cfg.name}`} sub="Ditt kontrollcenter — allt på ett ställe."
        action={<SBtn variant="ghost" icon="external" onClick={() => go("__site")}>Se din sida</SBtn>} />
      <NewBanner><b>Adminen är byggd av dina moduler.</b> Du ser bara det som hör till det du aktiverat i onboarding — {liveModules.join(", ") || "inga moduler än"}. Slår superadmin på en ny modul tänds dess sidor här automatiskt. Inget byggs om.</NewBanner>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(stats.length, 1)},1fr)`, gap: 14, marginBottom: 18 }}>
        {stats.map(([l, v, ic]) => (
          <SCard key={l} pad={18}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: 12.5, color: "var(--c-ink-3)", fontWeight: 500 }}>{l}</span>
              <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--c-paper-2)", display: "grid", placeItems: "center", color: "var(--c-forest)" }}><Icon name={ic} size={16} /></span>
            </div>
            <div className="num" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 30, color: "var(--c-forest)", marginTop: 8 }}>{v}</div>
          </SCard>
        ))}
      </div>
      {hasBooking && (
        <SCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 16, margin: 0, color: "var(--c-ink)" }}>Kommande bokningar</h2>
            <SBtn variant="subtle" size="sm" onClick={() => go("bokningar")} iconRight="arrowRight">Alla</SBtn>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {B.filter(b => b.status === "gjord").map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "var(--c-paper-2)" }}>
                <span className="num" style={{ fontWeight: 600, fontSize: 13, color: "var(--c-forest)", minWidth: 98 }}>{b.time}</span>
                <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--c-ink)", flex: 1 }}>{b.customer}</span>
                <span style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>{b.service}</span>
                <SBadge tone="neutral" dot={false}>{b.staff}</SBadge>
              </div>
            ))}
          </div>
        </SCard>
      )}
    </div>
  );
}

/* ===================== BOKNINGAR ===================== */
function Bokningar({ cfg }) {
  const [filter, setFilter] = useStateS("alla");
  const [q, setQ] = useStateS("");
  const [sel, setSel] = useStateS(null);
  const rows = AD.MOCK.bokningar.filter(b => (filter === "alla" || b.status === filter) && (!q || b.customer.toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <PageHead title="Bokningar" sub="Kontroll-navet — sök, filtrera, se vad som hänt." />
      <NewBanner><b>Live-kopplat och filtrerbart.</b> Avbokar du här → tiden går tillbaka till din publika sida automatiskt. Status syns alltid (gjord · klar · avbokad), och bokningar <b>försvinner aldrig</b> även när de auto-markeras klara.</NewBanner>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["alla", "gjord", "klar", "avbokad"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ textTransform: "capitalize", fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 13, padding: "8px 14px", borderRadius: 9, cursor: "pointer", border: "1px solid " + (filter === f ? "var(--c-forest)" : "var(--c-line)"), background: filter === f ? "var(--c-forest)" : "var(--c-paper)", color: filter === f ? "#fff" : "var(--c-ink-2)" }}>{f}</button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 180, maxWidth: 280 }}><SField ph="Sök kund…" val={q} on={setQ} /></div>
      </div>
      <SCard pad={0}>
        <div style={{ display: "grid", gridTemplateColumns: "116px 1fr 1.1fr 90px 100px 96px", padding: "11px 18px", background: "var(--c-paper-2)", borderBottom: "1px solid var(--c-line)" }}>
          {["Tid", "Kund", "Tjänst", cfg.staffWord, "Status", "Betalt"].map(h => <div key={h} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-ink-3)" }}>{h}</div>)}
        </div>
        {rows.map((b, i) => (
          <div key={i} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: "pointer", borderTop: i ? "1px solid var(--c-line)" : "none", background: sel === i ? "var(--c-paper-2)" : "transparent" }}>
            <div style={{ display: "grid", gridTemplateColumns: "116px 1fr 1.1fr 90px 100px 96px", padding: "13px 18px", alignItems: "center" }}>
              <span className="num" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-forest)" }}>{b.time}</span>
              <span style={{ fontSize: 13.5, color: "var(--c-ink)", fontWeight: 500 }}>{b.customer}</span>
              <span style={{ fontSize: 13, color: "var(--c-ink-2)" }}>{b.service}</span>
              <span style={{ fontSize: 13, color: "var(--c-ink-2)" }}>{b.staff}</span>
              <span><SBadge tone={statusTone[b.status]} dot={false}>{b.status}</SBadge></span>
              <span>{b.paid ? <SBadge tone="success">betald</SBadge> : <span style={{ fontSize: 12, color: "var(--c-ink-3)" }}>—</span>}</span>
            </div>
            {sel === i && (
              <div style={{ padding: "0 18px 16px", display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center" }}>
                <Detail label="Längd" val={b.dur + " min"} />
                <Detail label="Pris" val={b.price + " kr"} />
                <Detail label="Bokad" val={b.booked} />
                <Detail label="Telefon (drift-fönster)" val={b.phone} />
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  {b.status !== "klar" && <SBtn size="sm" variant="primary">Markera klar</SBtn>}
                  {b.status !== "avbokad" && <SBtn size="sm" variant="ghost">Avboka</SBtn>}
                </div>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--c-ink-3)", fontSize: 13.5 }}>Inga bokningar matchar.</div>}
      </SCard>
      <ModuleTables keys={["bookings", "customers", "services", "staff"]} />
    </div>
  );
}
function Detail({ label, val }) {
  return <div><div style={{ fontSize: 10.5, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--c-ink-3)", fontWeight: 600 }}>{label}</div><div className="num" style={{ fontSize: 13.5, color: "var(--c-ink)", marginTop: 2 }}>{val}</div></div>;
}

/* ===================== TJÄNSTER ===================== */
function Tjanster({ cfg }) {
  return (
    <div>
      <PageHead title={cfg.serviceLabel} sub="Det du erbjuder — priser, längd, var det syns." action={<SBtn variant="gold" icon="plus">Ny {cfg.serviceWord.toLowerCase()}</SBtn>} />
      <NewBanner><b>Du ser var det hamnar på sajten.</b> Lägger du till eller ändrar något slår det igenom på din publika bokningssida <b>utan kod och utan deploy</b>. Längden styr hur långt bokningspasset blir.</NewBanner>
      <SCard pad={0}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 100px 90px 90px 1fr 60px", padding: "11px 18px", background: "var(--c-paper-2)", borderBottom: "1px solid var(--c-line)" }}>
          {[cfg.serviceWord, "Kategori", "Längd", "Pris", "Bokningar 30 dgr", ""].map(h => <div key={h} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--c-ink-3)" }}>{h}</div>)}
        </div>
        {AD.MOCK.services.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 100px 90px 90px 1fr 60px", padding: "13px 18px", alignItems: "center", borderTop: i ? "1px solid var(--c-line)" : "none", opacity: s.active ? 1 : 0.55 }}>
            <span style={{ fontSize: 14, color: "var(--c-ink)", fontWeight: 600 }}>{s.name}</span>
            <span style={{ fontSize: 13, color: "var(--c-ink-2)" }}>{s.cat}</span>
            <span className="num" style={{ fontSize: 13, color: "var(--c-ink-2)" }}>{s.dur} min</span>
            <span className="num" style={{ fontSize: 13.5, color: "var(--c-ink)", fontWeight: 600 }}>{s.price} kr</span>
            <span className="num" style={{ fontSize: 13, color: "var(--c-ink-3)" }}>{s.n} st</span>
            <span style={{ color: "var(--c-ink-3)" }}><Icon name="edit" size={15} style={{ cursor: "pointer" }} /></span>
          </div>
        ))}
      </SCard>
      <ModuleTables keys={["services"]} />
    </div>
  );
}

/* ===================== PERSONAL ===================== */
function Personal({ cfg }) {
  return (
    <div>
      <PageHead title="Personal" sub="Ditt team — roller, kompetenser, dagens belastning." action={<SBtn variant="gold" icon="plus">Lägg till</SBtn>} />
      <NewBanner><b>Mer än CRUD — speglar deras verkliga dag.</b> Varje {cfg.staffWord.toLowerCase()} visar roll, kompetenser och dagens bokningar (samma vy de själva ser i personalportalen). Du styr vilka tjänster var och en kan utföra.</NewBanner>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14 }}>
        {AD.MOCK.staff.map((s, i) => (
          <SCard key={i} style={{ opacity: s.active ? 1 : 0.6 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 48, height: 48, flex: "none", borderRadius: 999, background: s.active ? "var(--c-forest)" : "var(--c-line-strong)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20 }}>{s.active ? s.name[0] : "+"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15.5, color: "var(--c-ink)" }}>{s.name}</span>
                  {s.active && <SBadge tone="info" dot={false}>{s.today} idag</SBadge>}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--c-gold-600)", fontWeight: 600, marginTop: 2 }}>{term(s.role, cfg)}</div>
                <p style={{ fontSize: 13, color: "var(--c-ink-2)", lineHeight: 1.5, margin: "8px 0 0" }}>{s.bio}</p>
                {s.services.length > 0 && <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 10 }}>{s.services.map(sv => <span key={sv} style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 999, background: "var(--c-paper-2)", color: "var(--c-ink-2)" }}>{sv}</span>)}</div>}
              </div>
            </div>
          </SCard>
        ))}
      </div>
      <ModuleTables keys={["staff", "staff_services"]} />
    </div>
  );
}

/* ===================== SCHEMA ===================== */
function Schema() {
  return (
    <div>
      <PageHead title="Schema" sub="Dina bokningsbara tider — du bestämmer exakt när." action={<SBtn variant="ghost" icon="upload">Importera mönster</SBtn>} />
      <NewBanner><b>Explicita starttider, inte fasta raster.</b> Du sätter exakt vilka tider som går att boka — ojämna intervaller är okej (12:30, 13:05, 14:00…). Tjänstens längd styr passet. Vi bootar upp ett schema från ditt nuvarande system så du bara tweakar.</NewBanner>
      <div style={{ display: "grid", gap: 10 }}>
        {Object.keys(AD.MOCK.schedule).map(d => (
          <SCard key={d} pad={16}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--c-forest)", width: 86, flex: "none" }}>{d}</span>
              {AD.MOCK.schedule[d].length === 0 ? (
                <span style={{ fontSize: 13, color: "var(--c-ink-3)", fontStyle: "italic" }}>Stängt</span>
              ) : (
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", flex: 1 }}>
                  {AD.MOCK.schedule[d].map(t => <span key={t} className="num" style={{ fontSize: 12.5, fontWeight: 600, padding: "5px 11px", borderRadius: 8, background: "var(--c-paper-2)", color: "var(--c-ink)", border: "1px solid var(--c-line)" }}>{t}</span>)}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, fontWeight: 600, padding: "5px 11px", borderRadius: 8, color: "var(--c-forest)", border: "1px dashed var(--c-line-strong)", cursor: "pointer" }}><Icon name="plus" size={13} />Tid</span>
                </div>
              )}
            </div>
          </SCard>
        ))}
      </div>
      <ModuleTables keys={["working_hours", "→ matar M3 slots"]} />
    </div>
  );
}

window.SURFACES_CORE = { Dashboard, Bokningar, Tjanster, Personal, Schema, PageHead, NewBanner, ModuleTables, term, statusTone, Detail };
