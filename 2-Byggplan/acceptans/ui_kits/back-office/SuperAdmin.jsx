/* Super admin / platform (M7) — Zivars kontrollcenter.
   "Supabase-kraft med mitt UI — klicka och lek med allt, röd tråd,
   meningsfulla flikar. Premium utan kod." Allt mappar mot riktiga
   tabeller/flöden (tenants, billing flöde 2, audit, deriveOnboarding). */
const { useState: useStateSA } = React;

/* storefront template configs — mirror colors_and_type.css theme tokens so the
   onboarding preview shows the real look of each template. */
const THEMES = {
  Salvia:  { primary: "#5E7361", bg: "#F6F4EE", surface: "#fff", fg: "#232520", fg2: "#5C5F55", line: "#E2DED2", display: "'Cormorant Garamond', Georgia, serif", body: "'Jost', sans-serif", radius: 10, caps: false, vibe: "Lugn & minimal", eyebrow: "Frisörsalong", hero: "Skarpt klippt. Skönt mottagen.", lede: "En stilla salong där varje klippning får ta sin tid." },
  Leander: { primary: "#7E6E92", bg: "#FBFAF8", surface: "#fff", fg: "#2A2630", fg2: "#6A6472", line: "#ECE7EF", display: "'Playfair Display', Georgia, serif", body: "'Inter', sans-serif", radius: 14, caps: false, vibe: "Romantisk editorial", eyebrow: "Salong & studio", hero: "Din stund av lugn.", lede: "Mjuka toner och varsam hand i en romantisk miljö." },
  Zigge:   { primary: "#C8743C", bg: "#14120E", surface: "#1E1B16", fg: "#F2ECE2", fg2: "#B3A998", line: "#322C24", display: "'Bebas Neue', sans-serif", body: "'Archivo', sans-serif", radius: 4, caps: true, vibe: "Mörk & rå barber", eyebrow: "Barber & frisör", hero: "Skarp fade. Ren stil.", lede: "Klassisk barbering med modern attityd." },
  Linnea:  { primary: "#B0693F", bg: "#F4EDE1", surface: "#fff", fg: "#2E2820", fg2: "#6E6452", line: "#E3D9C8", display: "'DM Serif Display', Georgia, serif", body: "'Inter', sans-serif", radius: 12, caps: false, vibe: "Varm skandinavisk", eyebrow: "Hår & välmående", hero: "Naturligt vacker.", lede: "Varma jordnära toner i en avslappnad salong." },
  Edit:    { primary: "#3A3733", bg: "#F8F6F1", surface: "#fff", fg: "#232220", fg2: "#6B675F", line: "#E5E0D6", display: "'Cormorant Garamond', Georgia, serif", body: "'Inter', sans-serif", radius: 2, caps: false, vibe: "Elegant minimal", eyebrow: "Hair atelier", hero: "Tidlöst. Editorial.", lede: "Ren typografi och skarp komposition." },
};

