/* LAYOUT · ZIGGE — zigges.se: frisör + barberare. Split-screen hero (dark
   color panel + photo), horizontal service bands, bold condensed type. */
function LayoutZigge({ t, onBook, onAccount }) {
  return (
    <div>
      <MiniNav t={t} onBook={onBook} onAccount={onAccount} variant="split" />
      {/* split hero: color panel + photo */}
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: "min(80vh, 700px)" }} className="sf-about-grid">
        <div style={{ background: "var(--color-surface)", display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px clamp(28px,5vw,72px)" }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, letterSpacing: "0.26em", textTransform: "uppercase", color: "var(--color-primary)" }}>{t.heroEyebrow}</span>
          <h1 className="sf-hero" style={{ color: "var(--color-fg)", margin: "18px 0 0", whiteSpace: "pre-line", textTransform: "uppercase" }}>{t.heroTitle}</h1>
          <p className="sf-lede" style={{ color: "var(--color-fg-2)", maxWidth: 420, marginTop: 22 }}>{t.heroLede}</p>
          <div style={{ display: "flex", gap: 14, marginTop: 32, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={onBook} style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "#fff", background: "var(--color-primary)", border: "none", padding: "16px 32px", borderRadius: 2, cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase" }}>Boka tid</button>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--color-fg-2)", letterSpacing: "0.08em", textTransform: "uppercase" }}>eller drop in</span>
          </div>
        </div>
        <div style={{ backgroundImage: `url(${t.heroImages[0]})`, backgroundSize: "cover", backgroundPosition: "center", minHeight: 360, filter: "saturate(.9)" }} />
      </section>
      {/* horizontal service bands */}
      <section>
        <div style={{ padding: "22px clamp(28px,5vw,72px)", borderTop: "1px solid var(--color-line)", borderBottom: "1px solid var(--color-line)", fontFamily: "var(--font-body)", fontSize: 12, letterSpacing: "0.26em", textTransform: "uppercase", color: "var(--color-primary)" }}>Tjänster</div>
        {t.services.map(s => (
          <div key={s.n} onClick={onBook} style={{ display: "grid", gridTemplateColumns: "80px 1fr auto", gap: 24, alignItems: "center", padding: "24px clamp(28px,5vw,72px)", borderBottom: "1px solid var(--color-line)", cursor: "pointer", transition: "background .15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--color-accent-soft)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--color-primary)" }}>{s.n}</span>
            <div><div style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--color-fg)", textTransform: "uppercase", letterSpacing: "0.02em" }}>{s.name}</div><div className="sf-body" style={{ fontSize: 13.5 }}>{s.desc}</div></div>
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}><div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 16, color: "var(--color-fg)" }}>{s.price}</div><div className="sf-body" style={{ fontSize: 12.5 }}>{s.time}</div></div>
          </div>
        ))}
      </section>
      {/* stat strip */}
      <section style={{ display: "flex", borderBottom: "1px solid var(--color-line)" }} className="sf-about-grid">
        {t.stats.map(([n, l], idx) => (
          <div key={l} style={{ flex: 1, padding: "44px 24px", textAlign: "center", borderLeft: idx ? "1px solid var(--color-line)" : "none" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 46, color: "var(--color-primary)" }}>{n}</div>
            <div style={{ fontFamily: "var(--font-body)", fontSize: 11.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-fg-2)", marginTop: 8 }}>{l}</div>
          </div>
        ))}
      </section>
      <MiniFooter t={t} />
    </div>
  );
}
window.LayoutZigge = LayoutZigge;
