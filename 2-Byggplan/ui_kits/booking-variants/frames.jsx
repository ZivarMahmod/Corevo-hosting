/* Booking variants — phone frame + shared step pieces (reused by all 4
   variants so the comparison is about PRESENTATION, not content). */
const { useState: useStateF } = React;

/* clean phone frame (UX comparison, not device marketing) */
function Phone({ children, label }) {
  const b = window.BK;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ width: 390, height: 800, borderRadius: 46, background: "#111", padding: 11, boxShadow: "0 30px 70px rgba(0,0,0,.22)" }}>
        <div style={{ width: "100%", height: "100%", borderRadius: 36, overflow: "hidden", background: b.bg, position: "relative" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 34, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", fontFamily: b.font, fontSize: 13, fontWeight: 600, color: b.ink, zIndex: 50, pointerEvents: "none" }}>
            <span>9:41</span><span style={{ width: 70, height: 22, background: "#111", borderRadius: 999, position: "absolute", left: "50%", transform: "translateX(-50%)", top: 6 }} /><span>5G</span>
          </div>
          <div style={{ position: "absolute", inset: 0, paddingTop: 34, display: "flex", flexDirection: "column" }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

/* salon header (the embedded brand, always visible) */
function SalonBar({ compact }) {
  const b = window.BK;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: compact ? "12px 18px" : "14px 20px", borderBottom: `1px solid ${b.line}`, background: b.surface, flex: "none" }}>
      <span style={{ fontFamily: b.serif, fontSize: 22, fontWeight: 600, color: b.ink }}>{b.salon}</span>
      <span style={{ fontFamily: b.font, fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: b.accent }}>Boka tid</span>
    </div>
  );
}

const fld = (label, ph, val, on) => {
  const b = window.BK;
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <span style={{ fontFamily: b.font, fontSize: 12.5, fontWeight: 600, color: b.ink }}>{label}</span>
      <input value={val || ""} onChange={e => on && on(e.target.value)} placeholder={ph} style={{ width: "100%", marginTop: 6, padding: "14px 14px", borderRadius: 12, border: `1.5px solid ${b.line}`, background: b.surface, fontFamily: b.font, fontSize: 16, color: b.ink, outline: "none", boxSizing: "border-box" }}
        onFocus={e => e.target.style.borderColor = b.accent} onBlur={e => e.target.style.borderColor = b.line} />
    </label>
  );
};

/* ---- shared step bodies (take selection + setter) ---- */
function ServiceList({ sel, set, big }) {
  const b = window.BK;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {b.services.map((s, i) => {
        const on = sel === i;
        return (
          <button key={i} onClick={() => set(i)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: big ? "18px 18px" : "15px 16px", borderRadius: 14, border: `1.5px solid ${on ? b.accent : b.line}`, background: on ? b.soft : b.surface, cursor: "pointer", textAlign: "left", minHeight: 56 }}>
            <span><span style={{ display: "block", fontFamily: b.font, fontWeight: 600, fontSize: big ? 17 : 15.5, color: b.ink }}>{s.name}</span><span style={{ fontFamily: b.font, fontSize: 13, color: b.ink2 }}>{s.time}</span></span>
            <span style={{ fontFamily: b.font, fontWeight: 600, fontSize: 15, color: b.ink }}>{s.price}</span>
          </button>
        );
      })}
    </div>
  );
}

function StaffRow({ sel, set }) {
  const b = window.BK;
  return (
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
      {b.staff.map((s, i) => {
        const on = sel === i;
        return (
          <button key={i} onClick={() => set(i)} style={{ flex: "none", width: 92, padding: "14px 8px", borderRadius: 14, border: `1.5px solid ${on ? b.accent : b.line}`, background: on ? b.soft : b.surface, cursor: "pointer", textAlign: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: 999, margin: "0 auto", background: s.any ? b.soft : b.accent, color: s.any ? b.accent : "#fff", display: "grid", placeItems: "center", fontFamily: b.serif, fontWeight: 600, fontSize: 18, border: s.any ? `1.5px solid ${b.accent}` : "none" }}>{s.any ? "✦" : s.name[0]}</div>
            <div style={{ fontFamily: b.font, fontWeight: 600, fontSize: 12.5, color: b.ink, marginTop: 8 }}>{s.name}</div>
            <div style={{ fontFamily: b.font, fontSize: 10.5, color: b.ink2, marginTop: 1 }}>{s.role}</div>
          </button>
        );
      })}
    </div>
  );
}

