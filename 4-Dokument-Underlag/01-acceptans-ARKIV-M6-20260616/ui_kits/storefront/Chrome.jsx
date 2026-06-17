/* Storefront chrome — utility bar, sticky nav, footer. Theme-agnostic. */
const { useState, useEffect } = React;

function Wordmark({ t, scrolled }) {
  const display = t.logoStyle === "display";
  return (
    <span style={{
      fontFamily: "var(--font-display)",
      fontWeight: display ? 400 : 600,
      fontSize: display ? 30 : 24,
      letterSpacing: display ? "0.12em" : "0.01em",
      lineHeight: 1,
      color: "var(--color-fg)",
    }}>{t.wordmark}</span>
  );
}

function UtilityBar({ t }) {
  return (
    <div style={{
      background: "var(--color-primary)", color: "#fff",
      fontFamily: "var(--font-body)", fontSize: 12.5, letterSpacing: "0.04em",
      textAlign: "center", padding: "7px 16px",
    }}>
      {t.theme === "zigge" ? "Drop in eller boka online · Öppet alla dagar"
        : t.theme === "leander" ? "Fri konsultation inför färg · Välkommen in"
        : "Boka online dygnet runt · " + t.address}
    </div>
  );
}

function Nav({ t, onBook, onAccount }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links = ["Tjänster", "Om oss", "Frisörer", "Galleri", "Hitta hit"];
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 40,
      background: scrolled ? "color-mix(in srgb, var(--color-bg) 92%, transparent)" : "transparent",
      backdropFilter: scrolled ? "saturate(140%) blur(12px)" : "none",
      borderBottom: scrolled ? "1px solid var(--color-line)" : "1px solid transparent",
      transition: "all var(--dur-base) var(--ease-out)",
    }}>
      <div style={{
        maxWidth: 1240, margin: "0 auto", padding: "16px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
      }}>
        <Wordmark t={t} scrolled={scrolled} />
        <nav style={{ display: "flex", gap: 30, alignItems: "center" }} className="sf-navlinks">
          {links.map(l => (
            <a key={l} href="#" onClick={e => e.preventDefault()} style={{
              fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 500,
              color: "var(--color-fg)", textDecoration: "none", letterSpacing: "0.01em", whiteSpace: "nowrap",
              opacity: 0.82, transition: "opacity var(--dur-fast)",
            }} onMouseEnter={e => e.target.style.opacity = 1}
               onMouseLeave={e => e.target.style.opacity = 0.82}>{l}</a>
          ))}
          <button onClick={onBook} className="sf-book-btn" style={{
            fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600,
            color: t.theme === "zigge" ? "#14120E" : "#fff",
            background: "var(--color-primary)", border: "none",
            padding: "11px 22px", borderRadius: "var(--radius-pill)", cursor: "pointer",
            letterSpacing: t.theme === "zigge" ? "0.08em" : "0.01em",
            textTransform: t.theme === "zigge" ? "uppercase" : "none",
            transition: "background var(--dur-fast), transform var(--dur-fast)",
          }} onMouseEnter={e => e.currentTarget.style.background = "var(--color-primary-d)"}
             onMouseLeave={e => e.currentTarget.style.background = "var(--color-primary)"}
             onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"}
             onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}>Boka&nbsp;tid</button>
          <button onClick={onAccount} title="Mitt konto" aria-label="Mitt konto" style={{
            display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: 999,
            border: "1px solid var(--color-line)", background: "transparent", color: "var(--color-fg)", cursor: "pointer",
          }}><Icon name="user" size={19} /></button>
        </nav>
        <button className="sf-burger" onClick={() => setOpen(true)} style={{
          display: "none", background: "none", border: "none", color: "var(--color-fg)", cursor: "pointer",
        }}><Icon name="menu" size={26} /></button>
      </div>
      {open && (
        <div onClick={() => setOpen(false)} style={{
          position: "fixed", inset: 0, zIndex: 60, background: "color-mix(in srgb, var(--color-bg) 97%, transparent)",
          display: "flex", flexDirection: "column", padding: 28,
        }}>
          <button onClick={() => setOpen(false)} style={{ alignSelf: "flex-end", background: "none", border: "none", color: "var(--color-fg)" }}><Icon name="x" size={28} /></button>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 30 }}>
            {links.map(l => <a key={l} href="#" onClick={e => { e.preventDefault(); setOpen(false); }} style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--color-fg)", textDecoration: "none" }}>{l}</a>)}
            <button onClick={() => { setOpen(false); onBook(); }} style={{ marginTop: 12, fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 600, color: t.theme === "zigge" ? "#14120E" : "#fff", background: "var(--color-primary)", border: "none", padding: "14px", borderRadius: "var(--radius-pill)" }}>Boka tid</button>
          </div>
        </div>
      )}
    </header>
  );
}

function Footer({ t }) {
  return (
    <footer style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-line)", padding: "64px 28px 40px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 40 }} className="sf-footer-grid">
        <div>
          <Wordmark t={t} />
          <p className="sf-body" style={{ marginTop: 14, maxWidth: 320, fontSize: 15 }}>{t.tagline}. {t.city}.</p>
          <div style={{ display: "flex", gap: 14, marginTop: 20 }}>
            <a href="#" onClick={e=>e.preventDefault()} style={{ color: "var(--color-fg)", opacity: 0.7 }}><Icon name="instagram" size={20} /></a>
            <a href="#" onClick={e=>e.preventDefault()} style={{ color: "var(--color-fg)", opacity: 0.7 }}><Icon name="facebook" size={20} /></a>
          </div>
        </div>
        <div>
          <h4 className="sf-eyebrow" style={{ marginBottom: 14 }}>Besök oss</h4>
          <p className="sf-body" style={{ fontSize: 14.5 }}>{t.address}<br/>{t.instagram}</p>
        </div>
        <div>
          <h4 className="sf-eyebrow" style={{ marginBottom: 14 }}>Öppettider</h4>
          {t.hours.filter(h => h[0]).map(([d, h]) => (
            <div key={d} style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--font-body)", fontSize: 14, color: "var(--color-fg-2)", maxWidth: 200, padding: "3px 0" }}>
              <span>{d}</span><span>{h}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ maxWidth: 1240, margin: "40px auto 0", paddingTop: 24, borderTop: "1px solid var(--color-line)", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--color-fg-2)" }} className="sf-footer-bottom">
        <span>© {new Date().getFullYear()} {t.name}</span>
        <span style={{ fontStyle: "italic", fontFamily: "var(--font-display)" }}>Designad med omsorg</span>
      </div>
    </footer>
  );
}

Object.assign(window, { Wordmark, UtilityBar, Nav, Footer });
