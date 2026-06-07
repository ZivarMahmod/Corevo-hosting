/* The 4 booking presentation variants — all embedded, mobile-first.
   Each is interactive (manages its own step/selection state). */
const { useState: useStateV } = React;

/* ─── VARIANT 1 · INLINE-SEKTION ─────────────────────────────────
   Booking scrolls into the page; every step stacked; one sweep.
   Sticky summary bar at the bottom (thumb reach). */
function VInline() {
  const b = window.BK;
  const [sel, setSel] = useStateV({ service: 0, staff: 0, day: 0, slot: "14:30", name: "", phone: "" });
  const ready = sel.slot && sel.name && sel.phone;
  return (
    <>
      <SalonBar />
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 18px 20px" }}>
        <h2 style={{ fontFamily: b.serif, fontSize: 30, color: b.ink, margin: "2px 0 16px" }}>Boka tid</h2>
        <SectionLabel n="1">Välj tjänst</SectionLabel>
        <ServiceList sel={sel.service} set={i => setSel(s => ({ ...s, service: i }))} />
        <div style={{ height: 26 }} />
        <SectionLabel n="2">Välj frisör</SectionLabel>
        <StaffRow sel={sel.staff} set={i => setSel(s => ({ ...s, staff: i }))} />
        <div style={{ height: 26 }} />
        <SectionLabel n="3">Välj dag & tid</SectionLabel>
        <DayRow sel={sel.day} set={i => setSel(s => ({ ...s, day: i, slot: null }))} />
        <div style={{ height: 12 }} />
        <SlotGrid sel={sel.slot} set={t => setSel(s => ({ ...s, slot: t }))} />
        <div style={{ height: 26 }} />
        <SectionLabel n="4">Dina uppgifter</SectionLabel>
        {fld("Namn", "Förnamn Efternamn", sel.name, v => setSel(s => ({ ...s, name: v })))}
        {fld("Telefon", "07X XXX XX XX", sel.phone, v => setSel(s => ({ ...s, phone: v })))}
      </div>
      <BottomBar label={ready ? "Boka tid" : "Fyll i för att boka"} sub={ready ? `${b.services[sel.service].name} · ${b.days[sel.day][0]} ${sel.slot}` : null} disabled={!ready} onClick={() => {}} />
    </>
  );
}

/* ─── VARIANT 2 · DRAWER / OVERLAY ───────────────────────────────
   Bottom sheet slides up; the salon page stays visible behind it. */
