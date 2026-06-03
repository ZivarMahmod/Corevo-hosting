/* LAYOUT · LINNEA — warm neighborhood salon (hårfixarna / mjärdevi feel).
   Side-by-side hero (text + image, not full-bleed), service card grid, warm. */
function LayoutLinnea({ t, onBook, onAccount }) {
  return (
    <div>
      <MiniNav t={t} onBook={onBook} onAccount={onAccount} variant="left" />
      {/* side-by-side hero */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 28px 72px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }} className="sf-about-grid">
        <div>
          <span style={{ display: "inline-block", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-primary)", background: "var(--color-accent-soft)", padding: "7px 16px", borderRadius: 999 }}>{t.heroEyebrow}</span>
          <h1 className="sf-hero" style={{ color: "var(--color-fg)", margin: "20px 0 0", whiteSpace: "pre-line" }}>{t.heroTitle}</h1>
          <p className="sf-lede" style={{ color: "var(--color-fg-2)", maxWidth: 440, marginTop: 20 }}>{t.heroLede}</p>
          <div style={{ display: "flex", gap: 14, marginTop: 30, alignItems: "center" }}>
            <button onClick={onBook} style={{ fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "#fff", background: "var(--color-primary)", border: "none", padding: "15px 32px", borderRadius: 999, cursor: "pointer", boxShadow: "0 10px 24px color-mix(in srgb, var(--color-primary) 34%, transparent)" }}>Boka tid</button>
            <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, color: "var(--color-fg-2)", fontSize: 14 }}>eller drop in →</span>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", top: -18, right: -10, width: 120, height: 120, background: "var(--color-primary)", opacity: 0.14, borderRadius: 30 }} />
          <div style={{ height: 460, backgroundImage: `url(${t.heroImages[0]})`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: 24 }} />
        </div>
      </section>
      {/* service card grid */}
      <section style={{ background: "var(--color-surface)", padding: "84px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <span className="sf-eyebrow">— Behandlingar</span>
          <h2 className="sf-h1" style={{ color: "var(--color-fg)", marginTop: 10 }}>Våra behandlingar</h2>
        </div>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }} className="sf-team-grid">
          {t.services.map((s, idx) => (
            <div key={s.n} onClick={onBook} style={{ background: "var(--color-bg)", border: "1px solid var(--color-line)", borderRadius: 20, padding: 26, cursor: "pointer", transition: "transform .15s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"} onMouseLeave={e => e.currentTarget.style.transform = "none"}>
              <span style={{ display: "grid", placeItems: "center", width: 44, height: 44, borderRadius: 14, background: "var(--color-accent-soft)", color: "var(--color-primary)" }}><Icon name="scissors" size={20} /></span>
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 23, color: "var(--color-fg)", margin: "16px 0 0" }}>{s.name}</h3>
              <p className="sf-body" style={{ fontSize: 14, marginTop: 6 }}>{s.desc}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, fontFamily: "var(--font-body)", fontWeight: 600 }}>
                <span style={{ color: "var(--color-primary)", fontSize: 16 }}>{s.price}</span><span style={{ color: "var(--color-fg-2)", fontSize: 13 }}>{s.time}</span>
              </div>
            </div>
          ))}
        </div>
        {/* stat chips */}
        <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 40, flexWrap: "wrap" }}>
          {t.stats.map(([n, l]) => (
            <div key={l} style={{ background: "var(--color-bg)", border: "1px solid var(--color-line)", borderRadius: 18, padding: "20px 32px", textAlign: "center", minWidth: 150 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 34, color: "var(--color-primary)" }}>{n}</div>
              <div className="sf-body" style={{ fontSize: 13, marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>
      <MiniFooter t={t} />
    </div>
  );
}
window.LayoutLinnea = LayoutLinnea;
