/* Embedded booking wizard — opens IN-PAGE as a slide-over drawer inside the
   storefront shell. Same brand/color/font throughout. Never a redirect.
   Steps: 1 service · 2 staff · 3 day/time · 4 details · 5 confirmation. */
const { useState: useStateB, useEffect: useEffectB } = React;

const DAYS = ["mån", "tis", "ons", "tor", "fre", "lör"];
function nextDates(n) {
  const out = []; const d = new Date();
  for (let k = 0; k < n; k++) { const x = new Date(d); x.setDate(d.getDate() + k); out.push(x); }
  return out;
}
const SLOTS = ["09:00", "09:30", "10:30", "11:00", "13:00", "13:30", "14:30", "15:30", "16:00", "17:00"];

function Stepper({ step, labels, dark }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {labels.map((l, i) => (
        <div key={l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: i <= step ? 1 : 0.4 }}>
            <div style={{ width: 24, height: 24, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-body)",
              background: i < step ? "var(--color-primary)" : i === step ? "var(--color-primary)" : "transparent",
              color: i <= step ? (dark ? "#14120E" : "#fff") : "var(--color-fg-2)",
              border: i <= step ? "none" : "1.5px solid var(--color-line)" }}>
              {i < step ? <Icon name="check" size={14} stroke={2.5} /> : i + 1}
            </div>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 500, color: i <= step ? "var(--color-fg)" : "var(--color-fg-2)" }} className="sf-step-label">{l}</span>
          </div>
          {i < labels.length - 1 && <div style={{ width: 18, height: 1, background: "var(--color-line)" }} />}
        </div>
      ))}
    </div>
  );
}

