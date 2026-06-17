/* Themed booking presentations for the storefront — each tenant gets its own
   flow. Uses the tenant `t` (services/team/address) + the active theme's CSS
   vars, so every variant matches the salon's brand. Mobile-first overlays.
   Shared step pieces reuse nextDates()/SLOTS from Booking.jsx. */
const { useState: useStateBV } = React;

const accentText = "#fff"; // all five accents read well with white

function svcList(t, sel, set, big) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {t.services.map((s, i) => {
        const on = sel === i;
        return (
          <button key={i} onClick={() => set(i)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: big ? "17px 16px" : "14px 15px", borderRadius: "var(--sf-radius)", border: `1.5px solid ${on ? "var(--color-primary)" : "var(--color-line)"}`, background: on ? "var(--color-accent-soft)" : "var(--color-surface)", cursor: "pointer", textAlign: "left", minHeight: 54 }}>
            <span><span style={{ display: "block", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: big ? 16.5 : 15, color: "var(--color-fg)" }}>{s.name}</span><span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--color-fg-2)" }}>{s.time}</span></span>
            <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, color: "var(--color-fg)", whiteSpace: "nowrap" }}>{s.price}</span>
          </button>
        );
      })}
    </div>
  );
}
function staffList(t, sel, set) {
  const list = [{ name: "Första lediga", role: "Snabbast", any: true }, ...t.team];
  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
      {list.map((m, i) => {
        const on = sel === i;
        return (
          <button key={i} onClick={() => set(i)} style={{ flex: "none", width: 96, padding: "13px 8px", borderRadius: "var(--sf-radius)", border: `1.5px solid ${on ? "var(--color-primary)" : "var(--color-line)"}`, background: on ? "var(--color-accent-soft)" : "var(--color-surface)", cursor: "pointer", textAlign: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: 999, margin: "0 auto", backgroundImage: m.any ? "none" : `url(${m.img})`, backgroundSize: "cover", backgroundPosition: "center", background: m.any ? "var(--color-accent-soft)" : undefined, display: "grid", placeItems: "center", color: "var(--color-primary)", border: m.any ? "1.5px solid var(--color-primary)" : "none" }}>{m.any ? "✦" : ""}</div>
            <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12.5, color: "var(--color-fg)", marginTop: 7 }}>{m.name.split(" ")[0]}</div>
          </button>
        );
      })}
    </div>
  );
}
function dayChips(sel, set) {
  const days = nextDates(7);
  return (
    <div style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 4 }}>
      {days.map((d, i) => {
        const on = sel === i;
        return (
          <button key={i} onClick={() => set(i)} style={{ flex: "none", width: 60, padding: "12px 0", borderRadius: "var(--sf-radius)", border: `1.5px solid ${on ? "var(--color-primary)" : "var(--color-line)"}`, background: on ? "var(--color-primary)" : "var(--color-surface)", color: on ? accentText : "var(--color-fg)", cursor: "pointer", fontFamily: "var(--font-body)" }}>
            <div style={{ fontSize: 11.5, opacity: 0.85 }}>{i === 0 ? "Idag" : ["sön","mån","tis","ons","tor","fre","lör"][d.getDay()]}</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>{d.getDate()}</div>
          </button>
        );
      })}
    </div>
  );
}
function slotChips(sel, set, cols) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols || 3},1fr)`, gap: 9 }}>
      {SLOTS.map((tm, i) => {
        const taken = i === 2 || i === 6, on = sel === tm;
        return <button key={tm} disabled={taken} onClick={() => set(tm)} style={{ padding: "14px 0", borderRadius: "var(--sf-radius)", border: `1.5px solid ${on ? "var(--color-primary)" : "var(--color-line)"}`, background: on ? "var(--color-primary)" : taken ? "transparent" : "var(--color-surface)", color: on ? accentText : taken ? "var(--color-fg-2)" : "var(--color-fg)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, cursor: taken ? "not-allowed" : "pointer", opacity: taken ? 0.4 : 1, textDecoration: taken ? "line-through" : "none", minHeight: 48 }}>{tm}</button>;
      })}
    </div>
  );
}
function bvField(label, ph, val, on) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ fontFamily: "var(--font-body)", fontSize: 12.5, fontWeight: 600, color: "var(--color-fg)" }}>{label}</span>
      <input value={val || ""} onChange={e => on(e.target.value)} placeholder={ph} style={{ width: "100%", marginTop: 6, padding: "13px 14px", borderRadius: "var(--sf-radius)", border: "1.5px solid var(--color-line)", background: "var(--color-surface)", fontFamily: "var(--font-body)", fontSize: 16, color: "var(--color-fg)", outline: "none", boxSizing: "border-box" }} />
    </label>
  );
}
function bvDone(t, sel) {
  const staff = sel.staff === 0 || sel.staff == null ? "Första lediga" : (t.team[sel.staff - 1] || {}).name;
  return (
    <div style={{ textAlign: "center", padding: "8px 4px" }}>
      <div style={{ width: 64, height: 64, borderRadius: 999, background: "var(--color-accent-soft)", color: "var(--color-primary)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Icon name="checkCircle" size={34} stroke={1.6} /></div>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--color-fg)", margin: 0 }}>Tack, vi ses!</h3>
      <p className="sf-body" style={{ fontSize: 14, marginTop: 6 }}>Bekräftelse skickad via sms.</p>
      <div style={{ marginTop: 16, textAlign: "left", background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: "var(--sf-radius)", padding: 16 }}>
        {[["Tjänst", t.services[sel.service ?? 0].name], ["Frisör", staff], ["Plats", t.address]].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--color-line)" }}><span className="sf-body" style={{ fontSize: 13.5 }}>{k}</span><span style={{ fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600, color: "var(--color-fg)", textAlign: "right" }}>{v}</span></div>
        ))}
      </div>
    </div>
  );
}
function BBar({ label, sub, onClick, disabled, onBack }) {
  return (
    <div style={{ flex: "none", padding: "12px 16px", borderTop: "1px solid var(--color-line)", background: "var(--color-surface)", display: "flex", gap: 10 }}>
      {onBack && <button onClick={onBack} style={{ flex: "none", width: 52, borderRadius: "var(--sf-radius)", border: "1.5px solid var(--color-line)", background: "transparent", color: "var(--color-fg)", cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="arrowLeft" size={20} /></button>}
      <button onClick={onClick} disabled={disabled} style={{ flex: 1, minHeight: 54, borderRadius: "var(--sf-radius)", border: "none", background: disabled ? "var(--color-line)" : "var(--color-primary)", color: disabled ? "var(--color-fg-2)" : accentText, fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 16, cursor: disabled ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.2 }}>
        <span>{label}</span>{sub && <span style={{ fontSize: 11.5, fontWeight: 500, opacity: 0.85 }}>{sub}</span>}
      </button>
    </div>
  );
}
function bvHeader(t, onClose, title) {
  return (
    <div style={{ flex: "none", padding: "16px 20px", borderBottom: "1px solid var(--color-line)", background: "var(--color-surface)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <Wordmark t={t} />
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-fg)", opacity: 0.7 }}><Icon name="x" size={24} /></button>
    </div>
  );
}
function Shell({ children, open }) {
  return <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "var(--color-bg)", display: "flex", flexDirection: "column", transform: open ? "translateY(0)" : "translateY(100%)", transition: "transform 420ms var(--ease-out)", pointerEvents: open ? "auto" : "none" }}>{children}</div>;
}

function detailRows(t, s, hasStaff) {
  const d = nextDates(7)[s.day || 0];
  const tid = d.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" }) + " · " + (s.slot || "");
  const rows = [["Tjänst", t.services[s.service == null ? 0 : s.service].name]];
  if (hasStaff) rows.push(["Frisör", (s.staff === 0 || s.staff == null) ? "Första lediga" : (t.team[s.staff - 1] || { name: "—" }).name]);
  rows.push(["Tid", tid]);
  if (t.address) rows.push(["Plats", t.address]);
  return rows;
}

/* ── INLINE — alla steg under varandra, ett svep (Linnea) ── */
function SfInline({ t, open, onClose }) {
  const [s, setS] = useStateBV({ service: 0, staff: 0, day: 0, slot: "14:30", name: "", phone: "" });
  const [done, setDone] = useStateBV(false);
  React.useEffect(() => { if (open) setDone(false); }, [open]);
  const ready = s.slot && s.name && s.phone;
  return (
    <Shell open={open}>
      {bvHeader(t, onClose)}
      {done ? <DoneReview t={t} details={detailRows(t, s, true)} onClose={onClose} /> : <>
      <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--color-fg)", margin: "2px 0 16px" }}>Boka tid</h2>
        <div className="sf-eyebrow" style={{ marginBottom: 10 }}>1 · Tjänst</div>{svcList(t, s.service, i => setS(p => ({ ...p, service: i })))}
        <div className="sf-eyebrow" style={{ margin: "24px 0 10px" }}>2 · Frisör</div>{staffList(t, s.staff, i => setS(p => ({ ...p, staff: i })))}
        <div className="sf-eyebrow" style={{ margin: "24px 0 10px" }}>3 · Dag & tid</div>{dayChips(s.day, i => setS(p => ({ ...p, day: i })))}<div style={{ height: 10 }} />{slotChips(s.slot, v => setS(p => ({ ...p, slot: v })))}
        <div className="sf-eyebrow" style={{ margin: "24px 0 10px" }}>4 · Uppgifter</div>{bvField("Namn", "Förnamn Efternamn", s.name, v => setS(p => ({ ...p, name: v })))}{bvField("Telefon", "07X XXX XX XX", s.phone, v => setS(p => ({ ...p, phone: v })))}
      </div>
      <BBar label={ready ? "Boka tid" : "Fyll i för att boka"} sub={ready ? `${t.services[s.service].name}` : null} disabled={!ready} onClick={() => setDone(true)} />
      </>}
    </Shell>
  );
}

/* ── WIZARD — en sak per skärm (Leander) ── */
function SfWizard({ t, open, onClose }) {
  const [step, setStep] = useStateBV(0);
  const [s, setS] = useStateBV({ service: null, staff: null, day: 0, slot: null, name: "", phone: "" });
  React.useEffect(() => { if (open) { setStep(0); setS({ service: null, staff: null, day: 0, slot: null, name: "", phone: "" }); } }, [open]);
  const titles = ["Vad vill du boka?", "Hos vem?", "När passar det?", "Dina uppgifter", ""];
  const can = [s.service !== null, s.staff !== null, s.slot, s.name && s.phone, true][step];
  return (
    <Shell open={open}>
      <div style={{ flex: "none", padding: "14px 18px 12px", background: "var(--color-surface)", borderBottom: "1px solid var(--color-line)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><Wordmark t={t} /><span style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--color-fg-2)" }}>{Math.min(step + 1, 5)} / 5</span></div>
        <div style={{ display: "flex", gap: 5, marginTop: 12 }}>{[0,1,2,3,4].map(i => <span key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: i <= step ? "var(--color-primary)" : "var(--color-line)", transition: "background .3s" }} />)}</div>
      </div>
      {step === 4 ? <DoneReview t={t} details={detailRows(t, s, true)} onClose={onClose} /> : <>
      <div style={{ flex: 1, overflowY: "auto", padding: "26px 20px" }}>
        {step < 4 && <h2 style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--color-fg)", margin: "0 0 22px", lineHeight: 1.1 }}>{titles[step]}</h2>}
        {step === 0 && svcList(t, s.service, i => setS(p => ({ ...p, service: i })), true)}
        {step === 1 && staffList(t, s.staff, i => setS(p => ({ ...p, staff: i })))}
        {step === 2 && (<>{dayChips(s.day, i => setS(p => ({ ...p, day: i })))}<div style={{ height: 18 }} />{slotChips(s.slot, v => setS(p => ({ ...p, slot: v })))}</>)}
        {step === 3 && (<>{bvField("Namn", "Förnamn Efternamn", s.name, v => setS(p => ({ ...p, name: v })))}{bvField("Telefon", "07X XXX XX XX", s.phone, v => setS(p => ({ ...p, phone: v })))}</>)}
      </div>
      <BBar label={step === 3 ? "Bekräfta bokning" : "Fortsätt"} disabled={!can} onClick={() => setStep(x => x + 1)} onBack={step > 0 ? () => setStep(x => x - 1) : null} />
      </>}
    </Shell>
  );
}

/* ── COMPACT — allt på en skärm (Zigge) ── */
function SfCompact({ t, open, onClose }) {
  const [s, setS] = useStateBV({ service: 0, staff: 0, day: 0, slot: "14:30", name: "", phone: "" });
  const [done, setDone] = useStateBV(false);
  React.useEffect(() => { if (open) setDone(false); }, [open]);
  return (
    <Shell open={open}>
      {bvHeader(t, onClose)}
      {done ? <DoneReview t={t} details={detailRows(t, s, true)} onClose={onClose} /> : <>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--color-fg)", margin: "0 0 4px", textTransform: t.theme === "zigge" ? "uppercase" : "none" }}>Snabbboka</h2>
        <p className="sf-body" style={{ fontSize: 12.5, margin: "0 0 16px" }}>Allt på en skärm — för dig som vet vad du vill.</p>
        <div className="sf-eyebrow" style={{ marginBottom: 8 }}>Tjänst</div>{svcList(t, s.service, i => setS(p => ({ ...p, service: i })))}
        <div className="sf-eyebrow" style={{ margin: "18px 0 8px" }}>Frisör</div>{staffList(t, s.staff, i => setS(p => ({ ...p, staff: i })))}
        <div className="sf-eyebrow" style={{ margin: "18px 0 8px" }}>Dag</div>{dayChips(s.day, i => setS(p => ({ ...p, day: i })))}
        <div className="sf-eyebrow" style={{ margin: "18px 0 8px" }}>Tid</div>{slotChips(s.slot, v => setS(p => ({ ...p, slot: v })), 4)}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}><div style={{ flex: 1 }}>{bvField("Namn", "Namn", s.name, v => setS(p => ({ ...p, name: v })))}</div><div style={{ flex: 1 }}>{bvField("Telefon", "Telefon", s.phone, v => setS(p => ({ ...p, phone: v })))}</div></div>
      </div>
      <BBar label="Boka tid" sub={`${t.services[s.service].name} · ${s.slot}`} onClick={() => setDone(true)} />
      </>}
    </Shell>
  );
}

/* ── SHEET — bottensheet, sidan kvar bakom (Edit) ── */
function SfSheet({ t, open, onClose }) {
  const [s, setS] = useStateBV({ service: 0, day: 0, slot: "14:30" });
  const [done, setDone] = useStateBV(false);
  React.useEffect(() => { if (open) setDone(false); }, [open]);
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 88, background: "rgba(0,0,0,.4)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .3s" }} />
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, top: "12%", zIndex: 92, background: "var(--color-bg)", borderRadius: "22px 22px 0 0", boxShadow: "0 -16px 40px rgba(0,0,0,.22)", display: "flex", flexDirection: "column", overflow: "hidden", transform: open ? "translateY(0)" : "translateY(100%)", transition: "transform 420ms var(--ease-out)" }}>
        <div style={{ padding: "10px 0 4px", display: "grid", placeItems: "center" }}><span style={{ width: 40, height: 4, borderRadius: 999, background: "var(--color-line)" }} /></div>
        {done ? <DoneReview t={t} details={detailRows(t, s, false)} onClose={onClose} /> : <>
        <div style={{ padding: "4px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--color-fg)" }}>Boka tid</span><button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-fg-2)" }}><Icon name="x" size={22} /></button></div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
          <div className="sf-eyebrow" style={{ marginBottom: 10 }}>Tjänst</div>{svcList(t, s.service, i => setS(p => ({ ...p, service: i })))}
          <div className="sf-eyebrow" style={{ margin: "22px 0 10px" }}>Dag & tid</div>{dayChips(s.day, i => setS(p => ({ ...p, day: i })))}<div style={{ height: 10 }} />{slotChips(s.slot, v => setS(p => ({ ...p, slot: v })))}
        </div>
        <BBar label="Boka tid" sub={`${t.services[s.service].name} · ${s.slot || "—"}`} disabled={!s.slot} onClick={() => setDone(true)} />
        </>}
      </div>
    </>
  );
}

/* ── Post-booking confirmation + Google review ──
   Shown after every variant completes: receipt → "skriv en recension" → stars
   + text → publish to Google (right from the confirmation). */
function GoogleG({ size = 18 }) {
  // simple wordmark-coloured G badge (placeholder for real Google integration)
  return <span style={{ display: "grid", placeItems: "center", width: size + 8, height: size + 8, borderRadius: 999, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.18)", fontFamily: "Arial, sans-serif", fontWeight: 700, fontSize: size, color: "#4285F4", lineHeight: 1 }}>G</span>;
}

function DoneReview({ t, details, onClose }) {
  const [rating, setRating] = useStateBV(0);
  const [hover, setHover] = useStateBV(0);
  const [text, setText] = useStateBV("");
  const [writing, setWriting] = useStateBV(false);
  const [posted, setPosted] = useStateBV(false);
  const gUrl = "https://www.google.com/search?q=" + encodeURIComponent(t.name + " " + (t.address || "")) + "#lrd";

  const stars = (interactive) => (
    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} disabled={!interactive} onClick={() => setRating(n)} onMouseEnter={() => interactive && setHover(n)} onMouseLeave={() => interactive && setHover(0)}
          style={{ background: "none", border: "none", padding: 2, cursor: interactive ? "pointer" : "default", color: (hover || rating) >= n ? "#F5A623" : "var(--color-line)", lineHeight: 0 }}>
          <Icon name="star" size={interactive ? 34 : 18} stroke={1.5} style={{ fill: (hover || rating) >= n ? "#F5A623" : "transparent" }} />
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
        {!posted ? (<>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, background: "var(--color-accent-soft)", color: "var(--color-primary)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}><Icon name="checkCircle" size={34} stroke={1.6} /></div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 27, color: "var(--color-fg)", margin: 0 }}>Tack, vi ses!</h3>
            <p className="sf-body" style={{ fontSize: 14, marginTop: 6 }}>Bekräftelse skickad via sms.</p>
          </div>
          <div style={{ marginTop: 16, background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: "var(--sf-radius)", padding: 16 }}>
            {details.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--color-line)" }}><span className="sf-body" style={{ fontSize: 13.5 }}>{k}</span><span style={{ fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600, color: "var(--color-fg)", textAlign: "right" }}>{v}</span></div>
            ))}
          </div>
          {/* review prompt */}
          <div style={{ marginTop: 18, border: "1px solid var(--color-line)", borderRadius: "var(--sf-radius)", padding: 18, background: "var(--color-accent-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <GoogleG />
              <div><div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14.5, color: "var(--color-fg)" }}>Gillade du {t.name}?</div><div className="sf-body" style={{ fontSize: 12.5 }}>Lämna en recension på Google.</div></div>
            </div>
            <div style={{ marginTop: 14 }}>{stars(true)}</div>
            {(writing || rating > 0) && (
              <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Skriv några ord om ditt besök (valfritt)…" onFocus={() => setWriting(true)} rows={3}
                style={{ width: "100%", marginTop: 14, padding: "12px 13px", borderRadius: "var(--sf-radius)", border: "1.5px solid var(--color-line)", background: "var(--color-surface)", fontFamily: "var(--font-body)", fontSize: 14.5, color: "var(--color-fg)", outline: "none", boxSizing: "border-box", resize: "none" }} />
            )}
          </div>
        </>) : (
          <div style={{ textAlign: "center", paddingTop: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: 999, background: "var(--color-accent-soft)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}><GoogleG size={26} /></div>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--color-fg)", margin: 0 }}>Tack för din recension!</h3>
            <p className="sf-body" style={{ fontSize: 14, marginTop: 8, maxWidth: 300, marginLeft: "auto", marginRight: "auto" }}>Din {rating}-stjärniga recension publiceras på {t.name}s Google-profil.</p>
          </div>
        )}
      </div>
      {!posted
        ? <div style={{ flex: "none", padding: "12px 16px", borderTop: "1px solid var(--color-line)", background: "var(--color-surface)", display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={onClose} style={{ flex: "none", padding: "0 18px", minHeight: 54, borderRadius: "var(--sf-radius)", border: "1.5px solid var(--color-line)", background: "transparent", color: "var(--color-fg-2)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Hoppa över</button>
            <button disabled={!rating} onClick={() => { setPosted(true); try { window.open(gUrl, "_blank", "noopener"); } catch (e) {} }} style={{ flex: 1, minHeight: 54, borderRadius: "var(--sf-radius)", border: "none", background: rating ? "var(--color-primary)" : "var(--color-line)", color: rating ? accentText : "var(--color-fg-2)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, cursor: rating ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}><GoogleG size={15} /> Publicera på Google</button>
          </div>
        : <BBar label="Tillbaka till sidan" onClick={onClose} />}
    </>
  );
}

function ReviewBlock({ t }) {
  const [rating, setRating] = useStateBV(0);
  const [hover, setHover] = useStateBV(0);
  const [text, setText] = useStateBV("");
  const [posted, setPosted] = useStateBV(false);
  const gUrl = "https://www.google.com/search?q=" + encodeURIComponent(t.name + " " + (t.address || "")) + "#lrd";
  if (posted) return (
    <div style={{ marginTop: 20, border: "1px solid var(--color-line)", borderRadius: "var(--sf-radius)", padding: 20, textAlign: "center", background: "var(--color-accent-soft)" }}>
      <div style={{ display: "grid", placeItems: "center" }}><GoogleG size={22} /></div>
      <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, color: "var(--color-fg)", marginTop: 10 }}>Tack för din recension!</div>
      <div className="sf-body" style={{ fontSize: 13, marginTop: 4 }}>Din {rating}-stjärniga recension publiceras på {t.name}s Google-profil.</div>
    </div>
  );
  return (
    <div style={{ marginTop: 20, border: "1px solid var(--color-line)", borderRadius: "var(--sf-radius)", padding: 20, background: "var(--color-accent-soft)", textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}><GoogleG /><span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14.5, color: "var(--color-fg)" }}>Gillade du besöket? Recensera på Google</span></div>
      <div style={{ marginTop: 12, display: "flex", gap: 6, justifyContent: "center" }}>{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: (hover || rating) >= n ? "#F5A623" : "var(--color-line)", lineHeight: 0 }}><Icon name="star" size={32} stroke={1.5} style={{ fill: (hover || rating) >= n ? "#F5A623" : "transparent" }} /></button>)}</div>
      {rating > 0 && <><textarea value={text} onChange={e => setText(e.target.value)} placeholder="Skriv några ord om ditt besök (valfritt)…" rows={2} style={{ width: "100%", marginTop: 12, padding: "11px 12px", borderRadius: "var(--sf-radius)", border: "1.5px solid var(--color-line)", background: "var(--color-surface)", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--color-fg)", outline: "none", boxSizing: "border-box", resize: "none" }} />
        <button onClick={() => { setPosted(true); try { window.open(gUrl, "_blank", "noopener"); } catch (e) {} }} style={{ marginTop: 12, width: "100%", minHeight: 48, borderRadius: "var(--sf-radius)", border: "none", background: "var(--color-primary)", color: "#fff", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9 }}><GoogleG size={15} /> Publicera på Google</button></>}
    </div>
  );
}

Object.assign(window, { SfInline, SfWizard, SfCompact, SfSheet, DoneReview, ReviewBlock });
