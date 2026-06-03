/* Salong-admin — Bokningar (M6 §3.2).
   Kontroll-nav, inte plikt: filter + sök + status (bokad/klar/avbokad) +
   tjänstedetalj + när bokningen gjordes. Live-kopplat: avbokning frigör
   tiden på storefronten (logiken bor i M3, visas här). Chatt-notering mot
   bokningsraden. Aldrig falskt "klar + betald" vid sen/no-show.            */
const { useState: useStateBk, useEffect: useEffectBk } = React;

function maskPhone(p) { if (!p || p === "—") return "—"; return p.slice(0, 4) + " •• •• ••"; }

const BK_VIEW_KEY = "corevo.bookings.view";
const BK_VIEWS = [["Vecka", "calendar"], ["Lista", "menu"]];
const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const staffColor = id => (window.BO.STAFF.find(s => s.id === id) || {}).color || "var(--c-gold)";
const statusColor = s => s === "avbokad" ? "var(--c-danger)" : s === "klar" ? "var(--c-success)" : "var(--c-gold)";

function ViewSwitcher({ view, setView }) {
  return (
    <div style={{ display: "flex", gap: 2, background: "var(--c-paper-2)", padding: 3, borderRadius: 10, flex: "none" }}>
      {BK_VIEWS.map(([k, ic]) => (
        <button key={k} onClick={() => setView(k)} title={k} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, background: view === k ? "var(--c-paper)" : "transparent", color: view === k ? "var(--c-forest)" : "var(--c-ink-3)", boxShadow: view === k ? "var(--shadow-sm)" : "none", transition: "all var(--dur-fast)" }}>
          <Icon name={ic} size={15} />{k}
        </button>
      ))}
    </div>
  );
}

/* ---- view: Lista ---- */
function BkList({ list, cust, custName, onOpen }) {
  return (
    <Card pad={0}>
      <Table cols={["Tid", "Kund", "Tjänst", "Frisör", "Kanal", "Status"]} onRow={i => onOpen(list[i].id)}
        rows={list.map(b => {
          const c = cust(b.customerId);
          const dim = b.status === "avbokad";
          return [
            <span className="num" style={{ fontWeight: 700, color: dim ? "var(--c-ink-3)" : "var(--c-forest)", textDecoration: dim ? "line-through" : "none" }}>{b.time}</span>,
            <span style={{ display: "flex", alignItems: "center", gap: 9, opacity: dim ? 0.6 : 1 }}><span style={{ width: 28, height: 28, borderRadius: 999, background: "var(--c-paper-2)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: "var(--c-forest)", flex: "none" }}>{custName(c)[0]}</span><b style={{ fontWeight: 600 }}>{custName(c)}</b>{b.notes.some(n => n.from === "kund") && <Icon name="message" size={14} style={{ color: "var(--c-gold-600)" }} />}</span>,
            <span style={{ opacity: dim ? 0.6 : 1 }}>{b.service} <span style={{ color: "var(--c-ink-3)" }}>· {b.dur}m</span></span>,
            <span style={{ opacity: dim ? 0.6 : 1 }}>{b.staff}</span>,
            <span style={{ fontSize: 12.5, color: "var(--c-ink-3)", textTransform: "capitalize" }}>{b.channel}</span>,
            <StatusBadge status={b.status} paid={b.paid} />,
          ];
        })} />
      {list.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "var(--c-ink-3)", fontSize: 14 }}>Inga bokningar matchar.</div>}
    </Card>
  );
}

