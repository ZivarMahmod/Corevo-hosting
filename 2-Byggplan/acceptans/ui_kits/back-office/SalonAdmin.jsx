/* Salong-admin — Dashboard (kontrollcenter, M6 §3.8).
   Reads live bookings from the shared store. No traffic analytics (v1). */
const { useState: useStateDash } = React;

/* tiny horizontal bar */
function PeakChart({ data }) {
  const max = Math.max(...data.map(d => d.n));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 7, height: 130, padding: "0 2px" }}>
      {data.map(d => (
        <div key={d.h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
          <div style={{ width: "100%", height: `${(d.n / max) * 100}%`, minHeight: 5, borderRadius: "6px 6px 3px 3px", background: d.n === max ? "var(--c-gold)" : "var(--c-forest-300)", transition: "height var(--dur-base)" }} title={`${d.n} bokningar`} />
          <span className="num" style={{ fontSize: 11, color: "var(--c-ink-3)" }}>{d.h}</span>
        </div>
      ))}
    </div>
  );
}

function MixBar({ data }) {
  return (
    <div>
      <div style={{ display: "flex", height: 14, borderRadius: 999, overflow: "hidden", boxShadow: "inset 0 0 0 1px var(--c-line)" }}>
        {data.map(d => <div key={d.name} style={{ width: `${d.pct}%`, background: d.color }} title={`${d.name} ${d.pct}%`} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 18px", marginTop: 16 }}>
        {data.map(d => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: d.color, flex: "none" }} />
            <span style={{ fontSize: 13, color: "var(--c-ink-2)", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
            <span className="num" style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)" }}>{d.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickAction({ icon, title, sub, onClick, tone }) {
  return (
    <button onClick={onClick} style={{ flex: 1, minWidth: 150, display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", borderRadius: 13, border: "1px solid var(--c-line)", background: tone === "gold" ? "var(--c-gold-100)" : "var(--c-paper)", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-ui)", transition: "all var(--dur-fast)", boxShadow: "var(--shadow-sm)" }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
      <span style={{ width: 38, height: 38, borderRadius: 10, background: tone === "gold" ? "var(--c-gold)" : "var(--c-forest)", color: tone === "gold" ? "#3A2A06" : "#fff", display: "grid", placeItems: "center", flex: "none" }}><Icon name={icon} size={19} /></span>
      <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14, color: "var(--c-ink)" }}>{title}</div><div style={{ fontSize: 12, color: "var(--c-ink-3)" }}>{sub}</div></div>
    </button>
  );
}

function SalonDashboard({ onNav, assist }) {
  const { bookings, actions } = useStore();
  const { SERVICE_MIX, PEAK_HOURS, custName, CUSTOMERS } = window.BO;
  const active = bookings.filter(b => b.status !== "avbokad");
  const upcoming = active.filter(b => b.status === "gjord");
  const done = active.filter(b => b.status === "klar");
  const cust = id => CUSTOMERS.find(c => c.id === id);

  return (
    <div>
      <PageHead eyebrow={(assist ? "Support · " : "") + "Studio Salvia · tis 2 juni"} title={assist ? "Du hjälper Elin" : "God morgon, Elin"}
        sub={assist ? "Du är inne i salongens admin remote. Gör det de behöver — allt loggas." : "Se dina bokningar och klipp — resten finns här om något händer. Allt speglar verkligheten live."}>
        <Button variant="ghost" icon="external">Se din sida</Button>
        <Button variant="primary" icon="plus">Ny bokning</Button>
      </PageHead>

      {/* snabbåtgärder — det man gör oftast, alltid en knapptryckning bort */}
      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <QuickAction icon="calendar" title="Dagens bokningar" sub={`${active.length} idag · ${upcoming.length} kvar`} onClick={() => onNav && onNav("Bokningar")} tone="gold" />
        <QuickAction icon="plus" title="Ny bokning" sub="Lägg in en tid manuellt" onClick={() => onNav && onNav("Bokningar")} />
        <QuickAction icon="users" title="Lägg till kund" sub="Stabil kund-rad" onClick={() => onNav && onNav("Kunder")} />
        <QuickAction icon="external" title="Se din sida" sub="salvia.corevo.se" onClick={() => actions.notify("Öppnar storefronten…", "info", "external")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 18 }} className="bo-stat-grid">
        <Stat label="Idag" value={active.length} icon="calendar" hint={`${done.length} klara · ${upcoming.length} kvar`} />
        <Stat label="Denna vecka" value="38" delta="+5 mot förra" icon="trendUp" />
        <Stat label="Beläggning" value="82%" icon="users" hint="Idag · 7 lediga tider" />
        <Stat label="Nya lojalitetskunder" value="14" delta="+4 denna vecka" icon="gift" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }} className="bo-2col">
        {/* left */}
        <div style={{ display: "grid", gap: 16 }}>
          <Card pad={0}>
            <div style={{ padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 className="h2">Kommande idag</h2>
              <button onClick={() => onNav && onNav("Bokningar")} style={{ border: "none", background: "transparent", color: "var(--c-forest)", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--font-ui)" }}>Alla bokningar <Icon name="arrowRight" size={15} /></button>
            </div>
            <div style={{ padding: "0 10px 10px" }}>
              {upcoming.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--c-ink-3)", fontSize: 13.5 }}>Inga fler tider kvar idag.</div>}
              {upcoming.map(b => {
                const c = cust(b.customerId);
                return (
                  <div key={b.id} onClick={() => onNav && onNav("Bokningar")} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, cursor: "pointer", transition: "background var(--dur-fast)" }} onMouseEnter={e => e.currentTarget.style.background = "var(--c-paper-2)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div className="num" style={{ width: 48, fontWeight: 700, color: "var(--c-forest)", fontSize: 15 }}>{b.time}</div>
                    <div style={{ width: 3, height: 34, borderRadius: 999, background: "var(--c-gold)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>{custName(c)}{b.notes.some(n => n.from === "kund") && <Icon name="message" size={14} style={{ color: "var(--c-gold-600)" }} />}</div>
                      <div style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>{b.service} · {b.dur} min</div>
                    </div>
                    <span style={{ fontSize: 13, color: "var(--c-ink-2)" }}>{b.staff}</span>
                    <StatusBadge status={b.status} paid={b.paid} />
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 className="h2">Dagens topptimmar</h2>
              <span className="small">När flest kunder kommer</span>
            </div>
            <PeakChart data={PEAK_HOURS} />
          </Card>
        </div>

        {/* right */}
        <div style={{ display: "grid", gap: 16 }}>
          <Card>
            <h2 className="h2" style={{ marginBottom: 16 }}>Tjänste-mix</h2>
            <MixBar data={SERVICE_MIX} />
          </Card>

          <Card style={{ background: "var(--c-forest)", color: "var(--c-on-forest)", border: "none" }}>
            <span className="eyebrow" style={{ color: "var(--c-gold)" }}>Röd tråd</span>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 700, color: "#fff", margin: "8px 0 6px" }}>Din sida, live</h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--c-on-forest-2)", margin: 0 }}>Avboka en tid och den blir bokningsbar igen på storefronten direkt — ingen extra knapp, ingen deploy.</p>
            <Button variant="gold" icon="external" style={{ marginTop: 16 }}>Öppna salvia.corevo.se</Button>
          </Card>

          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "#635BFF", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-ui)", fontWeight: 700 }}>S</div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>Stripe</div><div style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>Utbetalning varje vecka</div></div>
              <Badge tone="success">Ansluten</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SalonDashboard, PeakChart, MixBar });