function DayRow({ sel, set }) {
  const b = window.BK;
  return (
    <div style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 4 }}>
      {b.days.map(([d, n], i) => {
        const on = sel === i;
        return (
          <button key={i} onClick={() => set(i)} style={{ flex: "none", width: 60, padding: "12px 0", borderRadius: 14, border: `1.5px solid ${on ? b.accent : b.line}`, background: on ? b.accent : b.surface, color: on ? "#fff" : b.ink, cursor: "pointer" }}>
            <div style={{ fontFamily: b.font, fontSize: 11.5, opacity: 0.85 }}>{d}</div>
            <div style={{ fontFamily: b.font, fontSize: 19, fontWeight: 700, marginTop: 2 }}>{n}</div>
          </button>
        );
      })}
    </div>
  );
}

function SlotGrid({ sel, set, cols = 3 }) {
  const b = window.BK;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 9 }}>
      {b.slots.map((t, i) => {
        const taken = i === 2 || i === 6;
        const on = sel === t;
        return (
          <button key={t} disabled={taken} onClick={() => set(t)} style={{ padding: "15px 0", borderRadius: 12, border: `1.5px solid ${on ? b.accent : b.line}`, background: on ? b.accent : taken ? "transparent" : b.surface, color: on ? "#fff" : taken ? b.ink2 : b.ink, fontFamily: b.font, fontWeight: 600, fontSize: 15.5, cursor: taken ? "not-allowed" : "pointer", opacity: taken ? 0.4 : 1, textDecoration: taken ? "line-through" : "none", minHeight: 50 }}>{t}</button>
        );
      })}
    </div>
  );
}

function Confirmation({ sel }) {
  const b = window.BK;
  return (
    <div style={{ textAlign: "center", padding: "10px 6px" }}>
      <div style={{ width: 66, height: 66, borderRadius: 999, background: b.soft, color: b.accent, display: "grid", placeItems: "center", margin: "0 auto 16px" }}><Icon name="checkCircle" size={36} stroke={1.6} /></div>
      <h3 style={{ fontFamily: b.serif, fontSize: 27, color: b.ink, margin: 0 }}>Tack, vi ses!</h3>
      <p style={{ fontFamily: b.font, fontSize: 14, color: b.ink2, marginTop: 6 }}>Bekräftelse skickad via sms.</p>
      <div style={{ marginTop: 18, textAlign: "left", background: b.surface, border: `1px solid ${b.line}`, borderRadius: 14, padding: 16 }}>
        {[["Tjänst", b.services[sel.service ?? 0].name], ["Frisör", b.staff[sel.staff ?? 0].name], ["Tid", `${b.days[sel.day ?? 0][0]} ${b.days[sel.day ?? 0][1]} · ${sel.slot || "14:30"}`]].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${b.line}` }}>
            <span style={{ fontFamily: b.font, fontSize: 13.5, color: b.ink2 }}>{k}</span><span style={{ fontFamily: b.font, fontSize: 13.5, fontWeight: 600, color: b.ink }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* big bottom action bar (thumb reach) */
function BottomBar({ label, sub, onClick, disabled, onBack }) {
  const b = window.BK;
  return (
    <div style={{ flex: "none", padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", borderTop: `1px solid ${b.line}`, background: b.surface, display: "flex", gap: 10, alignItems: "center" }}>
      {onBack && <button onClick={onBack} style={{ flex: "none", width: 52, height: 54, borderRadius: 14, border: `1.5px solid ${b.line}`, background: "transparent", color: b.ink, cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="arrowLeft" size={20} /></button>}
      <button onClick={onClick} disabled={disabled} style={{ flex: 1, height: 54, borderRadius: 14, border: "none", background: disabled ? b.line : b.accent, color: disabled ? b.ink2 : "#fff", fontFamily: b.font, fontWeight: 600, fontSize: 16, cursor: disabled ? "not-allowed" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", lineHeight: 1.2 }}>
        <span>{label}</span>{sub && <span style={{ fontSize: 11.5, fontWeight: 500, opacity: 0.85 }}>{sub}</span>}
      </button>
    </div>
  );
}

function SectionLabel({ n, children }) {
  const b = window.BK;
  return <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 0 12px" }}><span style={{ width: 22, height: 22, borderRadius: 999, background: b.accent, color: "#fff", display: "grid", placeItems: "center", fontFamily: b.font, fontSize: 12, fontWeight: 700 }}>{n}</span><span style={{ fontFamily: b.font, fontSize: 14, fontWeight: 600, color: b.ink }}>{children}</span></div>;
}

Object.assign(window, { Phone, SalonBar, fld, ServiceList, StaffRow, DayRow, SlotGrid, Confirmation, BottomBar, SectionLabel });
