/* Storefront home sections — Hero (carousel), Services, About, Team, Gallery, Location, CTA. */
const { useState: useStateH, useEffect: useEffectH, useRef: useRefH } = React;

/* scroll-reveal helper */
function Reveal({ children, delay = 0, style = {} }) {
  const ref = useRefH(null);
  const [vis, setVis] = useStateH(false);
  useEffectH(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } }, { threshold: 0.12 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} style={{ ...style, opacity: vis ? 1 : 0, transform: vis ? "none" : "translateY(28px)", transition: `opacity 700ms var(--ease-out) ${delay}ms, transform 700ms var(--ease-out) ${delay}ms` }}>{children}</div>;
}

function Hero({ t, onBook }) {
  const [i, setI] = useStateH(0);
  useEffectH(() => { const id = setInterval(() => setI(p => (p + 1) % t.heroImages.length), 5000); return () => clearInterval(id); }, [t]);
  const dark = t.theme === "zigge";
  return (
    <section style={{ position: "relative", height: "min(92vh, 820px)", minHeight: 560, overflow: "hidden", marginTop: -84 }}>
      {t.heroImages.map((src, idx) => (
        <div key={idx} style={{ position: "absolute", inset: 0, backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center", opacity: i === idx ? 1 : 0, transform: i === idx ? "scale(1.04)" : "scale(1)", transition: "opacity 1400ms var(--ease-in-out), transform 6000ms linear" }} />
      ))}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.32) 0%, rgba(0,0,0,.20) 40%, rgba(0,0,0,.66) 100%)" }} />
      <div style={{ position: "relative", height: "100%", maxWidth: 1240, margin: "0 auto", padding: "0 28px", display: "flex", flexDirection: "column", justifyContent: t.theme === "leander" ? "center" : "flex-end", paddingBottom: t.theme === "leander" ? 0 : 92, paddingTop: 120 }}>
        <div style={{ width: "100%", maxWidth: t.theme === "leander" ? 760 : 940, marginLeft: t.theme === "leander" ? "auto" : 0, marginRight: t.theme === "leander" ? "auto" : 0, textAlign: t.theme === "leander" ? "center" : "left" }}>
          <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>{t.heroEyebrow}</span>
          <h1 className="sf-hero" style={{ color: "#fff", margin: "16px 0 0", whiteSpace: "pre-line", textShadow: "0 2px 30px rgba(0,0,0,.25)", textTransform: t.theme === "zigge" ? "uppercase" : "none" }}>{t.heroTitle}</h1>
          <p className="sf-lede" style={{ color: "rgba(255,255,255,.92)", maxWidth: 520, marginTop: 22, marginLeft: t.theme === "leander" ? "auto" : 0, marginRight: t.theme === "leander" ? "auto" : 0 }}>{t.heroLede}</p>
          <button onClick={onBook} style={{ marginTop: 32, fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: dark ? "#14120E" : "#fff", background: "var(--color-primary)", border: "none", padding: "16px 34px", borderRadius: "var(--radius-pill)", cursor: "pointer", letterSpacing: dark ? "0.08em" : "0.01em", textTransform: dark ? "uppercase" : "none", boxShadow: "0 12px 30px rgba(0,0,0,.25)", transition: "transform var(--dur-fast), background var(--dur-fast)" }}
            onMouseEnter={e => e.currentTarget.style.background = "var(--color-primary-d)"} onMouseLeave={e => e.currentTarget.style.background = "var(--color-primary)"}
            onMouseDown={e => e.currentTarget.style.transform = "scale(0.97)"} onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}>Boka tid</button>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 26, right: 28, display: "flex", gap: 8, zIndex: 3 }}>
        {t.heroImages.map((_, idx) => (
          <button key={idx} onClick={() => setI(idx)} style={{ width: i === idx ? 30 : 9, height: 9, borderRadius: 999, border: "none", background: i === idx ? "#fff" : "rgba(255,255,255,.5)", cursor: "pointer", transition: "all var(--dur-base)" }} />
        ))}
      </div>
    </section>
  );
}

