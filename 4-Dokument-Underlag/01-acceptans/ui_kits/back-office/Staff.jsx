/* Frisörens egna sida (M5-spegling). Maja Lund (st3) är inloggad.
   Speglar verklig dag från samma store som salong-admin. Kundens
   meddelanden landar här som noteringar mot bokningsraden — inte mejltråd. */
const { useState: useStatePF } = React;
const ME = "st3"; // Maja Lund

function StaffToday() {
  const { bookings, customers, actions } = useStore();
  const { custName, CUST_PROFILE } = window.BO;
  const [sel, setSel] = useStatePF(null);
  const mine = bookings.filter(b => b.staffId === ME && b.status !== "avbokad").sort((a, b) => a.time.localeCompare(b.time));
  const next = mine.find(b => b.status === "gjord");
  const selB = bookings.find(b => b.id === sel);
  const selC = selB && customers.find(c => c.id === selB.customerId);

  return (
    <div style={{ maxWidth: 720 }}>
      <PageHead eyebrow="tis 2 juni" title="Idag"
        sub="Din dag, live. Tryck på en kund för att snabbt minnas vad ni gjort sist — så du har koll utan att leta.">
        <Badge tone="gold">{mine.length} bokningar</Badge>
      </PageHead>

      {next && (
        <Card style={{ background: "var(--c-forest)", color: "#fff", border: "none", marginBottom: 16, cursor: "pointer" }} onClick={() => setSel(next.id)}>
          <span className="eyebrow" style={{ color: "var(--c-gold)" }}>Nästa kund</span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10 }}>
            <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700 }}>{next.time}</div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 17 }}>{custName(customers.find(c => c.id === next.customerId))}</div><div style={{ fontSize: 13.5, color: "var(--c-on-forest-2)" }}>{next.service} · {next.dur} min</div></div>
            <Button variant="gold" icon="check" onClick={e => { e.stopPropagation(); actions.complete(next.id); }}>Markera klar</Button>
          </div>
        </Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {mine.map(b => {
          const c = customers.find(x => x.id === b.customerId);
          const prof = CUST_PROFILE[b.customerId] || {};
          const kundNote = b.notes.filter(n => n.from === "kund");
          return (
            <Card key={b.id} pad={0} onClick={() => setSel(b.id)} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18, padding: 18 }}>
                <div style={{ textAlign: "center", minWidth: 60 }}><div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, color: "var(--c-forest)" }}>{b.time}</div><div style={{ fontSize: 11.5, color: "var(--c-ink-3)" }}>{b.dur} min</div></div>
              <div style={{ width: 3, alignSelf: "stretch", borderRadius: 999, background: b.status === "klar" ? "var(--c-success)" : "var(--c-gold)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>{custName(c)}{c.visits >= 5 && <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em", color: "var(--c-gold-600)", background: "var(--c-gold-100)", padding: "2px 7px", borderRadius: 999, textTransform: "uppercase" }}>Stamkund</span>}</div>
                  <div style={{ fontSize: 13.5, color: "var(--c-ink-2)", marginTop: 2 }}>{b.service}</div>
                  {prof.prefs && prof.prefs.length > 0 && <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>{prof.prefs.slice(0, 2).map(p => <span key={p} style={{ fontSize: 11.5, color: "var(--c-ink-2)", background: "var(--c-paper-2)", borderRadius: 999, padding: "3px 9px" }}>{p}</span>)}</div>}
                </div>
                {kundNote.length > 0 && <Icon name="message" size={16} style={{ color: "var(--c-gold-600)", flex: "none" }} />}
                {b.status === "klar"
                  ? <StatusBadge status={b.status} paid={b.paid} />
                  : <Button variant="ghost" size="sm" icon="check" onClick={e => { e.stopPropagation(); actions.complete(b.id); }}>Klar</Button>}
              </div>
              {kundNote.length > 0 && (
                <div style={{ borderTop: "1px solid var(--c-line)", padding: "12px 18px", background: "var(--c-gold-100)", display: "flex", flexDirection: "column", gap: 8 }}>
                  {kundNote.map((n, i) => (
                    <div key={i} style={{ display: "flex", gap: 10 }}>
                      <Icon name="message" size={15} style={{ color: "var(--c-gold-600)", flex: "none", marginTop: 1 }} />
                      <div><div style={{ fontSize: 13, color: "var(--c-ink)" }}>{n.text}</div><div style={{ fontSize: 11, color: "var(--c-ink-3)", marginTop: 2 }}>Från {custName(c)} · {n.at}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <DetailModal open={!!selB} onClose={() => setSel(null)} width={460}
        title={selC ? custName(selC) : ""} sub={selB ? `${selB.time} · ${selB.service}` : ""}
        accent={selC && <div style={{ marginBottom: 8, display: "flex", gap: 7 }}><Badge tone={selC.tier === "Guld" ? "gold" : selC.tier === "Silver" ? "info" : "neutral"}>{selC.tier}</Badge>{selC.visits >= 5 && <Badge tone="success" dot={false}>{selC.visits} besök</Badge>}</div>}
        footer={selB && (selB.status === "klar"
          ? <Button variant="ghost" icon="undo" onClick={() => actions.reopen(selB.id)} style={{ flex: 1, justifyContent: "center" }}>Öppna igen</Button>
          : <Button variant="primary" icon="check" onClick={() => { actions.complete(selB.id); }} style={{ flex: 1, justifyContent: "center" }}>Markera klar</Button>)}>
        {selB && <StaffRecognition b={selB} c={selC} actions={actions} />}
      </DetailModal>
    </div>
  );
}

/* kund-igenkänning för frisören — "ha koll" utan att leta */
function StaffRecognition({ b, c, actions }) {
  const { custName, CUST_PROFILE, MY_HISTORY } = window.BO;
  const prof = CUST_PROFILE[c.id] || { prefs: [], memo: "", drink: "—", cadence: 0 };
  const [memo, setMemo] = useStatePF(prof.memo);
  const [saved, setSaved] = useStatePF(true);
  const kundNote = b.notes.filter(n => n.from === "kund");
  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* quick recognition line */}
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", padding: "14px 16px", background: "var(--c-paper-2)", borderRadius: 12 }}>
        <div><div style={{ fontSize: 11, color: "var(--c-ink-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Senaste besök</div><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{c.lastVisit}</div></div>
        <div><div style={{ fontSize: 11, color: "var(--c-ink-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Brukar komma</div><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{prof.cadence ? `var ${prof.cadence}:e vecka` : "—"}</div></div>
        <div><div style={{ fontSize: 11, color: "var(--c-ink-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Bjuds på</div><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 3 }}>{prof.drink}</div></div>
      </div>

      {kundNote.length > 0 && (
        <section>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Inför besöket · från kunden</div>
          {kundNote.map((n, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "11px 13px", background: "var(--c-gold-100)", borderRadius: 11, marginBottom: 6 }}>
              <Icon name="message" size={15} style={{ color: "var(--c-gold-600)", flex: "none", marginTop: 1 }} />
              <div style={{ fontSize: 13, color: "var(--c-ink)" }}>{n.text}<div style={{ fontSize: 11, color: "var(--c-ink-3)", marginTop: 3 }}>{n.at}</div></div>
            </div>
          ))}
        </section>
      )}

      {prof.prefs.length > 0 && (
        <section>
          <div className="eyebrow" style={{ marginBottom: 10 }}>Det du vet om {custName(c).split(" ")[0]}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{prof.prefs.map(p => <span key={p} style={{ fontSize: 12.5, fontWeight: 500, color: "var(--c-ink)", background: "var(--c-paper-2)", border: "1px solid var(--c-line)", borderRadius: 999, padding: "5px 12px" }}>{p}</span>)}</div>
        </section>
      )}

      <section>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Ditt minne · privat</div>
        <textarea value={memo} onChange={e => { setMemo(e.target.value); setSaved(false); }} rows={3} placeholder="Anteckna något du vill minnas till nästa gång…"
          style={{ width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--c-ink)", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }}
          onFocus={e => e.target.style.borderColor = "var(--c-forest)"} onBlur={e => e.target.style.borderColor = "var(--c-line)"} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 11.5, color: "var(--c-ink-3)" }}>Syns bara för dig. Hjälper dig minnas år efter år.</span>
          <Button variant="subtle" size="sm" icon="check" onClick={() => { setSaved(true); actions.notify("Minnesnotering sparad", "success", "check"); }} disabled={saved}>Spara</Button>
        </div>
      </section>

      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Tidigare hos er</div>
        <div style={{ display: "grid", gap: 2 }}>
          {MY_HISTORY.slice(0, 3).map((h, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < 2 ? "1px solid var(--c-line)" : "none" }}>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{h.service}</div><div style={{ fontSize: 12, color: "var(--c-ink-3)" }}>{h.date}</div></div>
              <span className="num" style={{ fontSize: 12.5, color: "var(--c-ink-2)" }}>{h.price} kr</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StaffSchedule() {
  const { bookings, customers } = useStore();
  const { WEEK_DAYS, SLOT_TEMPLATE, custName } = window.BO;
  const todayBooked = {};
  bookings.filter(b => b.staffId === ME && b.status !== "avbokad").forEach(b => { todayBooked[b.time] = b; });

  return (
    <div>
      <PageHead eyebrow="Maja Lund" title="Mitt schema">
        <Button variant="ghost" size="sm">Vecka 23</Button>
      </PageHead>
      <Card pad={0}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${WEEK_DAYS.length},1fr)` }}>
          {WEEK_DAYS.map(d => (
            <div key={d.day} style={{ borderRight: "1px solid var(--c-line)", minHeight: 380 }}>
              <div style={{ padding: "14px", borderBottom: "1px solid var(--c-line)", textAlign: "center", background: d.today ? "var(--c-gold-100)" : "transparent" }}>
                <div style={{ fontSize: 12, color: "var(--c-ink-3)", textTransform: "uppercase" }}>{d.day}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--c-forest)" }}>{d.date}</div>
              </div>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                {SLOT_TEMPLATE[d.day].map(t => {
                  const b = d.today ? todayBooked[t] : null;
                  return (
                    <div key={t} style={{ padding: "8px 10px", borderRadius: 9, background: b ? "var(--c-info-bg)" : "transparent", border: b ? "none" : "1px dashed var(--c-line-strong)" }}>
                      <div className="num" style={{ fontSize: 11.5, fontWeight: 700, color: b ? "var(--c-info)" : "var(--c-ink-3)" }}>{t}</div>
                      {b ? <div style={{ fontSize: 12.5, fontWeight: 600, marginTop: 2 }}>{custName(customers.find(c => c.id === b.customerId))}</div>
                         : <div style={{ fontSize: 11.5, color: "var(--c-ink-3)", marginTop: 2 }}>Ledig</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StaffAbsence() {
  const [type, setType] = useStatePF("Semester");
  const types = ["Semester", "Sjuk", "Ledig dag", "Annat"];
  const upcoming = [["12–18 jul", "Semester", "Godkänd"], ["3 jun", "Ledig dag", "Väntar"]];
  return (
    <div style={{ maxWidth: 560 }}>
      <PageHead eyebrow="Maja Lund" title="Frånvaro" />
      <Card>
        <h2 className="h2" style={{ marginBottom: 16 }}>Anmäl frånvaro</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {types.map(t => <button key={t} onClick={() => setType(t)} style={{ padding: "9px 16px", borderRadius: 999, border: `1.5px solid ${type === t ? "var(--c-forest)" : "var(--c-line)"}`, background: type === t ? "var(--c-forest)" : "var(--c-paper)", color: type === t ? "#fff" : "var(--c-ink-2)", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 600 }}>{t}</button>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Från" ph="2026-06-12" type="date" />
          <Field label="Till" ph="2026-06-18" type="date" />
        </div>
        <div style={{ display: "flex", gap: 9, padding: "11px 13px", background: "var(--c-info-bg)", borderRadius: 10, margin: "16px 0 0" }}><Icon name="info" size={15} style={{ color: "var(--c-info)", flex: "none", marginTop: 1 }} /><span style={{ fontSize: 12.5, color: "var(--c-ink)" }}>Frånvaro stänger automatiskt dina bokbara tider på storefronten för perioden.</span></div>
        <Button variant="primary" icon="check" style={{ marginTop: 16 }}>Skicka anmälan</Button>
      </Card>
      <Card style={{ marginTop: 16 }}>
        <h2 className="h2" style={{ marginBottom: 8 }}>Kommande frånvaro</h2>
        {upcoming.map(([when, kind, status], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: "1px solid var(--c-line)" }}>
            <div><div style={{ fontWeight: 600, fontSize: 14 }}>{when}</div><div style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>{kind}</div></div>
            <Badge tone={status === "Godkänd" ? "success" : "warning"}>{status}</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}

Object.assign(window, { StaffToday, StaffSchedule, StaffAbsence });
