/* Salong-admin — Tjänster (M6 §3.3) + Schema (M6 §5).
   Tjänster: visa VAR på storefronten tjänsten hamnar (UI → storefront, ingen kod).
   Schema: explicita bokbara starttider, ojämna intervall, service-längd-styrt
   (inte fasta arbetstider). Matar M3:s slot-generering.                    */
const { useState: useStateSv } = React;

const SECTIONS = ["Dam", "Herr", "Färg", "Styling"];

function SalonServices() {
  const { SERVICES } = window.BO;
  const [services, setServices] = useStateSv(() => SERVICES.map(s => ({ ...s })));
  const toggleOnline = id => setServices(ss => ss.map(s => s.id === id ? { ...s, online: !s.online, section: !s.online ? "Dam" : "Dold" } : s));
  const setSection = (id, sec) => setServices(ss => ss.map(s => s.id === id ? { ...s, section: sec } : s));

  return (
    <div>
      <PageHead eyebrow="Studio Salvia" title="Tjänster"
        sub="När du lägger till eller redigerar en tjänst ser du direkt var på hemsidan den hamnar.">
        <Button variant="primary" icon="plus">Ny tjänst</Button>
      </PageHead>
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 16, alignItems: "start" }} className="bo-2col">
        <Card pad={0}>
          <Table cols={["Tjänst", "Tid", "Pris", "Storefront", "Online", ""]}
            rows={services.map(s => [
              <div><b style={{ fontWeight: 600 }}>{s.name}</b>{s.popular && <Badge tone="gold" dot={false} >Populär</Badge>}<div style={{ fontSize: 12, color: "var(--c-ink-3)", marginTop: 2 }}>{s.cat}</div></div>,
              <span className="num">{s.dur} min</span>,
              <span className="num" style={{ fontWeight: 600 }}>{s.price} kr</span>,
              s.online
                ? <select value={s.section} onChange={e => setSection(s.id, e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--c-ink)", cursor: "pointer" }}>{SECTIONS.map(sec => <option key={sec}>{sec}</option>)}</select>
                : <span style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>— dold —</span>,
              <button onClick={() => toggleOnline(s.id)} style={{ width: 42, height: 24, borderRadius: 999, border: "none", cursor: "pointer", background: s.online ? "var(--c-forest)" : "var(--c-line-strong)", position: "relative", flex: "none" }}><span style={{ position: "absolute", top: 3, left: s.online ? 21 : 3, width: 18, height: 18, borderRadius: 999, background: "#fff", transition: "left var(--dur-fast)" }} /></button>,
              <button style={{ border: "none", background: "transparent", color: "var(--c-ink-3)", cursor: "pointer", padding: 4 }}><Icon name="edit" size={17} /></button>,
            ])} />
        </Card>

        {/* storefront placement map */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><Icon name="external" size={15} style={{ color: "var(--c-gold-600)" }} /><h2 className="h2">Var det syns på hemsidan</h2></div>
          <p className="small" style={{ marginBottom: 14 }}>salvia.corevo.se → Tjänster</p>
          <div style={{ display: "grid", gap: 12 }}>
            {SECTIONS.map(sec => {
              const inSec = services.filter(s => s.online && s.section === sec);
              return (
                <div key={sec} style={{ border: "1px solid var(--c-line)", borderRadius: 12, padding: "12px 14px", background: "var(--c-paper-2)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--c-forest)", marginBottom: inSec.length ? 8 : 0 }}>{sec}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {inSec.map(s => <span key={s.id} style={{ fontSize: 12.5, background: "var(--c-paper)", border: "1px solid var(--c-line)", borderRadius: 999, padding: "4px 10px" }}>{s.name}</span>)}
                    {inSec.length === 0 && <span style={{ fontSize: 12, color: "var(--c-ink-3)" }}>Tom sektion</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--c-ink-3)" }}><Icon name="info" size={14} /> Ändringar slår igenom utan kod eller deploy.</div>
        </Card>
      </div>
    </div>
  );
}

function SalonSchedule() {
  const { WEEK_DAYS, SLOT_TEMPLATE, STAFF } = window.BO;
  const [staffId, setStaffId] = useStateSv(STAFF[0].id);
  const [slots, setSlots] = useStateSv(() => JSON.parse(JSON.stringify(SLOT_TEMPLATE)));
  const removeSlot = (day, t) => setSlots(s => ({ ...s, [day]: s[day].filter(x => x !== t) }));
  const addSlot = (day) => {
    const v = prompt(`Ny bokningsbar tid för ${day} (t.ex. 14:20):`);
    if (v && /^\d{1,2}:\d{2}$/.test(v.trim())) setSlots(s => ({ ...s, [day]: [...s[day], v.trim()].sort() }));
  };

  return (
    <div>
      <PageHead eyebrow="Studio Salvia" title="Schema"
        sub="Bokbara starttider — inte fasta arbetstider. Ojämna intervall är ok; tjänstens längd styr passets längd.">
        <Button variant="ghost" icon="undo">Återställ mönster</Button>
        <Button variant="primary" icon="check">Spara schema</Button>
      </PageHead>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span className="small" style={{ marginRight: 4 }}>Frisör:</span>
        {STAFF.map(s => (
          <button key={s.id} onClick={() => setStaffId(s.id)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 13px", borderRadius: 999, border: `1.5px solid ${staffId === s.id ? "var(--c-forest)" : "var(--c-line)"}`, background: staffId === s.id ? "var(--c-forest)" : "var(--c-paper)", color: staffId === s.id ? "#fff" : "var(--c-ink-2)", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600 }}><span style={{ width: 18, height: 18, borderRadius: 999, background: s.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700 }}>{s.name[0]}</span>{s.name.split(" ")[0]}</button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 16px", background: "var(--c-info-bg)", borderRadius: 12, marginBottom: 16 }}>
        <Icon name="sparkle" size={17} style={{ color: "var(--c-info)", flex: "none" }} />
        <span style={{ fontSize: 13, color: "var(--c-ink)" }}>Upplägget är förinställt från salongens nuvarande mönster. Justera per dag — minimalt manuellt arbete, alltid rätt tider uppe.</span>
      </div>

      <Card pad={0}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${WEEK_DAYS.length},1fr)` }}>
          {WEEK_DAYS.map(d => (
            <div key={d.day} style={{ borderRight: "1px solid var(--c-line)", minHeight: 360 }}>
              <div style={{ padding: "14px 14px", borderBottom: "1px solid var(--c-line)", textAlign: "center", background: d.today ? "var(--c-gold-100)" : "transparent" }}>
                <div style={{ fontSize: 12, color: "var(--c-ink-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>{d.day}</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--c-forest)", marginTop: 2 }}>{d.date}</div>
                <div className="num" style={{ fontSize: 11, color: "var(--c-ink-3)", marginTop: 2 }}>{slots[d.day].length} tider</div>
              </div>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
                {slots[d.day].map(t => (
                  <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 9, background: "var(--c-success-bg)" }}>
                    <span className="num" style={{ fontSize: 13, fontWeight: 700, color: "var(--c-success)" }}>{t}</span>
                    <button onClick={() => removeSlot(d.day, t)} style={{ border: "none", background: "transparent", color: "var(--c-ink-3)", cursor: "pointer", padding: 0, display: "grid", placeItems: "center" }}><Icon name="x" size={14} /></button>
                  </div>
                ))}
                <button onClick={() => addSlot(d.day)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: 9, border: "1px dashed var(--c-line-strong)", background: "transparent", color: "var(--c-ink-3)", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600 }}><Icon name="plus" size={14} /> Tid</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { SalonServices, SalonSchedule });