function Services({ t, onBook }) {
  return (
    <section style={{ maxWidth: 1080, margin: "0 auto", padding: "112px 28px" }}>
      <Reveal><span className="sf-eyebrow">— Tjänster</span>
        <h2 className="sf-h1" style={{ color: "var(--color-fg)", marginTop: 12, maxWidth: 620 }}>Behandlingar & priser</h2></Reveal>
      <div style={{ marginTop: 48, borderTop: "1px solid var(--color-line)" }}>
        {t.services.map((s, idx) => (
          <Reveal key={s.n} delay={idx * 60}>
            <div className="sf-service-row" onClick={onBook} style={{ display: "grid", gridTemplateColumns: "64px 1fr auto", gap: 28, alignItems: "center", padding: "26px 8px", borderBottom: "1px solid var(--color-line)", cursor: "pointer", transition: "background var(--dur-fast), padding var(--dur-fast)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--color-accent-soft)"; e.currentTarget.style.paddingLeft = "20px"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.paddingLeft = "8px"; }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--color-primary)", opacity: 0.75 }}>{s.n}</span>
              <div>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--color-fg)", margin: 0, textTransform: t.theme === "zigge" ? "uppercase" : "none", letterSpacing: t.theme === "zigge" ? "0.02em" : 0 }}>{s.name}</h3>
                <p className="sf-body" style={{ margin: "5px 0 0", fontSize: 15 }}>{s.desc}</p>
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 17, color: "var(--color-fg)" }}>{s.price}</div>
                <div className="sf-body" style={{ fontSize: 13.5, marginTop: 2 }}>{s.time}</div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function About({ t }) {
  return (
    <section style={{ background: "var(--color-accent-soft)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "112px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 72, alignItems: "center" }} className="sf-about-grid">
        <Reveal><div style={{ aspectRatio: "4/5", backgroundImage: `url(${t.aboutImage})`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: "var(--sf-radius)" }} /></Reveal>
        <Reveal delay={120}>
          <span className="sf-eyebrow">— Om {t.name}</span>
          <p className="sf-italic" style={{ fontSize: "clamp(24px,3vw,38px)", color: "var(--color-fg)", margin: "18px 0 22px", lineHeight: 1.25 }}>{t.italic}</p>
          <p className="sf-body" style={{ fontSize: 17 }}>{t.aboutCopy}</p>
          <div style={{ display: "flex", gap: 44, marginTop: 38 }}>
            {t.stats.map(([n, l]) => (
              <div key={l}><div style={{ fontFamily: "var(--font-display)", fontSize: 38, color: "var(--color-primary)", lineHeight: 1 }}>{n}</div><div className="sf-body" style={{ fontSize: 13.5, marginTop: 6 }}>{l}</div></div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Team({ t }) {
  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "112px 28px" }}>
      <Reveal style={{ textAlign: "center" }}><span className="sf-eyebrow">— Våra frisörer</span>
        <h2 className="sf-h1" style={{ color: "var(--color-fg)", marginTop: 12 }}>Människorna bakom stolen</h2></Reveal>
      <div style={{ marginTop: 56, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 32 }} className="sf-team-grid">
        {t.team.map((m, idx) => (
          <Reveal key={m.name} delay={idx * 90}>
            <div style={{ textAlign: "center" }}>
              <div style={{ aspectRatio: "3/4", backgroundImage: `url(${m.img})`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: "var(--sf-radius)", filter: t.theme === "zigge" ? "grayscale(0.2)" : "none" }} />
              <h3 style={{ fontFamily: "var(--font-display)", fontSize: 23, fontWeight: 600, color: "var(--color-fg)", margin: "18px 0 4px" }}>{m.name}</h3>
              <p className="sf-body" style={{ fontSize: 14 }}>{m.role}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Gallery({ t }) {
  return (
    <section style={{ padding: "40px 28px 112px", maxWidth: 1320, margin: "0 auto" }}>
      <Reveal><span className="sf-eyebrow">— Galleri</span></Reveal>
      <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gridAutoRows: "180px", gap: 12 }} className="sf-gallery">
        {t.gallery.map((src, idx) => (
          <div key={idx} style={{ gridColumn: idx % 5 === 0 ? "span 3" : "span 2", gridRow: idx === 1 ? "span 2" : "span 1", backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: "var(--sf-radius)", transition: "transform var(--dur-base) var(--ease-out)", cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(0.985)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"} />
        ))}
      </div>
    </section>
  );
}

function LocationCTA({ t, onBook }) {
  const dark = t.theme === "zigge";
  return (
    <>
      <section style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-line)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "96px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64 }} className="sf-loc-grid">
          <Reveal>
            <span className="sf-eyebrow">— Hitta hit</span>
            <h2 className="sf-h2" style={{ color: "var(--color-fg)", marginTop: 12 }}>{t.address.split(",")[0]}</h2>
            <p className="sf-body" style={{ fontSize: 16, marginTop: 6 }}>{t.address}</p>
            <div style={{ marginTop: 28 }}>
              {t.hours.filter(h => h[0]).map(([d, h]) => (
                <div key={d} style={{ display: "flex", justifyContent: "space-between", maxWidth: 280, padding: "9px 0", borderBottom: "1px solid var(--color-line)", fontFamily: "var(--font-body)", fontSize: 15, color: "var(--color-fg)" }}>
                  <span style={{ color: "var(--color-fg-2)" }}>{d}</span><span style={{ fontWeight: 500 }}>{h}</span>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div style={{ height: 320, borderRadius: "var(--sf-radius)", overflow: "hidden", border: "1px solid var(--color-line)" }}>
              <iframe title="karta" width="100%" height="100%" style={{ border: 0, filter: dark ? "invert(0.9) hue-rotate(180deg)" : "none" }}
                src="https://www.openstreetmap.org/export/embed.html?bbox=15.61%2C58.40%2C15.64%2C58.42&layer=mapnik&marker=58.41%2C15.62" />
            </div>
          </Reveal>
        </div>
      </section>
      <section style={{ background: "var(--color-primary)", textAlign: "center", padding: "100px 28px" }}>
        <Reveal>
          <h2 className="sf-h1" style={{ color: dark ? "#14120E" : "#fff", maxWidth: 640, margin: "0 auto", textTransform: t.theme === "zigge" ? "uppercase" : "none" }}>Redo för en ny stil?</h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 17, color: dark ? "rgba(20,18,14,.8)" : "rgba(255,255,255,.9)", marginTop: 14 }}>Boka din tid på under en minut.</p>
          <button onClick={onBook} style={{ marginTop: 30, fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "var(--color-primary)", background: dark ? "#14120E" : "#fff", border: "none", padding: "16px 38px", borderRadius: "var(--radius-pill)", cursor: "pointer", letterSpacing: dark ? "0.08em" : "0.01em", textTransform: dark ? "uppercase" : "none", ...(dark ? { color: "#F2ECE2" } : {}) }}>Boka tid</button>
        </Reveal>
      </section>
    </>
  );
}

Object.assign(window, { Reveal, Hero, Services, About, Team, Gallery, LocationCTA });
