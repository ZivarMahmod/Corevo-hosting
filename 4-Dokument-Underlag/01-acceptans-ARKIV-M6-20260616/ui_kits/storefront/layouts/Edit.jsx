/* LAYOUT · EDIT — modern editorial (kreateam / freshcut feel). Asymmetric hero
   with an overlapping text card, clean numbered 2-col service grid, charcoal. */
function LayoutEdit({ t, onBook, onAccount }) {
  return (
    <div>
      <MiniNav t={t} onBook={onBook} onAccount={onAccount} variant="left" />
      {/* asymmetric hero: big image + overlapping card */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "24px 28px 80px", position: "relative" }}>
        <div style={{ height: "min(70vh, 600px)", minHeight: 420, backgroundImage: `url(${t.heroImages[0]})`, backgroundSize: "cover", backgroundPosition: "center", filter: "grayscale(.15)" }} />
        <div style={{ position: "relative", marginTop: -110, marginLeft: "clamp(0px, 4vw, 64px)", maxWidth: 560, background: "var(--color-bg)", padding: "40px 44px", border: "1px solid var(--color-line)" }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 11.5, letterSpacing: "0.26em", textTransform: "uppercase", color: "var(--color-primary)" }}>{t.heroEyebrow}</span>
          <h1 className="sf-hero" style={{ color: "var(--color-fg)", margin: "16px 0 0", whiteSpace: "pre-line", fontSize: "clamp(34px,4vw,56px)" }}>{t.heroTitle}</h1>
          <p className="sf-lede" style={{ color: "var(--color-fg-2)", marginTop: 16 }}>{t.heroLede}</p>
          <button onClick={onBook} style={{ marginTop: 26, fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 600, color: "#fff", background: "var(--color-primary)", border: "none", padding: "15px 32px", borderRadius: 2, cursor: "pointer", letterSpacing: "0.04em" }}>Boka tid</button>
        </div>
      </section>
      {/* numbered 2-col grid */}
      <section style={{ borderTop: "1px solid var(--color-line)" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 28px" }}>
          <div style={{ padding: "22px 0", fontFamily: "var(--font-body)", fontSize: 11.5, letterSpacing: "0.26em", textTransform: "uppercase", color: "var(--color-primary)" }}>Tjänster</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 56px" }} className="sf-about-grid">
            {t.services.map(s => (
              <div key={s.n} onClick={onBook} style={{ display: "flex", gap: 18, padding: "24px 0", borderTop: "1px solid var(--color-line)", cursor: "pointer" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--color-primary)" }}>{s.n}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 23, color: "var(--color-fg)" }}>{s.name}</span>
                    <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, color: "var(--color-fg)", whiteSpace: "nowrap" }}>{s.price}</span>
                  </div>
                  <div className="sf-body" style={{ fontSize: 13.5, marginTop: 4 }}>{s.desc} · {s.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* about split + stats */}
      <section style={{ maxWidth: 1240, margin: "0 auto", padding: "84px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }} className="sf-about-grid">
        <div style={{ height: 420, backgroundImage: `url(${t.aboutImage})`, backgroundSize: "cover", backgroundPosition: "center", filter: "grayscale(.15)" }} />
        <div>
          <span className="sf-eyebrow">— Om {t.name}</span>
          <p className="sf-italic" style={{ fontSize: "clamp(22px,2.6vw,32px)", color: "var(--color-fg)", margin: "16px 0 20px", lineHeight: 1.3 }}>"{t.italic}"</p>
          <p className="sf-body" style={{ fontSize: 16 }}>{t.aboutCopy}</p>
          <div style={{ display: "flex", gap: 48, marginTop: 32 }}>
            {t.stats.map(([n, l]) => (
              <div key={l}><div style={{ fontFamily: "var(--font-display)", fontSize: 38, color: "var(--color-primary)" }}>{n}</div><div className="sf-body" style={{ fontSize: 13, marginTop: 4 }}>{l}</div></div>
            ))}
          </div>
        </div>
      </section>
      <MiniFooter t={t} />
    </div>
  );
}
window.LayoutEdit = LayoutEdit;