function BookingWizard({ t, open, onClose }) {
  const [step, setStep] = useStateB(0);
  const [sel, setSel] = useStateB({ service: null, staff: null, date: 0, slot: null, name: "", phone: "", email: "" });
  const dark = t.dark !== undefined ? t.dark : (t.theme === "zigge");
  useEffectB(() => { if (open) { setStep(0); setSel({ service: null, staff: null, date: 0, slot: null, name: "", phone: "", email: "" }); } }, [open, t]);
  useEffectB(() => { const h = e => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);

  const labels = ["Tjänst", "Frisör", "Tid", "Uppgifter", "Klart"];
  const canNext = [sel.service !== null, true, sel.slot !== null, sel.name && sel.phone, true][step];
  const accentText = dark ? "#14120E" : "#fff";

  const Card = ({ active, children, onClick, style = {} }) => (
    <button onClick={onClick} style={{ textAlign: "left", width: "100%", background: active ? "var(--color-accent-soft)" : "var(--color-surface)", border: `1.5px solid ${active ? "var(--color-primary)" : "var(--color-line)"}`, borderRadius: "var(--sf-radius)", padding: 18, cursor: "pointer", transition: "all var(--dur-fast)", display: "flex", alignItems: "center", gap: 16, ...style }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = "var(--color-fg-2)"; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = "var(--color-line)"; }}>{children}</button>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.42)", backdropFilter: "blur(2px)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity var(--dur-base)" }} />
      <aside style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "min(560px, 100vw)", zIndex: 90, background: "var(--color-bg)", boxShadow: "-30px 0 80px rgba(0,0,0,.25)", transform: open ? "translateX(0)" : "translateX(100%)", transition: "transform var(--dur-slow) var(--ease-out)", display: "flex", flexDirection: "column" }}>
        {/* header — keeps the salon brand */}
        <div style={{ padding: "20px 26px", borderBottom: "1px solid var(--color-line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--color-surface)" }}>
          <Wordmark t={t} />
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-fg)", opacity: 0.7 }}><Icon name="x" size={24} /></button>
        </div>
        <div style={{ padding: "18px 26px", borderBottom: "1px solid var(--color-line)" }}>
          <Stepper step={step} labels={labels} dark={dark} />
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 26 }}>
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--color-fg)", margin: "0 0 6px" }}>Vilken tjänst?</h3>
              {t.services.map((s, i) => (
                <Card key={s.n} active={sel.service === i} onClick={() => setSel(p => ({ ...p, service: i }))}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 16, color: "var(--color-fg)" }}>{s.name}</div>
                    <div className="sf-body" style={{ fontSize: 13.5, marginTop: 2 }}>{s.time}</div>
                  </div>
                  <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, color: "var(--color-fg)" }}>{s.price}</div>
                </Card>
              ))}
            </div>
          )}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--color-fg)", margin: "0 0 6px" }}>Hos vem?</h3>
              <Card active={sel.staff === -1} onClick={() => setSel(p => ({ ...p, staff: -1 }))}>
                <div style={{ width: 48, height: 48, borderRadius: 999, background: "var(--color-accent-soft)", display: "grid", placeItems: "center", color: "var(--color-primary)" }}><Icon name="users" size={22} /></div>
                <div><div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 16, color: "var(--color-fg)" }}>Första lediga</div><div className="sf-body" style={{ fontSize: 13.5 }}>Snabbast möjliga tid</div></div>
              </Card>
              {t.team.map((m, i) => (
                <Card key={m.name} active={sel.staff === i} onClick={() => setSel(p => ({ ...p, staff: i }))}>
                  <div style={{ width: 48, height: 48, borderRadius: 999, backgroundImage: `url(${m.img})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                  <div><div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 16, color: "var(--color-fg)" }}>{m.name}</div><div className="sf-body" style={{ fontSize: 13.5 }}>{m.role}</div></div>
                </Card>
              ))}
            </div>
          )}
          {step === 2 && (
            <div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--color-fg)", margin: "0 0 16px" }}>Välj dag & tid</h3>
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
                {nextDates(7).map((d, i) => (
                  <button key={i} onClick={() => setSel(p => ({ ...p, date: i, slot: null }))} style={{ flex: "none", width: 62, padding: "12px 0", borderRadius: "var(--sf-radius)", border: `1.5px solid ${sel.date === i ? "var(--color-primary)" : "var(--color-line)"}`, background: sel.date === i ? "var(--color-primary)" : "var(--color-surface)", color: sel.date === i ? accentText : "var(--color-fg)", cursor: "pointer", fontFamily: "var(--font-body)", transition: "all var(--dur-fast)" }}>
                    <div style={{ fontSize: 12, textTransform: "uppercase", opacity: 0.8 }}>{i === 0 ? "Idag" : DAYS[(d.getDay() + 6) % 7]}</div>
                    <div style={{ fontSize: 20, fontWeight: 600, marginTop: 3 }}>{d.getDate()}</div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                {SLOTS.map(s => {
                  const taken = (sel.date + s.length) % 7 === 0;
                  return (
                    <button key={s} disabled={taken} onClick={() => setSel(p => ({ ...p, slot: s }))} style={{ padding: "13px 0", borderRadius: "var(--sf-radius)", border: `1.5px solid ${sel.slot === s ? "var(--color-primary)" : "var(--color-line)"}`, background: sel.slot === s ? "var(--color-primary)" : taken ? "transparent" : "var(--color-surface)", color: sel.slot === s ? accentText : taken ? "var(--color-fg-2)" : "var(--color-fg)", cursor: taken ? "not-allowed" : "pointer", fontFamily: "var(--font-body)", fontWeight: 500, fontSize: 15, opacity: taken ? 0.4 : 1, textDecoration: taken ? "line-through" : "none", transition: "all var(--dur-fast)" }}>{s}</button>
                  );
                })}
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--color-fg)", margin: "0 0 16px" }}>Dina uppgifter</h3>
              {[["name", "Namn", "Förnamn Efternamn"], ["phone", "Telefon", "07X XXX XX XX"], ["email", "E-post (valfritt)", "du@exempel.se"]].map(([k, label, ph]) => (
                <label key={k} style={{ display: "block", marginBottom: 16 }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--color-fg)" }}>{label}</span>
                  <input value={sel[k]} onChange={e => setSel(p => ({ ...p, [k]: e.target.value }))} placeholder={ph} style={{ width: "100%", marginTop: 6, padding: "13px 15px", borderRadius: "var(--sf-radius)", border: "1.5px solid var(--color-line)", background: "var(--color-surface)", color: "var(--color-fg)", fontFamily: "var(--font-body)", fontSize: 15, outline: "none", boxSizing: "border-box" }}
                    onFocus={e => e.target.style.borderColor = "var(--color-primary)"} onBlur={e => e.target.style.borderColor = "var(--color-line)"} />
                </label>
              ))}
              <p className="sf-body" style={{ fontSize: 13 }}>Du får en bekräftelse via sms. Avboka kostnadsfritt fram till 24 h innan.</p>
            </div>
          )}
          {step === 4 && (
            <div style={{ textAlign: "center", paddingTop: 20 }}>
              <div style={{ width: 72, height: 72, borderRadius: 999, background: "var(--color-accent-soft)", color: "var(--color-primary)", display: "grid", placeItems: "center", margin: "0 auto 22px" }}><Icon name="checkCircle" size={40} stroke={1.6} /></div>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--color-fg)", margin: 0 }}>Tack, {sel.name.split(" ")[0] || "vi ses"}!</h3>
              <p className="sf-body" style={{ fontSize: 16, marginTop: 8 }}>Din tid är bokad. Bekräftelse skickad.</p>
              <div style={{ marginTop: 26, textAlign: "left", background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: "var(--sf-radius)", padding: 22 }}>
                {[["Tjänst", t.services[sel.service]?.name], ["Frisör", sel.staff === -1 ? "Första lediga" : t.team[sel.staff]?.name], ["Tid", `${nextDates(7)[sel.date].toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}, ${sel.slot}`], ["Plats", t.address]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--color-line)", gap: 16 }}>
                    <span className="sf-body" style={{ fontSize: 14 }}>{k}</span>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "var(--color-fg)", textAlign: "right" }}>{v}</span>
                  </div>
                ))}
              </div>
              <ReviewBlock t={t} />
            </div>
          )}
        </div>

        {/* footer actions */}
        <div style={{ padding: "16px 26px", borderTop: "1px solid var(--color-line)", background: "var(--color-surface)", display: "flex", gap: 12 }}>
          {step > 0 && step < 4 && (
            <button onClick={() => setStep(s => s - 1)} style={{ flex: "none", padding: "14px 20px", borderRadius: "var(--radius-pill)", border: "1.5px solid var(--color-line)", background: "transparent", color: "var(--color-fg)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}><Icon name="arrowLeft" size={16} /> Tillbaka</button>
          )}
          {step < 4 ? (
            <button disabled={!canNext} onClick={() => setStep(s => s + 1)} style={{ flex: 1, padding: "14px", borderRadius: "var(--radius-pill)", border: "none", background: canNext ? "var(--color-primary)" : "var(--color-line)", color: canNext ? accentText : "var(--color-fg-2)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, cursor: canNext ? "pointer" : "not-allowed", letterSpacing: dark ? "0.06em" : "0.01em", textTransform: dark ? "uppercase" : "none", transition: "all var(--dur-fast)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {step === 3 ? "Bekräfta bokning" : "Fortsätt"} <Icon name="arrowRight" size={17} />
            </button>
          ) : (
            <button onClick={onClose} style={{ flex: 1, padding: "14px", borderRadius: "var(--radius-pill)", border: "none", background: "var(--color-primary)", color: accentText, fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, cursor: "pointer", letterSpacing: dark ? "0.06em" : "0.01em", textTransform: dark ? "uppercase" : "none" }}>Tillbaka till sidan</button>
          )}
        </div>
      </aside>
    </>
  );
}

window.BookingWizard = BookingWizard;
