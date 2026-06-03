/* Demo mixer — pick any salon × any booking method, independently, then click
   around to show a customer. Reuses all storefront components; booking variants
   are theme-agnostic (they read [data-theme] CSS vars), so any combo works. */
const { useState: useStateD } = React;

function DemoSalviaLayout({ t, onBook, onAccount }) {
  return (<>
    <UtilityBar t={t} /><Nav t={t} onBook={onBook} onAccount={onAccount} />
    <Hero t={t} onBook={onBook} /><Services t={t} onBook={onBook} /><About t={t} />
    <Team t={t} /><Gallery t={t} /><LocationCTA t={t} onBook={onBook} /><Footer t={t} />
  </>);
}

const D_LAYOUTS = { salvia: DemoSalviaLayout, leander: LayoutLeander, zigge: LayoutZigge, linnea: LayoutLinnea, edit: LayoutEdit };
const D_SALONS = [["salvia", "Studio Salvia", "#5E7361"], ["leander", "Maison Leander", "#7E6E92"], ["zigge", "Zigge", "#C8743C"], ["linnea", "Salong Linnea", "#B0693F"], ["edit", "Edit", "#3A3733"]];
const D_BOOKINGS = [["drawer", "Slide-over", BookingWizard], ["wizard", "Steg-för-steg", SfWizard], ["kompakt", "Kompakt", SfCompact], ["inline", "Inline", SfInline], ["sheet", "Bottom-sheet", SfSheet]];

function Row({ label, options, current, onPick }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,.5)", letterSpacing: "0.1em", width: 64, flex: "none" }}>{label}</span>
      <div style={{ display: "flex", gap: 5, overflowX: "auto" }}>
        {options.map(o => {
          const k = o[0], name = o[1], c = o[2];
          const on = current === k;
          return (
            <button key={k} onClick={() => onPick(k)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 999, border: "none", cursor: "pointer", background: on ? "#fff" : "rgba(255,255,255,.08)", color: on ? "#1a1a1a" : "rgba(255,255,255,.82)", fontFamily: "'Inter',sans-serif", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", transition: "all .15s" }}>
              {c && <span style={{ width: 9, height: 9, borderRadius: 999, background: c }} />}{name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DemoApp() {
  const [theme, setTheme] = useStateD("salvia");
  const [btype, setBtype] = useStateD("drawer");
  const [booking, setBooking] = useStateD(false);
  const [account, setAccount] = useStateD(false);
  const [panel, setPanel] = useStateD(true);
  const t = window.TENANTS[theme];
  const Layout = D_LAYOUTS[theme] || DemoSalviaLayout;
  const Booking = (D_BOOKINGS.find(b => b[0] === btype) || D_BOOKINGS[0])[2];

  return (
    <div data-world="storefront" data-theme={theme} data-screen-label={"Demo · " + t.name} style={{ minHeight: "100vh" }}>
      <Layout t={t} onBook={() => setBooking(true)} onAccount={() => setAccount(true)} />
      <Booking t={t} open={booking} onClose={() => setBooking(false)} />
      <Account t={t} open={account} onClose={() => setAccount(false)} />

      {panel ? (
        <div style={{ position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)", zIndex: 200, display: "flex", flexDirection: "column", gap: 8, background: "rgba(18,18,18,.9)", backdropFilter: "blur(16px)", padding: "12px 14px", borderRadius: 18, boxShadow: "0 16px 44px rgba(0,0,0,.4)", maxWidth: "calc(100vw - 20px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 700, color: "#fff", letterSpacing: "0.08em" }}>DEMO — blanda fritt</span>
            <button onClick={() => setPanel(false)} title="Dölj" style={{ background: "rgba(255,255,255,.1)", border: "none", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontFamily: "'Inter',sans-serif", fontWeight: 600, cursor: "pointer" }}>Dölj ✕</button>
          </div>
          <Row label="SALONG" options={D_SALONS} current={theme} onPick={setTheme} />
          <Row label="BOKNING" options={D_BOOKINGS} current={btype} onPick={setBtype} />
          <button onClick={() => setBooking(true)} style={{ marginTop: 4, width: "100%", padding: "10px", borderRadius: 10, border: "none", background: "#F5A623", color: "#3A2A06", fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>▶ Förhandsvisa bokning</button>
        </div>
      ) : (
        <button onClick={() => setPanel(true)} title="Visa demo-kontroller" style={{ position: "fixed", bottom: 18, right: 18, zIndex: 200, width: 52, height: 52, borderRadius: 999, border: "none", background: "rgba(18,18,18,.9)", backdropFilter: "blur(16px)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center", boxShadow: "0 12px 34px rgba(0,0,0,.4)" }}><Icon name="settings" size={22} /></button>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<DemoApp />);
