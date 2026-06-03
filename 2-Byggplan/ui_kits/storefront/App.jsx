/* Storefront app — the real, grounded, fully clickable salon site.
   Three tenants built from the brief's real references (studio22 → Salvia,
   studioleander → Leander, zigges → Zigge). Sticky nav, photo hero carousel,
   editorial sections, embedded booking drawer, customer account — all clickable
   and mobile-responsive. Switch tenants from the bottom pill. */
const { useState: useStateApp } = React;

function ThemeSwitcher({ current, onPick }) {
  const opts = [["salvia", "Studio Salvia", "#5E7361"], ["leander", "Maison Leander", "#7E6E92"], ["zigge", "Zigge", "#C8743C"], ["linnea", "Salong Linnea", "#B0693F"], ["edit", "Edit", "#3A3733"]];
  return (
    <div style={{ position: "fixed", bottom: 18, left: "50%", transform: "translateX(-50%)", zIndex: 70, display: "flex", gap: 6, background: "rgba(20,20,20,.82)", backdropFilter: "blur(14px)", padding: 6, borderRadius: 999, boxShadow: "0 14px 40px rgba(0,0,0,.32)", maxWidth: "calc(100vw - 24px)", overflowX: "auto" }}>
      <span style={{ fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.55)", alignSelf: "center", padding: "0 10px 0 8px", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>SALONG</span>
      {opts.map(([k, name, c]) => (
        <button key={k} onClick={() => onPick(k)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 999, border: "none", cursor: "pointer", background: current === k ? "#fff" : "transparent", color: current === k ? "#1a1a1a" : "rgba(255,255,255,.8)", fontFamily: "'Inter',sans-serif", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", transition: "all .2s" }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: c }} />{name}
        </button>
      ))}
    </div>
  );
}

function SalviaLayout({ t, onBook, onAccount }) {
  return (
    <>
      <UtilityBar t={t} />
      <Nav t={t} onBook={onBook} onAccount={onAccount} />
      <Hero t={t} onBook={onBook} />
      <Services t={t} onBook={onBook} />
      <About t={t} />
      <Team t={t} />
      <Gallery t={t} />
      <LocationCTA t={t} onBook={onBook} />
      <Footer t={t} />
    </>
  );
}

const LAYOUTS = { salvia: SalviaLayout, leander: LayoutLeander, zigge: LayoutZigge, linnea: LayoutLinnea, edit: LayoutEdit };
// each tenant demonstrates a different booking variant
const BOOKINGS = { salvia: BookingWizard, leander: SfWizard, zigge: SfCompact, linnea: SfInline, edit: SfSheet };

function StorefrontApp() {
  const params = new URLSearchParams(location.search);
  const initial = window.TENANTS[params.get("theme")] ? params.get("theme") : "salvia";
  const solo = params.get("solo") === "1";
  const [theme, setTheme] = useStateApp(initial);
  const [booking, setBooking] = useStateApp(false);
  const [account, setAccount] = useStateApp(false);
  const t = window.TENANTS[theme];
  const Layout = LAYOUTS[theme] || SalviaLayout;
  const Booking = BOOKINGS[theme] || BookingWizard;

  return (
    <div data-world="storefront" data-theme={theme} data-screen-label={"Storefront · " + t.name} style={{ minHeight: "100vh" }}>
      <Layout t={t} onBook={() => setBooking(true)} onAccount={() => setAccount(true)} />
      <Booking t={t} open={booking} onClose={() => setBooking(false)} />
      <Account t={t} open={account} onClose={() => setAccount(false)} />
      {!solo && <ThemeSwitcher current={theme} onPick={setTheme} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<StorefrontApp />);
