/* Desktop renderings — each variant shown embedded in the salon page at
   desktop scale, in its natural placement (inline column / right drawer /
   centered card / wide panel). The salon backdrop proves "embedded, same brand". */

function DeskBackdrop({ dim, children }) {
  const b = window.BK;
  const hero = "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1400&q=80&auto=format&fit=crop";
  return (
    <div style={{ position: "absolute", inset: 0, background: b.bg, overflow: "hidden" }}>
      {/* page nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 36px", background: b.surface, borderBottom: `1px solid ${b.line}` }}>
        <span style={{ fontFamily: b.serif, fontSize: 26, fontWeight: 600, color: b.ink }}>{b.salon}</span>
        <div style={{ display: "flex", gap: 28, alignItems: "center", fontFamily: b.font, fontSize: 14, color: b.ink2 }}>
          {["Behandlingar", "Om oss", "Frisörer", "Kontakt"].map(l => <span key={l}>{l}</span>)}
          <span style={{ background: b.accent, color: "#fff", padding: "9px 20px", borderRadius: 999, fontSize: 13.5, fontWeight: 600 }}>Boka tid</span>
        </div>
      </div>
      {/* hero strip */}
      <div style={{ height: 230, backgroundImage: `url(${hero})`, backgroundSize: "cover", backgroundPosition: "center", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.5))" }} />
        <div style={{ position: "relative", padding: "54px 36px" }}>
          <div style={{ fontFamily: b.font, fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>Frisör & barberare · Linköping</div>
          <div style={{ fontFamily: b.serif, fontSize: 46, color: "#fff", marginTop: 8 }}>Boka din tid</div>
        </div>
      </div>
      {dim && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.34)" }} />}
      {children}
    </div>
  );
}

/* a desktop "module panel" wrapper — gives the variant a fixed size + card look */
function Module({ w, h, children, style = {} }) {
  const b = window.BK;
  return (
    <div style={{ width: w, height: h, background: b.bg, borderRadius: 16, overflow: "hidden", border: `1px solid ${b.line}`, boxShadow: "0 24px 60px rgba(0,0,0,.16)", display: "flex", flexDirection: "column", ...style }}>{children}</div>
  );
}

function DeskInline() {
  // booking sits inline in the page flow, centered column
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <DeskBackdrop />
      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 360, width: 620 }}>
        <Module w="100%" h={640} style={{ boxShadow: "0 24px 60px rgba(0,0,0,.10)" }}><VInline /></Module>
      </div>
    </div>
  );
}

function DeskDrawer() {
  const b = window.BK;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <DeskBackdrop dim />
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 460, background: b.bg, boxShadow: "-24px 0 60px rgba(0,0,0,.25)", display: "flex", flexDirection: "column" }}>
        <VInline />
      </div>
    </div>
  );
}

function DeskWizard() {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <DeskBackdrop dim />
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
        <Module w={560} h={620}><VWizard /></Module>
      </div>
    </div>
  );
}

function DeskCompact() {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <DeskBackdrop />
      <div style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: 330, width: 760 }}>
        <Module w="100%" h={620} style={{ boxShadow: "0 24px 60px rgba(0,0,0,.10)" }}><VCompact /></Module>
      </div>
    </div>
  );
}

Object.assign(window, { DeskInline, DeskDrawer, DeskWizard, DeskCompact });