function VDrawer() {
  const b = window.BK;
  const [sel, setSel] = useStateV({ service: 0, staff: 0, day: 0, slot: "14:30" });
  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      {/* page behind */}
      <div style={{ position: "absolute", inset: 0 }}>
        <div style={{ height: 200, backgroundImage: `url(${window.PHOTO ? window.PHOTO.hero1 : 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&q=80'})`, backgroundSize: "cover", backgroundPosition: "center" }} />
        <div style={{ padding: 18 }}><div style={{ fontFamily: b.serif, fontSize: 26, color: b.ink }}>{b.salon}</div><div style={{ fontFamily: b.font, fontSize: 13, color: b.ink2, marginTop: 4 }}>Frisör & barberare · Linköping</div></div>
      </div>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.34)" }} />
      {/* sheet */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 92, background: b.bg, borderRadius: "24px 24px 0 0", boxShadow: "0 -16px 40px rgba(0,0,0,.2)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "10px 0 6px", display: "grid", placeItems: "center" }}><span style={{ width: 40, height: 4, borderRadius: 999, background: b.line }} /></div>
        <div style={{ padding: "4px 18px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: b.serif, fontSize: 22, color: b.ink, whiteSpace: "nowrap" }}>Boka tid</span>
          <Icon name="x" size={22} style={{ color: b.ink2 }} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          <SectionLabel n="1">Tjänst</SectionLabel>
          <ServiceList sel={sel.service} set={i => setSel(s => ({ ...s, service: i }))} />
          <div style={{ height: 22 }} />
          <SectionLabel n="2">Dag & tid</SectionLabel>
          <DayRow sel={sel.day} set={i => setSel(s => ({ ...s, day: i, slot: null }))} />
          <div style={{ height: 10 }} />
          <SlotGrid sel={sel.slot} set={t => setSel(s => ({ ...s, slot: t }))} />
        </div>
        <BottomBar label="Fortsätt" sub={`${b.services[sel.service].name} · ${b.days[sel.day][0]} ${sel.slot || "—"}`} disabled={!sel.slot} onClick={() => {}} />
      </div>
    </div>
  );
}

/* ─── VARIANT 3 · STEG-FÖR-STEG WIZARD ───────────────────────────
   One decision per screen. Big touch targets. Max hand-holding. */
function VWizard() {
  const b = window.BK;
  const [step, setStep] = useStateV(0);
  const [sel, setSel] = useStateV({ service: null, staff: null, day: 0, slot: null, name: "", phone: "" });
  const steps = ["Tjänst", "Frisör", "Tid", "Uppgifter", "Klart"];
  const can = [sel.service !== null, sel.staff !== null, sel.slot, sel.name && sel.phone, true][step];
  const titles = ["Vad vill du boka?", "Hos vem?", "När passar det?", "Dina uppgifter", ""];
  return (
    <>
      <div style={{ flex: "none", padding: "14px 18px 12px", background: b.surface, borderBottom: `1px solid ${b.line}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: b.serif, fontSize: 20, color: b.ink }}>{b.salon}</span>
          <span style={{ fontFamily: b.font, fontSize: 12.5, color: b.ink2 }}>{Math.min(step + 1, 5)} / 5</span>
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 12 }}>
          {steps.map((_, i) => <span key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: i <= step ? b.accent : b.line, transition: "background .3s" }} />)}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "26px 20px" }}>
        {step < 4 && <h2 style={{ fontFamily: b.serif, fontSize: 32, color: b.ink, margin: "0 0 22px", lineHeight: 1.1 }}>{titles[step]}</h2>}
        {step === 0 && <ServiceList sel={sel.service} set={i => setSel(s => ({ ...s, service: i }))} big />}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {b.staff.map((m, i) => {
              const on = sel.staff === i;
              return (
                <button key={i} onClick={() => setSel(s => ({ ...s, staff: i }))} style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 16px", borderRadius: 16, border: `1.5px solid ${on ? b.accent : b.line}`, background: on ? b.soft : b.surface, cursor: "pointer", minHeight: 64 }}>
                  <span style={{ width: 50, height: 50, borderRadius: 999, background: m.any ? b.soft : b.accent, color: m.any ? b.accent : "#fff", display: "grid", placeItems: "center", fontFamily: b.serif, fontWeight: 600, fontSize: 20, border: m.any ? `1.5px solid ${b.accent}` : "none" }}>{m.any ? "✦" : m.name[0]}</span>
                  <span style={{ textAlign: "left" }}><span style={{ display: "block", fontFamily: b.font, fontWeight: 600, fontSize: 16.5, color: b.ink }}>{m.name}</span><span style={{ fontFamily: b.font, fontSize: 13.5, color: b.ink2 }}>{m.role}</span></span>
                </button>
              );
            })}
          </div>
        )}
        {step === 2 && (<><DayRow sel={sel.day} set={i => setSel(s => ({ ...s, day: i, slot: null }))} /><div style={{ height: 18 }} /><SlotGrid sel={sel.slot} set={t => setSel(s => ({ ...s, slot: t }))} /></>)}
        {step === 3 && (<>{fld("Namn", "Förnamn Efternamn", sel.name, v => setSel(s => ({ ...s, name: v })))}{fld("Telefon", "07X XXX XX XX", sel.phone, v => setSel(s => ({ ...s, phone: v })))}<p style={{ fontFamily: b.font, fontSize: 12.5, color: b.ink2, marginTop: 6 }}>Bekräftelse via sms. Avboka fritt fram till 24 h innan.</p></>)}
        {step === 4 && <Confirmation sel={sel} />}
      </div>
      {step < 4
        ? <BottomBar label={step === 3 ? "Bekräfta bokning" : "Fortsätt"} disabled={!can} onClick={() => setStep(s => s + 1)} onBack={step > 0 ? () => setStep(s => s - 1) : null} />
        : <BottomBar label="Klar" onClick={() => setStep(0)} />}
    </>
  );
}

/* ─── VARIANT 4 · KOMPAKT EN-SIDA ────────────────────────────────
   Everything visible at once. Fast for repeat customers. */
function VCompact() {
  const b = window.BK;
  const [sel, setSel] = useStateV({ service: 0, staff: 0, day: 0, slot: "14:30", name: "", phone: "" });
  const chip = (on) => ({ flex: "none", padding: "10px 15px", borderRadius: 999, border: `1.5px solid ${on ? b.accent : b.line}`, background: on ? b.accent : b.surface, color: on ? "#fff" : b.ink, fontFamily: b.font, fontWeight: 600, fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" });
  return (
    <>
      <SalonBar compact />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 18px" }}>
        <h2 style={{ fontFamily: b.serif, fontSize: 26, color: b.ink, margin: "0 0 4px" }}>Snabbboka</h2>
        <p style={{ fontFamily: b.font, fontSize: 12.5, color: b.ink2, margin: "0 0 16px" }}>Allt på en skärm — för dig som vet vad du vill.</p>
        <div style={{ fontFamily: b.font, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: b.ink2, marginBottom: 8 }}>Tjänst</div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>{b.services.map((s, i) => <button key={i} onClick={() => setSel(p => ({ ...p, service: i }))} style={chip(sel.service === i)}>{s.name}</button>)}</div>
        <div style={{ fontFamily: b.font, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: b.ink2, marginBottom: 8 }}>Frisör</div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>{b.staff.map((s, i) => <button key={i} onClick={() => setSel(p => ({ ...p, staff: i }))} style={chip(sel.staff === i)}>{s.name}</button>)}</div>
        <div style={{ fontFamily: b.font, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: b.ink2, marginBottom: 8 }}>Dag</div>
        <div style={{ marginBottom: 16 }}><DayRow sel={sel.day} set={i => setSel(p => ({ ...p, day: i }))} /></div>
        <div style={{ fontFamily: b.font, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: b.ink2, marginBottom: 8 }}>Tid</div>
        <div style={{ marginBottom: 16 }}><SlotGrid sel={sel.slot} set={t => setSel(p => ({ ...p, slot: t }))} cols={4} /></div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>{fld("Namn", "Namn", sel.name, v => setSel(p => ({ ...p, name: v })))}</div>
          <div style={{ flex: 1 }}>{fld("Telefon", "Telefon", sel.phone, v => setSel(p => ({ ...p, phone: v })))}</div>
        </div>
      </div>
      <BottomBar label="Boka tid" sub={`${b.services[sel.service].name} · ${b.staff[sel.staff].name} · ${b.days[sel.day][0]} ${sel.slot}`} onClick={() => {}} />
    </>
  );
}

Object.assign(window, { VInline, VDrawer, VWizard, VCompact });
