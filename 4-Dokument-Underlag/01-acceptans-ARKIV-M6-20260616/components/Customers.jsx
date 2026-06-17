/* Salong-admin — Kunddatabas (M6 §3.1 + §4, NY yta).
   Skiljer IDENTITET (bestående) från KONTAKT-PII (minimerad, tidsbunden).
   Det är det som ger frisören en bra databas OCH skyddar kunden — olika
   lager, inte samma fält. Lojalitet (M4) byggs på identiteten.            */
const { useState: useStateCu } = React;

function tierTone(t) { return t === "Guld" ? "gold" : t === "Silver" ? "info" : t === "Ny" ? "success" : "neutral"; }

function SalonCustomers() {
  const { customers, revealed, actions } = useStore();
  const { custName } = window.BO;
  const [q, setQ] = useStateCu("");
  const [sel, setSel] = useStateCu(null);
  const list = customers.filter(c => c.fullName.toLowerCase().includes(q.toLowerCase()));
  const selC = customers.find(c => c.id === sel);
  const returning = customers.filter(c => c.visits >= 5).length;

  return (
    <div>
      <PageHead eyebrow="Studio Salvia" title="Kunder"
        sub="Frisören känner igen återkommande kunder år efter år — utan att kundens personuppgifter ligger exponerade.">
        <Button variant="ghost" icon="upload">Exportera</Button>
        <Button variant="primary" icon="plus">Ny kund</Button>
      </PageHead>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 18 }} className="bo-stat-grid">
        <Stat label="Kunder totalt" value={customers.length * 18} icon="users" />
        <Stat label="Återkommande" value={returning} icon="repeat" hint="≥ 5 besök" />
        <Stat label="Guld-nivå" value={customers.filter(c => c.tier === "Guld").length} icon="gift" />
        <Stat label="Skyddat namn" value={customers.filter(c => c.showAs !== "full").length} icon="shield" hint="Kundens val" />
      </div>

      <div style={{ position: "relative", marginBottom: 16, maxWidth: 360 }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--c-ink-3)" }}><Icon name="search" size={16} /></span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Sök kund…" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
      </div>

      <Card pad={0}>
        <Table cols={["Kund", "Nivå", "Besök", "Senaste", "Frisör", "Lojalitet"]} onRow={i => setSel(list[i].id)}
          rows={list.map(c => [
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 30, height: 30, borderRadius: 999, background: "var(--c-forest)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700, flex: "none" }}>{custName(c)[0]}</span><span><b style={{ fontWeight: 600 }}>{custName(c)}</b>{c.showAs !== "full" && <Icon name="shield" size={13} style={{ color: "var(--c-info)", marginLeft: 6, display: "inline", verticalAlign: "-2px" }} />}</span></span>,
            <Badge tone={tierTone(c.tier)}>{c.tier}</Badge>,
            <span className="num">{c.visits}</span>,
            <span style={{ color: "var(--c-ink-2)" }}>{c.lastVisit}</span>,
            c.favStaff,
            <span className="num" style={{ fontWeight: 600, color: "var(--c-gold-600)" }}>{c.points.toLocaleString("sv-SE")} p</span>,
          ])} />
      </Card>

      <DetailModal open={!!selC} onClose={() => setSel(null)} width={460}
        title={selC ? custName(selC) : ""} sub={selC ? `Kund sedan ${selC.since} · ${selC.visits} besök` : ""}
        accent={selC && <div style={{ marginBottom: 8 }}><Badge tone={tierTone(selC.tier)}>{selC.tier}-kund</Badge></div>}>
        {selC && <CustomerDetail key={selC.id} c={selC} revealed={!!revealed[selC.id]} actions={actions} />}
      </DetailModal>
    </div>
  );
}

function CustomerDetail({ c, revealed, actions }) {
  const { MY_HISTORY } = window.BO;
  const showOpts = [["full", "Fullt namn"], ["first", "Förnamn"], ["initial", "Initialer"]];
  const nextTier = c.tier === "Guld" ? 4000 : c.tier === "Silver" ? 1500 : 500;
  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* identity */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Identitet · bestående</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
          <Detail label="Fullständigt namn" value={c.fullName} />
          <Detail label="Återkommande" value={`${c.visits} besök`} />
          <Detail label="Favoritfrisör" value={c.favStaff} />
          <Detail label="Senaste besök" value={c.lastVisit} />
        </div>
      </section>

      {/* privacy — display name controlled by customer */}
      <section style={{ background: "var(--c-info-bg)", borderRadius: 12, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><Icon name="shield" size={15} style={{ color: "var(--c-info)" }} /><span style={{ fontWeight: 600, fontSize: 13.5 }}>Visningsnamn</span></div>
        <p style={{ fontSize: 12.5, color: "var(--c-ink-2)", margin: "0 0 12px" }}>Kunden väljer själv hur namnet syns. Lojalitetsbandet bygger på identiteten, aldrig på exponerad PII.</p>
        <div style={{ display: "flex", gap: 6, background: "var(--c-paper)", padding: 4, borderRadius: 10 }}>
          {showOpts.map(([k, l]) => (
            <button key={k} onClick={() => actions.setPrivacy(c.id, k)} style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, background: c.showAs === k ? "var(--c-forest)" : "transparent", color: c.showAs === k ? "#fff" : "var(--c-ink-2)" }}>{l}</button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "var(--c-ink-3)", marginTop: 10 }}>Visas nu som <b style={{ color: "var(--c-ink)" }}>{window.BO.custName(c)}</b></div>
      </section>

      {/* PII time-bound */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Kontakt-PII · tidsbunden</div>
        <div style={{ background: "var(--c-paper-2)", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, color: "var(--c-ink-2)" }}>{c.pii === "gäst" ? "Gäst — minimal data" : "Visas i driftfönstret"}</span>
            {c.phone !== "—" && (revealed
              ? <button onClick={() => actions.hidePII(c.id)} style={piiBtn}><Icon name="eyeOff" size={14} /> Dölj</button>
              : <button onClick={() => actions.revealPII(c.id)} style={piiBtn}><Icon name="eye" size={14} /> Visa</button>)}
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            <div><div style={{ fontSize: 11, color: "var(--c-ink-3)" }}>Telefon</div><div className="num" style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>{c.phone === "—" ? "—" : revealed ? c.phone : maskPhone(c.phone)}</div></div>
            <div><div style={{ fontSize: 11, color: "var(--c-ink-3)" }}>E-post</div><div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>{c.email === "—" ? "—" : revealed ? c.email : "•••••@•••"}</div></div>
          </div>
        </div>
      </section>

      {/* loyalty */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Lojalitet</div>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
          <span className="num" style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--c-gold-600)" }}>{c.points.toLocaleString("sv-SE")} <span style={{ fontSize: 15 }}>poäng</span></span>
          <span className="small">Nästa nivå: {nextTier.toLocaleString("sv-SE")} p</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "var(--c-paper-2)", overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, (c.points / nextTier) * 100)}%`, background: "var(--c-gold)", borderRadius: 999 }} /></div>
      </section>

      {/* recent history */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Historik</div>
        <div style={{ display: "grid", gap: 2 }}>
          {MY_HISTORY.map((h, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--c-line)" }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{h.service}</div><div style={{ fontSize: 12, color: "var(--c-ink-3)" }}>{h.date} · {h.staff}</div></div>
              <span className="num" style={{ fontSize: 13, color: "var(--c-ink-2)" }}>{h.price} kr</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { SalonCustomers, CustomerDetail, tierTone });