function ThemePreview({ name, salon }) {
  const t = THEMES[name];
  const slug = (salon || "salong").toLowerCase().replace(/[^a-z0-9]/g, "") || "salong";
  return (
    <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--c-line)", boxShadow: "var(--shadow-md)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", background: "#EDEAE3", borderBottom: "1px solid var(--c-line)" }}>
        <span style={{ width: 10, height: 10, borderRadius: 999, background: "#E0726A" }} /><span style={{ width: 10, height: 10, borderRadius: 999, background: "#E6B34D" }} /><span style={{ width: 10, height: 10, borderRadius: 999, background: "#7FB47F" }} />
        <div style={{ marginLeft: 8, fontSize: 11.5, color: "var(--c-ink-3)", fontFamily: "var(--font-ui)", background: "#fff", padding: "3px 11px", borderRadius: 999 }}>{slug}.corevo.se</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", background: t.bg, minHeight: 280 }}>
        <div style={{ padding: "26px 28px", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: t.display, fontSize: t.caps ? 20 : 18, fontWeight: 600, color: t.fg, textTransform: t.caps ? "uppercase" : "none", letterSpacing: t.caps ? ".04em" : 0 }}>{salon}</span>
            <span style={{ background: t.primary, color: "#fff", fontFamily: t.body, fontSize: 11, fontWeight: 600, padding: "7px 14px", borderRadius: t.radius >= 999 ? 999 : t.radius * 2 }}>Boka tid</span>
          </div>
          <div style={{ marginTop: "auto" }}>
            <span style={{ fontFamily: t.body, fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: t.primary, fontWeight: 600 }}>— {t.eyebrow}</span>
            <div style={{ fontFamily: t.display, fontSize: 34, fontWeight: 600, color: t.fg, lineHeight: t.caps ? 1.12 : 1.04, margin: "8px 0 0", textTransform: t.caps ? "uppercase" : "none", letterSpacing: t.caps ? ".01em" : "-0.01em" }}>{t.hero}</div>
            <p style={{ fontFamily: t.body, fontSize: 12.5, color: t.fg2, lineHeight: 1.5, margin: t.caps ? "14px 0 0" : "10px 0 0", maxWidth: 280 }}>{t.lede}</p>
            <div style={{ display: "flex", gap: 7, marginTop: 16, flexWrap: "wrap" }}>
              {["Klippning", "Färg", "Styling"].map(s => <span key={s} style={{ fontFamily: t.body, fontSize: 11, color: t.fg2, border: `1px solid ${t.line}`, borderRadius: t.radius >= 999 ? 999 : t.radius + 4, padding: "5px 11px" }}>{s}</span>)}
            </div>
          </div>
        </div>
        <div style={{ position: "relative", backgroundImage: `url(${(window.__resources && window.__resources.salonHero) || "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&q=80&auto=format&fit=crop"})`, backgroundSize: "cover", backgroundPosition: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: name === "Zigge" ? "linear-gradient(180deg, rgba(20,18,14,.1), rgba(20,18,14,.5))" : "linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.12))" }} />
        </div>
      </div>
    </div>
  );
}

function statusTone(s) { return s === "Aktiv" ? "success" : s === "Pausad" ? "warning" : s === "Onboarding" ? "info" : "neutral"; }
function HealthPill({ h }) {
  const dot = { success: "var(--c-success)", info: "var(--c-info)", warning: "var(--c-warning)" }[h.tone] || "var(--c-success)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--c-paper)", border: "1px solid var(--c-line)", borderRadius: 12, flex: 1, minWidth: 150 }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: dot, flex: "none", boxShadow: `0 0 0 4px color-mix(in srgb, ${dot} 18%, transparent)` }} />
      <div style={{ minWidth: 0 }}><div className="num" style={{ fontSize: 15, fontWeight: 700, color: "var(--c-ink)" }}>{h.value}</div><div style={{ fontSize: 11.5, color: "var(--c-ink-3)" }}>{h.label} · {h.sub}</div></div>
    </div>
  );
}