/* ---- view: Tidslinje (proportionell dag-axel) ---- */
function BkTimeline({ list, cust, custName, onOpen }) {
  const START = 9 * 60, END = 18 * 60, SC = 0.94;
  const H = (END - START) * SC;
  const hours = []; for (let h = 9; h <= 18; h++) hours.push(h);
  return (
    <Card pad={0}>
      <div style={{ position: "relative", height: H + 24, padding: "12px 16px 12px 0" }}>
        {hours.map(h => (
          <div key={h} style={{ position: "absolute", left: 0, right: 16, top: 12 + (h * 60 - START) * SC, display: "flex", alignItems: "center", gap: 10 }}>
            <span className="num" style={{ width: 52, textAlign: "right", fontSize: 12, color: "var(--c-ink-3)", flex: "none" }}>{String(h).padStart(2, "0")}:00</span>
            <span style={{ flex: 1, height: 1, background: "var(--c-line)" }} />
          </div>
        ))}
        {list.map(b => {
          const c = cust(b.customerId);
          const dim = b.status === "avbokad";
          const top = 12 + (toMin(b.time) - START) * SC;
          const h = Math.max(42, b.dur * SC - 4);
          return (
            <button key={b.id} onClick={() => onOpen(b.id)} style={{ position: "absolute", left: 64, right: 16, top, height: h, textAlign: "left", border: "1px solid var(--c-line)", borderLeft: `3px solid ${statusColor(b.status)}`, borderRadius: 10, background: dim ? "var(--c-paper-2)" : "var(--c-paper)", boxShadow: "var(--shadow-sm)", cursor: "pointer", padding: "8px 13px", overflow: "hidden", opacity: dim ? 0.7 : 1, display: "flex", alignItems: "center", gap: 12 }}>
              <span className="num" style={{ fontWeight: 700, fontSize: 13.5, color: dim ? "var(--c-ink-3)" : "var(--c-forest)", flex: "none", textDecoration: dim ? "line-through" : "none" }}>{b.time}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden" }}><span style={{ fontWeight: 600, fontSize: 13.5 }}>{custName(c)}</span><span style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}> · {b.service} · {b.staff}</span></span>
              {b.notes.some(n => n.from === "kund") && <Icon name="message" size={14} style={{ color: "var(--c-gold-600)", flex: "none" }} />}
              <StatusBadge status={b.status} paid={b.paid} />
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* ---- view: Vecka (alla 7 dagar · schema-slots + dagens riktiga bokningar) ---- */
function BkWeek({ bookings, cust, custName, onOpen }) {
  const { WEEK_DAYS, SLOT_TEMPLATE } = window.BO;
  const byTime = {}; bookings.filter(b => b.status !== "avbokad").forEach(b => { byTime[b.time] = b; });
  return (
    <Card pad={0}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${WEEK_DAYS.length},minmax(118px,1fr))`, minWidth: 760 }}>
          {WEEK_DAYS.map(d => {
            const slots = SLOT_TEMPLATE[d.day] || [];
            return (
              <div key={d.day} style={{ borderRight: "1px solid var(--c-line)", minHeight: 440, background: d.closed ? "var(--c-paper-2)" : "transparent" }}>
                <div style={{ padding: "13px 10px", borderBottom: "1px solid var(--c-line)", textAlign: "center", background: d.today ? "var(--c-gold-100)" : "transparent" }}>
                  <div style={{ fontSize: 11.5, color: d.today ? "var(--c-gold-600)" : "var(--c-ink-3)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 600 }}>{d.day}</div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: d.today ? "var(--c-forest)" : "var(--c-ink)", marginTop: 1 }}>{d.date}</div>
                </div>
                <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {d.closed && <div style={{ padding: "16px 6px", textAlign: "center", fontSize: 11.5, color: "var(--c-ink-3)" }}>Stängt</div>}
                  {slots.map(t => {
                    const b = d.today ? byTime[t] : null;
                    if (b) {
                      const c = cust(b.customerId);
                      return (
                        <button key={t} onClick={() => onOpen(b.id)} style={{ textAlign: "left", padding: "7px 9px", borderRadius: 9, border: "none", borderLeft: `3px solid ${statusColor(b.status)}`, background: "var(--c-success-bg)", cursor: "pointer" }}>
                          <div className="num" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--c-success)" }}>{t}</div>
                          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{custName(c)}</div>
                          <div style={{ fontSize: 10.5, color: "var(--c-ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.service}</div>
                        </button>
                      );
                    }
                    return <div key={t} style={{ padding: "7px 9px", borderRadius: 9, border: "1px dashed var(--c-line-strong)" }}><div className="num" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--c-ink-3)" }}>{t}</div><div style={{ fontSize: 10.5, color: "var(--c-ink-3)", marginTop: 1 }}>Ledig</div></div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ---- view: Tavla (kanban per status) ---- */
function BkBoard({ bookings, cust, custName, onOpen, q }) {
  const cols = [["gjord", "Bokade", "gold"], ["klar", "Klara", "success"], ["avbokad", "Avbokade", "danger"]];
  const match = b => (custName(cust(b.customerId)) + " " + b.service + " " + b.staff).toLowerCase().includes(q.toLowerCase());
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, alignItems: "start" }} className="bo-2col">
      {cols.map(([st, label, tone]) => {
        const items = bookings.filter(b => b.status === st && match(b)).sort((a, b) => a.time.localeCompare(b.time));
        return (
          <div key={st} style={{ background: "var(--c-paper-2)", borderRadius: 14, padding: 10, minHeight: 120 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 10px" }}>
              <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--c-ink)", display: "inline-flex", alignItems: "center", gap: 7 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: statusColor(st) }} />{label}</span>
              <span className="num" style={{ fontSize: 12, fontWeight: 600, color: "var(--c-ink-3)", background: "var(--c-paper)", padding: "2px 9px", borderRadius: 999 }}>{items.length}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map(b => {
                const c = cust(b.customerId);
                return (
                  <button key={b.id} onClick={() => onOpen(b.id)} style={{ textAlign: "left", border: "1px solid var(--c-line)", borderRadius: 11, background: "var(--c-paper)", boxShadow: "var(--shadow-sm)", cursor: "pointer", padding: "12px 13px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="num" style={{ fontWeight: 700, fontSize: 14, color: "var(--c-forest)", textDecoration: st === "avbokad" ? "line-through" : "none" }}>{b.time}</span>
                      <span style={{ fontSize: 12, color: "var(--c-ink-3)" }}>{b.staff}</span>
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13.5, marginTop: 7, display: "flex", alignItems: "center", gap: 6 }}>{custName(c)}{b.notes.some(n => n.from === "kund") && <Icon name="message" size={13} style={{ color: "var(--c-gold-600)" }} />}</div>
                    <div style={{ fontSize: 12, color: "var(--c-ink-3)", marginTop: 2 }}>{b.service} · {b.dur}m</div>
                    {st === "klar" && b.paid && <div style={{ marginTop: 8 }}><Badge tone="success" dot={false}>Betald</Badge></div>}
                  </button>
                );
              })}
              {items.length === 0 && <div style={{ padding: "14px 8px", fontSize: 12.5, color: "var(--c-ink-3)", textAlign: "center" }}>Tomt</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SalonBookings() {
  const { bookings, customers, revealed, actions } = useStore();
  const { custName } = window.BO;
  const [view, setView] = useStateBk(() => { try { const v = localStorage.getItem(BK_VIEW_KEY); return (v === "Lista" || v === "Vecka") ? v : "Vecka"; } catch (e) { return "Vecka"; } });
  const [filter, setFilter] = useStateBk("Alla");
  const [q, setQ] = useStateBk("");
  const [sel, setSel] = useStateBk(null);
  useEffectBk(() => { try { localStorage.setItem(BK_VIEW_KEY, view); } catch (e) {} }, [view]);

  const cust = id => customers.find(c => c.id === id);
  const counts = {
    Alla: bookings.length,
    Bokade: bookings.filter(b => b.status === "gjord").length,
    Klara: bookings.filter(b => b.status === "klar").length,
    Avbokade: bookings.filter(b => b.status === "avbokad").length,
  };
  const list = bookings.filter(b => {
    if (filter === "Bokade" && b.status !== "gjord") return false;
    if (filter === "Klara" && b.status !== "klar") return false;
    if (filter === "Avbokade" && b.status !== "avbokad") return false;
    const c = cust(b.customerId);
    const hay = (custName(c) + " " + b.service + " " + b.staff).toLowerCase();
    return hay.includes(q.toLowerCase());
  }).sort((a, b) => a.time.localeCompare(b.time));
  const selB = bookings.find(b => b.id === sel);
  const open = id => setSel(id);
  const showFilters = view === "Lista";

  return (
    <div>
      <PageHead eyebrow="Studio Salvia" title="Bokningar"
        sub="En kontrollyta — välj den vy du jobbar bäst i. Ditt val sparas automatiskt.">
        <Button variant="ghost" icon="calendar" size="sm">tis 2 juni</Button>
        <Button variant="primary" icon="plus">Ny bokning</Button>
      </PageHead>

      {/* live-coupling explainer */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 16px", background: "var(--c-gold-100)", borderRadius: 12, marginBottom: 18 }}>
        <Icon name="repeat" size={17} style={{ color: "var(--c-gold-600)", flex: "none" }} />
        <span style={{ fontSize: 13, color: "var(--c-ink)" }}>Avbokar du en tid frigörs den automatiskt på storefronten — <b>prova:</b> öppna en bokad rad och tryck <b>Avboka</b>.</span>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--c-ink-3)" }}><Icon name="search" size={16} /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Sök kund, tjänst, frisör…" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        {showFilters && ["Alla", "Bokade", "Klara", "Avbokade"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "9px 15px", borderRadius: 10, border: "1px solid var(--c-line)", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, background: filter === f ? "var(--c-forest)" : "var(--c-paper)", color: filter === f ? "#fff" : "var(--c-ink-2)", display: "inline-flex", alignItems: "center", gap: 7 }}>{f}<span style={{ fontSize: 11, opacity: 0.7 }} className="num">{counts[f]}</span></button>
        ))}
        <div style={{ marginLeft: "auto" }}><ViewSwitcher view={view} setView={setView} /></div>
      </div>

      {view === "Lista" && <BkList list={list} cust={cust} custName={custName} onOpen={open} />}
      {view === "Vecka" && <BkWeek bookings={bookings} cust={cust} custName={custName} onOpen={open} />}

      <DetailModal open={!!selB} onClose={() => setSel(null)} width={480}
        title={selB ? custName(cust(selB.customerId)) : ""}
        sub={selB ? `${selB.service} · ${selB.time}–${selB.end}` : ""}
        accent={selB && <div style={{ marginBottom: 8 }}><StatusBadge status={selB.status} paid={selB.paid} /></div>}
        footer={selB && <BookingActions b={selB} actions={actions} onClose={() => setSel(null)} />}>
        {selB && <BookingDetail key={selB.id} b={selB} cust={cust(selB.customerId)} revealed={!!revealed[selB.customerId]} actions={actions} />}
      </DetailModal>
    </div>
  );
}

function BookingDetail({ b, cust, revealed, actions }) {
  const [note, setNote] = useStateBk("");
  const { custName } = window.BO;
  const passed = ["09:00", "10:30", "11:30"].includes(b.time); // demo: morning slots already passed

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {/* auto-klar / payment guard */}
      {passed && b.status === "gjord" && (
        <div style={{ display: "flex", gap: 10, padding: "12px 14px", background: "var(--c-info-bg)", borderRadius: 12 }}>
          <Icon name="clock" size={16} style={{ color: "var(--c-info)", flex: "none", marginTop: 1 }} />
          <span style={{ fontSize: 12.5, color: "var(--c-ink)" }}>Tiden har passerat. Markeras <b>auto-klar</b> ikväll om du inte gör det själv — bokningen försvinner aldrig.</span>
        </div>
      )}
      {!b.paid && b.status !== "avbokad" && (
        <div style={{ display: "flex", gap: 10, padding: "12px 14px", background: "var(--c-warning-bg)", borderRadius: 12 }}>
          <Icon name="shield" size={16} style={{ color: "var(--c-warning)", flex: "none", marginTop: 1 }} />
          <span style={{ fontSize: 12.5, color: "var(--c-ink)" }}>Betalning vid bokning är på. En sen kund eller no-show markeras <b>aldrig</b> automatiskt som klar + betald.</span>
        </div>
      )}

      {/* customer / identity + PII */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Kund</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: "var(--c-forest)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 600, fontSize: 17 }}>{custName(cust)[0]}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{custName(cust)}</div>
            <div style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>{cust.tier} · {cust.visits} besök · kund sedan {cust.since}</div>
          </div>
          {cust.showAs !== "full" && <Badge tone="info">Skyddat namn</Badge>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[["scissors", "Favoritfrisör", cust.favStaff], ["clock", "Senaste", cust.lastVisit], ["gift", cust.tier + " · poäng", cust.points.toLocaleString("sv-SE")]].map(([ic, l, v]) => (
            <div key={l} style={{ background: "var(--c-paper-2)", borderRadius: 11, padding: "10px 11px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "var(--c-ink-3)", textTransform: "uppercase", letterSpacing: ".04em" }}><Icon name={ic} size={12} />{l}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div>
            </div>
          ))}
        </div>
        {/* PII — time-bound */}
        <div style={{ background: "var(--c-paper-2)", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: revealed ? 10 : 0 }}>
            <span style={{ fontSize: 12.5, color: "var(--c-ink-2)", display: "flex", alignItems: "center", gap: 7 }}><Icon name="shield" size={14} style={{ color: "var(--c-ink-3)" }} /> Kontaktuppgifter</span>
            {revealed
              ? <button onClick={() => actions.hidePII(cust.id)} style={piiBtn}><Icon name="eyeOff" size={14} /> Dölj</button>
              : <button onClick={() => actions.revealPII(cust.id)} style={piiBtn}><Icon name="eye" size={14} /> Visa</button>}
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            <div><div style={{ fontSize: 11, color: "var(--c-ink-3)" }}>Telefon</div><div className="num" style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>{revealed ? cust.phone : maskPhone(cust.phone)}</div></div>
            <div><div style={{ fontSize: 11, color: "var(--c-ink-3)" }}>E-post</div><div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 2 }}>{revealed ? cust.email : "•••••@•••"}</div></div>
          </div>
          {!revealed && <div style={{ fontSize: 11.5, color: "var(--c-ink-3)", marginTop: 10 }}>Synlig endast i driftfönstret kring bokningen. Gallras enligt GDPR-retention.</div>}
        </div>
      </section>

      {/* service detail */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Tjänst & bokning</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
          <Detail label="Tjänst" value={b.service} />
          <Detail label="Längd" value={`${b.dur} min`} />
          <Detail label="Frisör" value={b.staff} />
          <Detail label="Kanal" value={<span style={{ textTransform: "capitalize" }}>{b.channel}</span>} />
          <Detail label="Bokad" value={b.madeAt} />
          <Detail label="Betalning" value={b.paid ? "Betald" : "Vid besök"} />
        </div>
      </section>

      {/* chat / notes against the row */}
      <section>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Noteringar mot bokningen</div>
        <div style={{ display: "grid", gap: 8 }}>
          {b.notes.length === 0 && <div style={{ fontSize: 13, color: "var(--c-ink-3)", padding: "4px 0" }}>Inga noteringar än. Kundens meddelanden landar här — inte som mejltråd.</div>}
          {b.notes.map((n, i) => (
            <div key={i} style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 10, background: n.from === "kund" ? "var(--c-gold-100)" : "var(--c-paper-2)" }}>
              <Icon name={n.from === "kund" ? "message" : "info"} size={15} style={{ color: n.from === "kund" ? "var(--c-gold-600)" : "var(--c-ink-3)", flex: "none", marginTop: 1 }} />
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, color: "var(--c-ink)" }}>{n.text}</div><div style={{ fontSize: 11, color: "var(--c-ink-3)", marginTop: 3 }}>{n.from === "kund" ? custName(cust) : "System"} · {n.at}</div></div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Lägg en notering…" style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 13.5, outline: "none" }} />
          <Button variant="subtle" size="sm" icon="plus" onClick={() => { if (note.trim()) { actions.addNote(b.id, note.trim(), "frisör"); setNote(""); } }}>Spara</Button>
        </div>
      </section>
    </div>
  );
}

function BookingActions({ b, actions, onClose }) {
  if (b.status === "avbokad") return <Button variant="ghost" icon="undo" onClick={() => actions.reopen(b.id)} style={{ flex: 1, justifyContent: "center" }}>Återställ bokning</Button>;
  if (b.status === "klar") return (
    <>
      {!b.paid && <Button variant="primary" icon="dollar" onClick={() => actions.markPaid(b.id)} style={{ flex: 1, justifyContent: "center" }}>Markera betald</Button>}
      <Button variant="ghost" icon="undo" onClick={() => actions.reopen(b.id)} style={{ flex: b.paid ? 1 : "none", justifyContent: "center" }}>Öppna igen</Button>
    </>
  );
  return (
    <>
      <Button variant="danger" icon="x" onClick={() => { actions.cancel(b.id, "salong"); onClose(); }} style={{ flex: 1, justifyContent: "center" }}>Avboka</Button>
      <Button variant="primary" icon="check" onClick={() => actions.complete(b.id)} style={{ flex: 1, justifyContent: "center" }}>Markera klar</Button>
    </>
  );
}

function Detail({ label, value }) {
  return <div><div style={{ fontSize: 11, color: "var(--c-ink-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div><div style={{ fontSize: 14, fontWeight: 500, marginTop: 3 }}>{value}</div></div>;
}

const piiBtn = { display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid var(--c-line-strong)", background: "var(--c-paper)", color: "var(--c-forest)", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, padding: "6px 11px", borderRadius: 8, cursor: "pointer" };

Object.assign(window, { SalonBookings, BookingDetail, BookingActions, Detail });