function SuperOverview({ onNav, onOpenTenant }) {
  const { SALONS } = window.BO;
  const SU = window.SU;
  const tenants = Object.values(SU.TENANTS);
  const auditTone = { info: "var(--c-info)", success: "var(--c-success)", warning: "var(--c-warning)", danger: "var(--c-danger)", neutral: "var(--c-ink-3)" };
  return (
    <div>
      <PageHead eyebrow="Plattform · Zivar" title="Översikt"
        sub="Din insyn över alla salonger — klicka in på vilken som helst och styr allt utan kod.">
        <Button variant="ghost" icon="upload">Exportera</Button>
        <Button variant="primary" icon="plus" onClick={() => onNav("Onboarda salong")}>Onboarda salong</Button>
      </PageHead>

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        {SU.HEALTH.map(h => <HealthPill key={h.label} h={h} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 18 }} className="bo-stat-grid">
        <Stat label="Salonger" value="24" delta="+3 denna månad" icon="building" />
        <Stat label="Aktiva" value="21" delta="88% aktiva" icon="checkCircle" />
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span className="eyebrow">Bokningar · mån</span>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--c-paper-2)", color: "var(--c-forest)", display: "grid", placeItems: "center" }}><Icon name="trendUp" size={18} /></div>
          </div>
          <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, color: "var(--c-forest)", lineHeight: 1.1, margin: "8px 0 6px" }}>6 240</div>
          <Sparkline data={SU.TREND} w={240} h={40} />
        </Card>
        <Stat label="Underlag · mån" value="24 960 kr" delta="flöde 2 · manuell" icon="dollar" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }} className="bo-2col">
        <Card pad={0}>
          <div style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 className="h2">Alla salonger</h2>
            <button onClick={() => onNav("Salonger")} style={{ border: "none", background: "transparent", color: "var(--c-forest)", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-ui)" }}>Hantera <Icon name="arrowRight" size={15} /></button>
          </div>
          <Table cols={["Salong", "Subdomän", "Stad", "Senast aktiv", "Bokningar", "Status"]} onRow={i => onOpenTenant(tenants[i].slug)}
            rows={tenants.map(t => [
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: t.dot }} /><b style={{ fontWeight: 600 }}>{t.name}</b></span>,
              <span style={{ color: "var(--c-ink-3)" }}>{t.slug}.corevo.se</span>, t.city,
              <span style={{ color: "var(--c-ink-2)", fontSize: 12.5 }}>{t.lastActive}</span>,
              <span className="num">{t.bookings}</span>,
              <Badge tone={statusTone(t.status)}>{t.status}</Badge>,
            ])} />
        </Card>

        <div style={{ display: "grid", gap: 16 }}>
          <Card pad={0}>
            <div style={{ padding: "16px 20px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="h2">Senaste händelser</h2>
              <button onClick={() => onNav("Drift & logg")} style={{ border: "none", background: "transparent", color: "var(--c-forest)", fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-ui)" }}>Audit-logg</button>
            </div>
            <div style={{ padding: "0 12px 12px" }}>
              {SU.AUDIT.slice(0, 5).map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 11, padding: "9px 10px" }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--c-paper-2)", color: auditTone[a.tone], display: "grid", placeItems: "center", flex: "none" }}><Icon name={a.icon} size={15} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)" }}>{a.action}</div><div style={{ fontSize: 11.5, color: "var(--c-ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.target}</div></div>
                  <span style={{ fontSize: 11, color: "var(--c-ink-3)", flex: "none" }}>{a.at}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card style={{ background: "var(--c-forest)", color: "var(--c-on-forest)", border: "none" }}>
            <span className="eyebrow" style={{ color: "var(--c-gold)" }}>Premium utan kod</span>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "#fff", margin: "8px 0 6px" }}>Supabase-kraft, ditt UI</h2>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--c-on-forest-2)", margin: "0 0 14px" }}>Lägg till kund, skicka lösenordsreset, sätt recensionslänk — utan att röra rå-databasen.</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="gold" size="sm" icon="mail" onClick={() => onNav("Kunder")}>Lösenordsreset</Button>
              <Button variant="ghost" size="sm" icon="scissors" onClick={() => onNav("Personal")} style={{ color: "#fff", borderColor: "var(--c-forest-300)" }}>Onboarda personal</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SuperSalons({ onOpenTenant, onNav }) {
  const SU = window.SU;
  const tenants = Object.values(SU.TENANTS);
  const [q, setQ] = useStateSA("");
  const [filter, setFilter] = useStateSA("Alla");
  const [view, setView] = useStateSA("Kort");
  const list = tenants.filter(t => (filter === "Alla" || t.status === filter) && (t.name + t.owner + t.city).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHead eyebrow="Plattform" title="Salonger" sub="Dina kunder. Öppna en salong för full kontroll — data, personal, branding, drift.">
        <Button variant="ghost" icon="upload">Exportera</Button>
        <Button variant="primary" icon="plus" onClick={() => onNav("Onboarda salong")}>Onboarda salong</Button>
      </PageHead>
      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--c-ink-3)" }}><Icon name="search" size={16} /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Sök salong, ägare, stad…" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        {["Alla", "Aktiv", "Pausad", "Onboarding"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--c-line)", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 600, background: filter === f ? "var(--c-forest)" : "var(--c-paper)", color: filter === f ? "#fff" : "var(--c-ink-2)" }}>{f}</button>
        ))}
        <div style={{ display: "flex", gap: 2, background: "var(--c-paper-2)", padding: 3, borderRadius: 10 }}>
          {[["Kort", "grid"], ["Lista", "menu"]].map(([k, ic]) => (
            <button key={k} onClick={() => setView(k)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, background: view === k ? "var(--c-paper)" : "transparent", color: view === k ? "var(--c-forest)" : "var(--c-ink-3)", boxShadow: view === k ? "var(--shadow-sm)" : "none" }}><Icon name={ic} size={15} />{k}</button>
          ))}
        </div>
      </div>

      {view === "Lista" ? (
        <Card pad={0}>
          <Table cols={["Salong", "Ägare", "Variant", "Personal", "Bokningar", "Status", ""]} onRow={i => onOpenTenant(list[i].slug)}
            rows={list.map(t => [
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 30, height: 30, borderRadius: 8, background: t.dot, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontFamily: "var(--font-display)", flex: "none" }}>{t.name[0]}</span><span><b style={{ fontWeight: 600 }}>{t.name}</b><div style={{ fontSize: 12, color: "var(--c-ink-3)" }}>{t.slug}.corevo.se</div></span></span>,
              t.owner, <span style={{ fontSize: 12.5, color: "var(--c-ink-2)" }}>{t.variant}</span>,
              <span className="num">{t.staff}</span>, <span className="num">{t.bookings}</span>,
              <Badge tone={statusTone(t.status)}>{t.status}</Badge>,
              <Icon name="arrowRight" size={17} style={{ color: "var(--c-ink-3)" }} />,
            ])} />
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px,1fr))", gap: 16 }}>
          {list.map(t => (
            <Card key={t.slug} onClick={() => onOpenTenant(t.slug)} style={{ cursor: "pointer", transition: "all var(--dur-fast)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 11, background: t.dot, display: "grid", placeItems: "center", color: "#fff", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{t.name[0]}</div>
                  <div><div style={{ fontWeight: 600, fontSize: 15, color: "var(--c-ink)" }}>{t.name}</div><div style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>{t.slug}.corevo.se</div></div>
                </div>
                <Badge tone={statusTone(t.status)}>{t.status}</Badge>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--c-line)" }}>
                <KV label="Bokningar" value={<span className="num">{t.bookings}</span>} />
                <KV label="Personal" value={<span className="num">{t.staff}</span>} />
                <KV label="Senast" value={<span style={{ fontSize: 12.5 }}>{t.lastActive}</span>} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--c-ink-2)", background: "var(--c-paper-2)", borderRadius: 999, padding: "4px 10px" }}>{t.theme}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--c-ink-2)", background: "var(--c-paper-2)", borderRadius: 999, padding: "4px 10px" }}>{t.variant}</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: t.level === 3 ? "var(--c-gold-600)" : "var(--c-ink-3)", background: t.level === 3 ? "var(--c-gold-100)" : "var(--c-paper-2)", borderRadius: 999, padding: "4px 10px" }}>Nivå {t.level}</span>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <Button variant="ghost" size="sm" icon="arrowRight" style={{ flex: 1, justifyContent: "center" }} onClick={e => { e.stopPropagation(); onOpenTenant(t.slug); }}>Öppna</Button>
                <Button variant="subtle" size="sm" icon="external" onClick={e => e.stopPropagation()}>Storefront</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SuperOnboard() {
  const SU = window.SU;
  const [step, setStep] = useStateSA(0);
  const [data, setData] = useStateSA({ name: "", sub: "", theme: "Salvia", variant: "wizard", owner: "" });
  const steps = ["Namn & subdomän", "Temamall", "Bokningsvariant", "Token-branding", "Ägare & roll"];
  const themeKeys = ["Salvia", "Leander", "Zigge", "Linnea", "Edit"];
  return (
    <div style={{ maxWidth: 820 }}>
      <PageHead eyebrow="Plattform" title="Onboarda ny salong" sub="Du skapar salongerna — inte publik self-service. Fyll det du vill, inget fält är tvingande." />

      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 16px", background: "var(--c-info-bg)", borderRadius: 12, marginBottom: 18 }}>
        <Icon name="info" size={17} style={{ color: "var(--c-info)", flex: "none" }} />
        <span style={{ fontSize: 13, color: "var(--c-ink)" }}>Inga forcerade måste-fält — du la friction på det förut. Skapandet är <b>atomiskt</b>: slug + settings + ägarroll i ett svep.</span>
      </div>

      <Card>
        <div style={{ display: "flex", gap: 6, marginBottom: 26 }}>
          {steps.map((s, i) => (
            <div key={s} style={{ flex: 1 }}>
              <div style={{ height: 4, borderRadius: 999, background: i <= step ? "var(--c-gold)" : "var(--c-line)", transition: "all var(--dur-base)" }} />
              <div style={{ fontSize: 12, marginTop: 8, color: i <= step ? "var(--c-ink)" : "var(--c-ink-3)", fontWeight: i === step ? 600 : 500, fontFamily: "var(--font-ui)" }}>{i + 1}. {s}</div>
            </div>
          ))}
        </div>

        {step === 0 && (
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="Salongsnamn" hint="Valfritt nu — går att ändra sen." ph="t.ex. Klippoteket" val={data.name} on={v => setData(d => ({ ...d, name: v, sub: v.toLowerCase().replace(/[^a-z]/g, "") }))} />
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)", fontFamily: "var(--font-ui)" }}>Subdomän</label>
              <div style={{ display: "flex", alignItems: "center", marginTop: 6, border: "1px solid var(--c-line)", borderRadius: 10, overflow: "hidden", background: "var(--c-paper)" }}>
                <input value={data.sub} onChange={e => setData(d => ({ ...d, sub: e.target.value }))} placeholder="klippoteket" style={{ flex: 1, padding: "11px 13px", border: "none", outline: "none", fontFamily: "var(--font-ui)", fontSize: 14, background: "transparent" }} />
                <span style={{ padding: "0 14px", color: "var(--c-ink-3)", fontSize: 14, fontFamily: "var(--font-ui)", borderLeft: "1px solid var(--c-line)", alignSelf: "stretch", display: "grid", placeItems: "center" }}>.corevo.se</span>
              </div>
              <div style={{ marginTop: 8 }}><TableChip>tenants · tenant_settings</TableChip></div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 22 }}>
              {themeKeys.map(name => {
                const on = data.theme === name; const t = THEMES[name];
                return (
                  <button key={name} onClick={() => setData(d => ({ ...d, theme: name }))} style={{ textAlign: "left", padding: 5, border: `2px solid ${on ? "var(--c-forest)" : "var(--c-line)"}`, borderRadius: 14, cursor: "pointer", background: "var(--c-paper)", boxShadow: on ? "var(--shadow-md)" : "none", transition: "all var(--dur-fast)" }}>
                    <div style={{ height: 56, borderRadius: 9, background: t.bg, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 10px", overflow: "hidden" }}>
                      <span style={{ fontFamily: t.display, fontSize: t.caps ? 16 : 15, color: t.fg, fontWeight: 600, textTransform: t.caps ? "uppercase" : "none", lineHeight: 1 }}>Aa</span>
                      <span style={{ display: "inline-block", marginTop: 6, width: 30, height: 7, borderRadius: 999, background: t.primary }} />
                    </div>
                    <div style={{ padding: "8px 6px 4px", display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontWeight: 600, fontSize: 13 }}>{name}</span>{on && <Icon name="check" size={14} style={{ color: "var(--c-forest)" }} />}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><Icon name="sun" size={14} style={{ color: "var(--c-gold-600)" }} /><span className="eyebrow">Förhandsvisning · {data.theme} — {THEMES[data.theme].vibe}</span></div>
            <ThemePreview name={data.theme} salon={data.name || "Din salong"} />
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="body" style={{ marginTop: 0, marginBottom: 16 }}>Välj hur bokningen presenteras på salongens storefront. 99 % av bokningarna sker på mobil.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {SU.VARIANTS.map(v => {
                const on = data.variant === v.id;
                return (
                  <button key={v.id} onClick={() => setData(d => ({ ...d, variant: v.id }))} style={{ textAlign: "left", padding: 16, border: `2px solid ${on ? "var(--c-forest)" : "var(--c-line)"}`, borderRadius: 14, cursor: "pointer", background: on ? "var(--c-paper-2)" : "var(--c-paper)", transition: "all var(--dur-fast)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{v.name}</span>
                      {v.rec ? <Badge tone="gold" dot={false}>Rekommenderad</Badge> : <span style={{ fontSize: 11.5, color: "var(--c-ink-3)", fontWeight: 600 }}>{v.tag}</span>}
                    </div>
                    <p style={{ fontSize: 12.5, color: "var(--c-ink-2)", lineHeight: 1.5, margin: 0 }}>{v.desc}</p>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 14 }}><TableChip>kopplar M3 · booking-variants</TableChip></div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="eyebrow">Leksakslådan · no-code</span><TableChip>tenant_settings</TableChip></div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, background: "var(--c-paper-2)", borderRadius: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, border: "2px dashed var(--c-line-strong)", display: "grid", placeItems: "center", color: "var(--c-ink-3)" }}><Icon name="upload" size={20} /></div>
              <div><div style={{ fontWeight: 600, fontSize: 14 }}>Ladda upp logga</div><div style={{ fontSize: 12.5, color: "var(--c-ink-3)", marginTop: 2 }}>PNG/SVG → R2 · valfritt</div></div>
            </div>
            <Field label="Tagline" ph="Hårvård med lugn hand" />
            <div><label style={{ fontSize: 13, fontWeight: 600 }}>Accentfärg</label><div style={{ display: "flex", gap: 10, marginTop: 8 }}>{["#5E7361", "#7E6E92", "#C8743C", "#B0693F", "#3A3733"].map(c => <span key={c} style={{ width: 34, height: 34, borderRadius: 9, background: c, cursor: "pointer", border: "2px solid var(--c-paper)", boxShadow: "0 0 0 1px var(--c-line)" }} />)}</div></div>
            <div style={{ fontSize: 12, color: "var(--c-ink-3)", display: "flex", gap: 8, alignItems: "center" }}><Icon name="info" size={14} /> Look på nivå-3 (scoped CSS) görs via kod i säker miljö — aldrig här.</div>
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="Ägarens namn" ph="Förnamn Efternamn" val={data.owner} on={v => setData(d => ({ ...d, owner: v }))} />
            <Field label="Ägarens e-post" hint="Får en magic-link-invite — bekräftar och sätter eget lösenord." ph="agare@salong.se" />
            <div style={{ padding: 16, background: "var(--c-success-bg)", borderRadius: 12, display: "flex", gap: 12, alignItems: "center" }}>
              <Icon name="checkCircle" size={22} style={{ color: "var(--c-success)", flex: "none" }} />
              <div style={{ fontSize: 13.5, color: "var(--c-ink)" }}><b>{data.name || "Salongen"}</b> skapas på <b>{(data.sub || "subdomän")}.corevo.se</b> med tema <b>{data.theme}</b> och variant <b>{(SU.VARIANTS.find(v => v.id === data.variant) || {}).name}</b>. Ägaren bjuds in.</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--c-ink-3)", display: "flex", gap: 8, alignItems: "center" }}><Icon name="link" size={14} /> Egen domän (steg 5 i stegen) är parkerat — subdomän räcker tills vidare.</div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, paddingTop: 20, borderTop: "1px solid var(--c-line)" }}>
          <Button variant="ghost" icon="arrowLeft" onClick={() => setStep(s => Math.max(0, s - 1))} style={{ opacity: step === 0 ? 0.4 : 1 }}>Tillbaka</Button>
          {step < 4 ? <Button variant="primary" icon="arrowRight" onClick={() => setStep(s => s + 1)}>Fortsätt</Button>
            : <Button variant="gold" icon="check" onClick={() => setStep(0)}>Skapa salong</Button>}
        </div>
      </Card>
    </div>
  );
}

function SuperBilling({ onOpenTenant }) {
  const SU = window.SU;
  const tenants = Object.values(SU.TENANTS).filter(t => t.status !== "Onboarding");
  const amount = t => t.billing === "flat_monthly" ? t.flat : t.completed * t.rate;
  const total = tenants.reduce((s, t) => s + amount(t), 0);
  return (
    <div>
      <PageHead eyebrow="Plattform · flöde 2" title="Fakturering"
        sub="Underlag från completade bokningar per salong. Du fakturerar manuellt utanför systemet — ingen Stripe-prenumeration.">
        <Button variant="ghost" icon="upload">Exportera underlag</Button>
      </PageHead>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 22 }} className="bo-stat-grid">
        <Stat label="Underlag · juni" value={total.toLocaleString("sv-SE") + " kr"} delta="completade bokn. × pris" icon="dollar" />
        <Stat label="Per bokning" value="4 kr" hint="20 salonger" icon="repeat" />
        <Stat label="Fast/mån" value="1 490 kr" hint="Zigge — flat_monthly" icon="building" />
      </div>
      <Card pad={0}>
        <div style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 className="h2">Underlag per salong · juni</h2>
          <TableChip>billing_model · completade/mån</TableChip>
        </div>
        <Table cols={["Salong", "Modell", "Completade", "Pris", "Underlag"]} onRow={i => onOpenTenant(tenants[i].slug)}
          rows={tenants.map(t => [
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: t.dot }} /><b style={{ fontWeight: 600 }}>{t.name}</b></span>,
            <Badge tone={t.billing === "flat_monthly" ? "gold" : "neutral"} dot={false}>{t.billing === "flat_monthly" ? "Fast/mån" : "Per bokning"}</Badge>,
            <span className="num">{t.completed}</span>,
            <span className="num">{t.billing === "flat_monthly" ? "—" : t.rate + " kr"}</span>,
            <b className="num" style={{ fontWeight: 600 }}>{amount(t).toLocaleString("sv-SE")} kr</b>,
          ])} />
      </Card>
    </div>
  );
}

Object.assign(window, { THEMES, ThemePreview, statusTone, SuperOverview, SuperSalons, SuperOnboard, SuperBilling });
