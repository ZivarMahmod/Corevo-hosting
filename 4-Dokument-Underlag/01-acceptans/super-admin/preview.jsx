/* =====================================================================
   STOREFRONT PREVIEW — the live, interactive customer site.
   Re-themes instantly · renders active modules with real per-branch
   behaviour · click hero/tagline text to edit · shown in a browser frame.
   Driven entirely by `cfg`. This is the render-bron (sajtbyggare §6.1)
   made visible: static chrome + <corevo-module> markers swapped for live
   React module sections.
   ===================================================================== */
const { useState: useStatePv, useRef: useRefPv, useEffect: useEffectPv } = React;

/* click-to-edit text. Writes back on blur. */
function Editable({ value, onChange, editMode, style, tag = "div", placeholder }) {
  const ref = useRefPv(null);
  const Tag = tag;
  return (
    <Tag
      ref={ref}
      contentEditable={editMode}
      suppressContentEditableWarning
      onBlur={e => { const t = e.currentTarget.innerText.trim(); if (t !== value) onChange(t); }}
      onClick={e => { if (editMode) e.stopPropagation(); }}
      style={{
        ...style,
        outline: "none",
        cursor: editMode ? "text" : "inherit",
        borderRadius: 4,
        boxShadow: editMode ? "0 0 0 1px rgba(245,166,35,.5)" : "none",
        background: editMode ? "rgba(245,166,35,.07)" : "transparent",
        transition: "box-shadow .15s, background .15s",
      }}
    >{value || placeholder}</Tag>
  );
}

/* gradient placeholder (no external fetch — keeps preview offline-clean) */
function PvImg({ q, theme, style, dark }) {
  const t = theme;
  const grad = dark
    ? `linear-gradient(135deg, ${t.primaryD}, ${t.fg})`
    : `linear-gradient(135deg, color-mix(in srgb, ${t.primary} 38%, ${t.bg}), color-mix(in srgb, ${t.primary} 12%, ${t.bg}))`;
  return (
    <div style={{ position: "relative", overflow: "hidden", background: grad, display: "grid", placeItems: "center", ...style }}>
      <Icon name="sun" size={26} style={{ color: dark ? "rgba(255,255,255,.28)" : `color-mix(in srgb, ${t.primary} 50%, transparent)`, opacity: .7 }} />
    </div>
  );
}

/* ---- type helpers from the theme ---- */
const heroStyle = t => ({ fontFamily: t.display, fontWeight: 600, lineHeight: t.caps ? 1.0 : 1.05, fontSize: t.caps ? 52 : 42, color: t.fg, textTransform: t.caps ? "uppercase" : "none", letterSpacing: t.caps ? ".01em" : "-0.01em", margin: 0 });
const h2Style = t => ({ fontFamily: t.display, fontWeight: 600, fontSize: t.caps ? 30 : 26, color: t.fg, textTransform: t.caps ? "uppercase" : "none", letterSpacing: t.caps ? ".02em" : 0, margin: 0 });
const ledeStyle = t => ({ fontFamily: t.body, fontSize: 15, lineHeight: 1.6, color: t.fg2, margin: 0 });
const pill = (t, primary) => ({ fontFamily: t.body, fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: t.radius >= 999 ? 999 : t.radius * 1.6, background: primary ? t.primary : "transparent", color: primary ? "#fff" : t.fg, border: primary ? "none" : `1px solid ${t.line}`, cursor: "pointer", display: "inline-block" });

/* =====================================================================
   MODULE RENDERERS — each shows the module's REAL per-branch behaviour
   ===================================================================== */
function ModBooking({ t, cfg, b }) {
  const variant = cfg.bookingVariant;
  const isRest = cfg.branch === "restaurang";
  const isTattoo = cfg.branch === "tatuering";
  const staffWord = b.staffWord;
  const svc = cfg.content.services;
  const [step, setStep] = useStatePv(0);
  const slots = ["09:00", "10:30", "13:00", "14:30", "16:00"];
  const labels = isRest
    ? ["Sällskap", "Tid", "Klart"]
    : ["Tjänst", staffWord, "Tid"];
  return (
    <div style={{ background: t.surface, borderRadius: t.radius, border: `1px solid ${t.line}`, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,.06)" }}>
      <div style={{ display: "flex", gap: 6, padding: "14px 18px", borderBottom: `1px solid ${t.line}` }}>
        {labels.map((l, i) => (
          <div key={l} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: 999, flex: "none", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, fontFamily: t.body, background: i <= step ? t.primary : "transparent", color: i <= step ? "#fff" : t.fg2, border: i <= step ? "none" : `1px solid ${t.line}` }}>{i + 1}</span>
            <span style={{ fontFamily: t.body, fontSize: 12, fontWeight: 600, color: i <= step ? t.fg : t.fg2 }}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{ padding: 18 }}>
        {step === 0 && !isRest && (
          <div style={{ display: "grid", gap: 8 }}>
            {svc.slice(0, 4).map((s, i) => (
              <button key={s} onClick={() => setStep(1)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", borderRadius: t.radius, border: `1px solid ${t.line}`, background: t.bg, cursor: "pointer", fontFamily: t.body, textAlign: "left" }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: t.fg }}>{s}</span>
                <span style={{ fontSize: 13, color: t.fg2 }}>fr. {[395, 695, 450, 250][i]} kr · {[30, 90, 45, 20][i]} min</span>
              </button>
            ))}
          </div>
        )}
        {step === 0 && isRest && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontFamily: t.body, fontSize: 13, color: t.fg2 }}>Antal personer</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[1, 2, 3, 4, 5, 6].map(n => <button key={n} onClick={() => setStep(1)} style={{ width: 46, height: 46, borderRadius: t.radius, border: `1px solid ${t.line}`, background: t.bg, cursor: "pointer", fontFamily: t.body, fontWeight: 700, fontSize: 16, color: t.fg }}>{n}</button>)}
            </div>
          </div>
        )}
        {step === 1 && !isRest && (
          <div style={{ display: "grid", gap: 8 }}>
            {(cfg.branch === "tatuering" ? ["Mia — fine line", "Sven — traditional", "Kim — blackwork"] : cfg.branch === "klinik" ? ["Dr. Holm — naprapat", "Eva — massör", "Jon — kiropraktor"] : [b.staffWord + " Maja", b.staffWord + " Johanna", "Valfri " + b.staffWord.toLowerCase()]).map(p => (
              <button key={p} onClick={() => setStep(2)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: t.radius, border: `1px solid ${t.line}`, background: t.bg, cursor: "pointer", fontFamily: t.body, textAlign: "left" }}>
                <span style={{ width: 32, height: 32, borderRadius: 999, background: t.primary, color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13, flex: "none" }}>{p[0]}</span>
                <span style={{ fontWeight: 600, fontSize: 14, color: t.fg }}>{p}</span>
              </button>
            ))}
          </div>
        )}
        {(step === 2 || (step === 1 && isRest)) && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
              {["Idag", "Imorgon", "Tor 18", "Fre 19"].map((d, i) => <span key={d} style={{ fontFamily: t.body, fontSize: 12.5, fontWeight: 600, padding: "7px 12px", borderRadius: t.radius, border: `1px solid ${i === 0 ? t.primary : t.line}`, color: i === 0 ? t.primary : t.fg2 }}>{d}</span>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {slots.map(s => <button key={s} style={{ padding: "11px 0", borderRadius: t.radius, border: `1px solid ${t.line}`, background: t.bg, cursor: "pointer", fontFamily: t.body, fontWeight: 600, fontSize: 13.5, color: t.fg }}>{s}</button>)}
            </div>
            {isTattoo && <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: t.radius, background: `color-mix(in srgb, ${t.primary} 12%, ${t.surface})`, fontFamily: t.body, fontSize: 12.5, color: t.fg }}>🔒 Deposit 500 kr krävs för att bekräfta tiden.</div>}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
          <button onClick={() => setStep(s => Math.max(0, s - 1))} style={{ ...pill(t, false), opacity: step === 0 ? 0.4 : 1 }}>Tillbaka</button>
          <button onClick={() => setStep(s => Math.min(2, s + 1))} style={pill(t, true)}>{step >= 2 || (isRest && step >= 1) ? "Bekräfta" : "Fortsätt"}</button>
        </div>
      </div>
    </div>
  );
}

function ModShop({ t, cfg }) {
  const items = cfg.content.services;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
      {items.slice(0, 3).map((s, i) => (
        <div key={s} style={{ background: t.surface, borderRadius: t.radius, border: `1px solid ${t.line}`, overflow: "hidden" }}>
          <PvImg q={cfg.branch + " " + s} theme={t} style={{ height: 110 }} />
          <div style={{ padding: 13 }}>
            <div style={{ fontFamily: t.body, fontWeight: 600, fontSize: 14, color: t.fg }}>{s}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <span style={{ fontFamily: t.body, fontSize: 14, fontWeight: 700, color: t.primary }}>{[249, 395, 179][i]} kr</span>
              <span style={pill(t, true)}>Köp</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ModOffert({ t, cfg, b }) {
  const fields = {
    florist: ["Tillfälle (bröllop/event)", "Datum", "Antal gäster", "Budget"],
    bilverkstad: ["Servicetyp", "Regnr", "Märke & modell", "Önskat datum"],
    tatuering: ["Storlek (cm)", "Placering", "Referensbild", "Beskrivning"],
    stad: ["Yta (kvm)", "Frekvens", "Typ av städning", "Adress"],
    fotograf: ["Typ av shoot", "Antal timmar", "Plats", "Datum"],
    skraddare: ["Plaggtyp", "Material", "Ändring eller nytt", "Klart senast"],
    cykel: ["Vad gäller det?", "Märke & modell", "Beskrivning", "Önskat datum"],
  }[cfg.branch] || ["Vad gäller det?", "Önskat datum", "Beskrivning", "Budget"];
  return (
    <div style={{ background: t.surface, borderRadius: t.radius, border: `1px solid ${t.line}`, padding: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {fields.map((f, i) => (
          <div key={f} style={{ gridColumn: i === 2 || i === 3 ? "auto" : "auto" }}>
            <div style={{ fontFamily: t.body, fontSize: 12, fontWeight: 600, color: t.fg2, marginBottom: 5 }}>{f}</div>
            <div style={{ height: 38, borderRadius: t.radius, border: `1px solid ${t.line}`, background: t.bg }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        <span style={{ fontFamily: t.body, fontSize: 12.5, color: t.fg2 }}>Svar inom 2 dagar</span>
        <span style={pill(t, true)}>Skicka förfrågan</span>
      </div>
    </div>
  );
}

function ModLojalitet({ t, cfg }) {
  const points = cfg.branch === "cafe" || cfg.branch === "restaurang";
  return (
    <div style={{ background: t.primary, borderRadius: t.radius, padding: 22, color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontFamily: t.display, fontWeight: 600, fontSize: 22, textTransform: t.caps ? "uppercase" : "none" }}>Bli stammis</div>
        <div style={{ fontFamily: t.body, fontSize: 13, opacity: .9, marginTop: 4 }}>{points ? "Samla poäng på varje köp — lös in mot förmåner." : "Stämpelkort: 10:e besöket bjuder vi på."}</div>
      </div>
      {points ? (
        <div style={{ textAlign: "right" }}><div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 30 }}>450 p</div><div style={{ fontFamily: t.body, fontSize: 12, opacity: .85 }}>≈ 90 kr rabatt</div></div>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>{[...Array(10)].map((_, i) => <span key={i} style={{ width: 22, height: 22, borderRadius: 999, border: "1.5px solid rgba(255,255,255,.6)", background: i < 6 ? "#fff" : "transparent" }} />)}</div>
      )}
    </div>
  );
}

function ModPresentkort({ t }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {[200, 500, 1000].map(v => (
        <div key={v} style={{ flex: 1, minWidth: 130, background: `linear-gradient(135deg, ${t.primary}, ${t.primaryD})`, borderRadius: t.radius, padding: 20, color: "#fff" }}>
          <div style={{ fontFamily: t.body, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", opacity: .8 }}>Presentkort</div>
          <div style={{ fontFamily: t.display, fontWeight: 700, fontSize: 30, margin: "6px 0 10px" }}>{v} kr</div>
          <span style={{ ...pill(t, false), color: "#fff", borderColor: "rgba(255,255,255,.5)", padding: "7px 13px", fontSize: 12 }}>Köp digitalt</span>
        </div>
      ))}
    </div>
  );
}

function ModMeny({ t, cfg }) {
  const cats = cfg.branch === "cafe" ? [["Dagens", ["Kanelbulle 35 kr", "Wienerbröd 32 kr"]], ["Tårtor", ["Prinsesstårta 320 kr", "Chokladtryffel 290 kr"]]] : [["Förrätt", ["Toast skagen 145 kr", "Råbiff 165 kr"]], ["Varmrätt", ["Högrev 285 kr", "Fisk dagens 245 kr"]]];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
      {cats.map(([cat, items]) => (
        <div key={cat}>
          <div style={{ fontFamily: t.display, fontWeight: 600, fontSize: 18, color: t.fg, textTransform: t.caps ? "uppercase" : "none", borderBottom: `1px solid ${t.line}`, paddingBottom: 8, marginBottom: 10 }}>{cat}</div>
          {items.map(it => <div key={it} style={{ fontFamily: t.body, fontSize: 13.5, color: t.fg2, padding: "5px 0" }}>{it}</div>)}
        </div>
      ))}
    </div>
  );
}

function ModPortfolio({ t, cfg }) {
  return (
    <div>
      {(cfg.branch === "tatuering" || cfg.branch === "fotograf") && (
        <div style={{ display: "flex", gap: 7, marginBottom: 12, flexWrap: "wrap" }}>
          {(cfg.branch === "tatuering" ? ["Alla", "Fine line", "Traditional", "Blackwork"] : ["Alla", "Porträtt", "Bröllop", "Produkt"]).map((f, i) => <span key={f} style={{ fontFamily: t.body, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, border: `1px solid ${i === 0 ? t.primary : t.line}`, color: i === 0 ? t.primary : t.fg2 }}>{f}</span>)}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {[...Array(8)].map((_, i) => <PvImg key={i} q={cfg.branch + " work " + i} theme={t} style={{ aspectRatio: "1", borderRadius: t.radius }} />)}
      </div>
    </div>
  );
}

function ModBlogg({ t, cfg }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
      {["Nyheter & tips", "Bakom kulisserna", "Säsongens favoriter"].map((title, i) => (
        <div key={title} style={{ background: t.surface, borderRadius: t.radius, border: `1px solid ${t.line}`, overflow: "hidden" }}>
          <PvImg q={cfg.branch + " blog " + i} theme={t} style={{ height: 90 }} />
          <div style={{ padding: 13 }}>
            <div style={{ fontFamily: t.body, fontSize: 11, color: t.primary, fontWeight: 600 }}>Artikel</div>
            <div style={{ fontFamily: t.display, fontSize: 16, color: t.fg, marginTop: 4 }}>{title}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- account / portal module renderers (defaultPos: "konto") ---- */
function ModHusdjur({ t }) {
  return (
    <div style={{ background: t.surface, borderRadius: t.radius, border: `1px solid ${t.line}`, padding: 18, display: "flex", gap: 16, alignItems: "center" }}>
      <div style={{ width: 54, height: 54, flex: "none", borderRadius: 999, background: `linear-gradient(135deg, ${t.primary}, ${t.primaryD})`, display: "grid", placeItems: "center", color: "#fff" }}><Icon name="heart" size={22} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: t.display, fontWeight: 600, fontSize: 18, color: t.fg }}>Bella</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 6, fontFamily: t.body, fontSize: 12.5, color: t.fg2 }}>
          <span><b style={{ color: t.fg }}>Ras:</b> Golden retriever</span>
          <span><b style={{ color: t.fg }}>Vikt:</b> 28 kg</span>
          <span><b style={{ color: t.fg }}>Allergier:</b> Kyckling</span>
        </div>
      </div>
      <span style={pill(t, false)}>Redigera</span>
    </div>
  );
}
function ModFordon({ t }) {
  return (
    <div style={{ background: t.surface, borderRadius: t.radius, border: `1px solid ${t.line}`, padding: 18, display: "flex", gap: 16, alignItems: "center" }}>
      <div style={{ width: 54, height: 54, flex: "none", borderRadius: t.radius, background: `linear-gradient(135deg, ${t.primary}, ${t.primaryD})`, display: "grid", placeItems: "center", color: "#fff" }}><Icon name="settings" size={22} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="num" style={{ fontFamily: t.display, fontWeight: 600, fontSize: 18, color: t.fg, letterSpacing: ".04em" }}>ABC 123</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 6, fontFamily: t.body, fontSize: 12.5, color: t.fg2 }}>
          <span><b style={{ color: t.fg }}>Märke:</b> Volvo</span>
          <span><b style={{ color: t.fg }}>Modell:</b> V60</span>
          <span><b style={{ color: t.fg }}>År:</b> 2019</span>
        </div>
      </div>
      <span style={pill(t, false)}>Redigera</span>
    </div>
  );
}
function ModIntag({ t }) {
  const rows = [["Personuppgifter", "Ifyllt"], ["Symtom & anamnes", "Ifyllt"], ["GDPR-samtycke", "Godkänt"]];
  return (
    <div style={{ background: t.surface, borderRadius: t.radius, border: `1px solid ${t.line}`, padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Icon name="shield" size={15} style={{ color: t.primary }} />
        <span style={{ fontFamily: t.body, fontSize: 12.5, color: t.fg2 }}>Krypterat · endast din behandlare ser detta</span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {rows.map(([l, s]) => (
          <div key={l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: t.radius, background: t.bg }}>
            <span style={{ fontFamily: t.body, fontSize: 13.5, color: t.fg }}>{l}</span>
            <span style={{ fontFamily: t.body, fontSize: 12, fontWeight: 600, color: t.primary }}>{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function ModOrderstatus({ t }) {
  const steps = ["Mottagen", "Under arbete", "Klar för hämtning"];
  const at = 1;
  return (
    <div style={{ background: t.surface, borderRadius: t.radius, border: `1px solid ${t.line}`, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        {steps.map((s, i) => (
          <React.Fragment key={s}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, flex: "none", width: 90 }}>
              <span style={{ width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", background: i <= at ? t.primary : t.bg, color: i <= at ? "#fff" : t.fg2, border: i <= at ? "none" : `1px solid ${t.line}`, fontFamily: t.body, fontWeight: 700, fontSize: 13 }}>{i < at ? <Icon name="check" size={14} /> : i + 1}</span>
              <span style={{ fontFamily: t.body, fontSize: 11.5, fontWeight: i === at ? 700 : 500, color: i <= at ? t.fg : t.fg2, textAlign: "center" }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i < at ? t.primary : t.line, marginTop: 14 }} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ---- recurring booking ---- */
function ModRecurring({ t, cfg }) {
  const freqs = cfg.branch === "stad" ? ["Varje vecka", "Varannan vecka", "Varje månad"] : ["Varje vecka", "Varannan vecka", "Varje månad"];
  const sel = 1;
  return (
    <div style={{ background: t.surface, borderRadius: t.radius, border: `1px solid ${t.line}`, padding: 20 }}>
      <div style={{ fontFamily: t.body, fontSize: 12, fontWeight: 600, color: t.fg2, marginBottom: 8 }}>Hur ofta?</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
        {freqs.map((f, i) => <span key={f} style={{ fontFamily: t.body, fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: t.radius, border: `1px solid ${i === sel ? t.primary : t.line}`, color: i === sel ? t.primary : t.fg2, background: i === sel ? `color-mix(in srgb, ${t.primary} 8%, transparent)` : "transparent" }}>{f}</span>)}
      </div>
      <div style={{ fontFamily: t.body, fontSize: 12, fontWeight: 600, color: t.fg2, marginBottom: 8 }}>Kommande tider</div>
      <div style={{ display: "grid", gap: 6 }}>
        {["Tor 18 jun · 10:00", "Tor 2 jul · 10:00", "Tor 16 jul · 10:00"].map((d, i) => (
          <div key={d} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 13px", borderRadius: t.radius, background: t.bg, fontFamily: t.body, fontSize: 13.5, color: t.fg }}>
            <span className="num">{d}</span>
            <span style={{ fontSize: 12, color: i === 0 ? t.primary : t.fg2, fontWeight: i === 0 ? 700 : 500 }}>{i === 0 ? "Nästa" : "Planerad"}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, fontFamily: t.body, fontSize: 12, color: t.fg2 }}>Avboka enkelt med 48h varsel.</div>
    </div>
  );
}

/* ---- deposit gate ---- */
function ModDeposit({ t, cfg }) {
  const pct = cfg.branch === "tatuering";
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 210px", background: t.surface, borderRadius: t.radius, border: `1px solid ${t.line}`, padding: 20 }}>
        <div style={{ fontFamily: t.body, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: t.primary, fontWeight: 700 }}>Deposit krävs</div>
        <div className="num" style={{ fontFamily: t.display, fontWeight: 700, fontSize: 34, color: t.fg, margin: "8px 0 2px" }}>{pct ? "30 %" : "500 kr"}</div>
        <div style={{ fontFamily: t.body, fontSize: 13, color: t.fg2 }}>{pct ? "av offertens belopp · dras av vid besök" : "betalas vid bokning · dras av vid besök"}</div>
      </div>
      <div style={{ flex: "1 1 210px", background: `color-mix(in srgb, ${t.primary} 7%, ${t.surface})`, borderRadius: t.radius, border: `1px solid ${t.line}`, padding: 20, display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
        {["Tiden bekräftas först när deposit är betald", "Avbokning > 48h: full återbetalning", "No-show: deposit behålls"].map(r => (
          <div key={r} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontFamily: t.body, fontSize: 12.5, color: t.fg }}><Icon name="check" size={14} style={{ color: t.primary, marginTop: 2, flex: "none" }} />{r}</div>
        ))}
      </div>
    </div>
  );
}

/* ---- drop-in / consignment ---- */
function ModInlamning({ t, cfg }) {
  const fields = {
    cykel: ["Märke & modell", "Färg", "Vad ska göras?", "Önskat färdigdatum"],
    skraddare: ["Plagg", "Vad ska göras?", "Mått / önskemål", "Klart senast"],
    secondhand: ["Vad lämnar du in?", "Skick", "Önskat pris", "Kontakt"],
  }[cfg.branch] || ["Beskriv varan", "Vad ska göras?", "Önskat datum", "Kontakt"];
  return (
    <div style={{ background: t.surface, borderRadius: t.radius, border: `1px solid ${t.line}`, padding: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {fields.map(f => (
          <div key={f}><div style={{ fontFamily: t.body, fontSize: 12, fontWeight: 600, color: t.fg2, marginBottom: 5 }}>{f}</div><div style={{ height: 38, borderRadius: t.radius, border: `1px solid ${t.line}`, background: t.bg }} /></div>
        ))}
        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ fontFamily: t.body, fontSize: 12, fontWeight: 600, color: t.fg2, marginBottom: 5 }}>Bild (valfritt)</div>
          <div style={{ height: 58, borderRadius: t.radius, border: `1.5px dashed ${t.line}`, background: t.bg, display: "grid", placeItems: "center", color: t.fg2 }}><Icon name="upload" size={18} /></div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
        <span style={{ fontFamily: t.body, fontSize: 12.5, color: t.fg2 }}>Du får ett kvittonummer när vi tagit emot</span>
        <span style={pill(t, true)}>{cfg.branch === "secondhand" ? "Skicka in" : "Lämna in"}</span>
      </div>
    </div>
  );
}

/* dispatch a module to its storefront renderer */
function moduleBody(mod, t, cfg, b) {
  switch (mod) {
    case "booking": return <ModBooking t={t} cfg={cfg} b={b} />;
    case "shop": return <ModShop t={t} cfg={cfg} />;
    case "offert": return <ModOffert t={t} cfg={cfg} b={b} />;
    case "lojalitet": return <ModLojalitet t={t} cfg={cfg} />;
    case "presentkort": return <ModPresentkort t={t} />;
    case "meny": return <ModMeny t={t} cfg={cfg} />;
    case "portfolio": return <ModPortfolio t={t} cfg={cfg} />;
    case "blogg": return <ModBlogg t={t} cfg={cfg} />;
    case "husdjur": return <ModHusdjur t={t} />;
    case "fordon": return <ModFordon t={t} />;
    case "intag": return <ModIntag t={t} />;
    case "orderstatus": return <ModOrderstatus t={t} />;
    case "recurring": return <ModRecurring t={t} cfg={cfg} />;
    case "deposit": return <ModDeposit t={t} cfg={cfg} />;
    case "inlamning": return <ModInlamning t={t} cfg={cfg} />;
    default: {
      const M = window.CFG.MODULES[mod];
      return (
        <div style={{ background: t.surface, borderRadius: t.radius, border: `1px dashed ${t.line}`, padding: 22, fontFamily: t.body, color: t.fg2, fontSize: 13.5 }}>
          <b style={{ color: t.fg }}>{M.name}</b> — {M.short} {M.variants[cfg.branch] ? <span style={{ display: "block", marginTop: 6, color: t.fg }}>↳ {M.variants[cfg.branch]}</span> : null}
        </div>
      );
    }
  }
}

const SECTION_TITLES = {
  shop: "Webshop", offert: "Begär offert", lojalitet: "Stammis", presentkort: "Presentkort",
  meny: "Meny", portfolio: "Portfolio", blogg: "Journal", booking: "Boka tid",
  husdjur: "Husdjursprofil", fordon: "Ditt fordon", intag: "Hälsoformulär", recurring: "Återkommande",
  orderstatus: "Orderstatus", deposit: "Deposit", inlamning: "Lämna in",
};

function ModuleSection({ mod, t, cfg, b, specOn, idx }) {
  const M = window.CFG.MODULES[mod];
  if (!M || M.infra) return null;
  const body = moduleBody(mod, t, cfg, b);
  const variantNote = M.variants[cfg.branch];
  return (
    <section data-mod={mod} style={{ position: "relative", scrollMarginTop: 20 }}>
      <SpecNote on={specOn} n={idx} place="tr" title={`Modul: ${M.name}`}
        body={`${M.short}${variantNote ? "  ·  " + b.name + ": " + variantNote : ""}  ·  ${M.why}`}
        tables={M.tables} build={M.build} />
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={h2Style(t)}>{SECTION_TITLES[mod] || M.name}</h2>
        <span style={{ fontFamily: t.body, fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase", color: t.primary, fontWeight: 600 }}>{b.eyebrow}</span>
      </div>
      {body}
    </section>
  );
}

/* =====================================================================
   THE STOREFRONT
   ===================================================================== */
function Storefront({ cfg, setContent, editMode, specOn }) {
  const t = { ...window.CFG.ST_THEMES[cfg.theme] };
  // apply live branding override (accent)
  if (cfg.branding.accent) { t.primary = cfg.branding.accent; }
  const b = window.CFG.BRANCHES[cfg.branch] || { name: "Företag", icon: "building", staffWord: "Personal", serviceWord: "Tjänst", eyebrow: "Välj bransch", hero: cfg.content.hero, tagline: cfg.content.tagline };
  const mainMods = cfg.placement.main.filter(m => cfg.modules[m] && cfg.modules[m] !== "off");
  const navMods = mainMods.filter(m => !window.CFG.MODULES[m].infra);
  const kontoMods = (cfg.placement.konto || []).filter(m => cfg.modules[m] && cfg.modules[m] !== "off" && !window.CFG.MODULES[m].infra);

  return (
    <div style={{ background: t.bg, color: t.fg, fontFamily: t.body, minHeight: "100%" }}>
      {/* header */}
      <header style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 32px", borderBottom: `1px solid ${t.line}` }}>
        <SpecNote on={specOn} n="H" place="bl" title="Header — mallens chrome"
          body="Statisk del av temat (render-bron). Logotyp + nav byggs av aktiva moduler. 'Boka tid' alltid synlig om booking-modulen är live."
          tables={["tenant_settings.branding", "tenant_modules"]} build="Header kommer från det valda temat (Salvia/Leander/…). Nav-länkar genereras från tenant_modules där state≠off. Logotyp = branding.logo_url eller salongsnamnet." />
        <Editable tag="span" editMode={editMode} value={cfg.name || "Ditt företag"} onChange={v => setContent("name", v)}
          style={{ fontFamily: t.display, fontSize: t.caps ? 22 : 19, fontWeight: 600, color: t.fg, textTransform: t.caps ? "uppercase" : "none", letterSpacing: t.caps ? ".04em" : 0 }} />
        <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {navMods.slice(0, 4).map(m => <span key={m} style={{ fontFamily: t.body, fontSize: 13, fontWeight: 500, color: t.fg2 }}>{SECTION_TITLES[m] || window.CFG.MODULES[m].name}</span>)}
          {kontoMods.length > 0 && <span style={{ fontFamily: t.body, fontSize: 13, fontWeight: 500, color: t.fg2, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="user" size={13} />Mitt konto</span>}
          {cfg.modules.booking && cfg.modules.booking !== "off" && <span style={pill(t, true)}>Boka tid</span>}
        </nav>
      </header>

      {/* hero */}
      <section style={{ position: "relative", display: "grid", gridTemplateColumns: "1.15fr 1fr", minHeight: 380 }}>
        <SpecNote on={specOn} n="1" place="tl" title="Hjälte — redigerbar text"
          body="Mallens hero-sektion. Rubrik + ingress är klickbara fält (det du ser nu: klicka → skriv). Sparas till tenantens layout, ej hårdkodat."
          tables={["tenant_site_pages (draft/publicerad)", "tenant_settings.branding"]} build="Hero-text lagras i tenant-layouten (HTML/JSON per sida). I sajtbyggaren editeras den via contentEditable → sparas som draft → publiceras. Bilden från media_assets (R2)." />
        <div style={{ padding: "48px 40px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 18 }}>
          <span style={{ fontFamily: t.body, fontSize: 11.5, letterSpacing: ".16em", textTransform: "uppercase", color: t.primary, fontWeight: 600 }}>— {b.eyebrow}</span>
          <Editable tag="h1" editMode={editMode} value={cfg.content.hero} onChange={v => setContent("hero", v)} style={heroStyle(t)} placeholder="Din rubrik" />
          <Editable tag="p" editMode={editMode} value={cfg.content.tagline} onChange={v => setContent("tagline", v)} style={{ ...ledeStyle(t), maxWidth: 380 }} placeholder="Din ingress" />
          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
            {cfg.modules.booking && cfg.modules.booking !== "off" && <span style={pill(t, true)}>Boka tid</span>}
            <span style={pill(t, false)}>{cfg.modules.shop && cfg.modules.shop !== "off" ? "Till butiken" : "Om oss"}</span>
          </div>
        </div>
        <PvImg q={b.name + " interior"} theme={t} dark={cfg.theme === "Zigge"} style={{ minHeight: 380 }} />
      </section>

      {/* modules */}
      <div style={{ padding: "44px 40px", display: "grid", gap: 44 }}>
        {mainMods.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, fontFamily: t.body, color: t.fg2 }}>Inga moduler aktiva ännu — slå på dem i steget "Välj moduler".</div>
        )}
        {mainMods.map((m, i) => <ModuleSection key={m} mod={m} t={t} cfg={cfg} b={b} specOn={specOn} idx={i + 2} />)}
      </div>

      {/* mitt konto — customer portal (modules with defaultPos "konto") */}
      {kontoMods.length > 0 && (
        <section style={{ position: "relative", padding: "4px 40px 44px" }}>
          <div style={{ position: "relative", background: `color-mix(in srgb, ${t.primary} 6%, ${t.bg})`, border: `1px solid ${t.line}`, borderRadius: t.radius >= 999 ? 24 : Math.max(t.radius * 1.4, 10), padding: "26px 28px 30px" }}>
            <SpecNote on={specOn} n="K" place="tr" title="Mitt konto — kundportal (inloggad)"
              body="Dessa moduler ligger INTE på den publika sidan — de visas i kundens inloggade portal. Ägaren hanterar samma data i sin egen admin."
              tables={["customers", "customer_profiles"]} build="Renderas bakom inloggning (kundens session). Moduler med modules.default_section_position = 'konto' (husdjur, fordon, intag, orderstatus) vävs in här, inte i public main." />
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 20 }}>
              <span style={{ width: 36, height: 36, flex: "none", borderRadius: 999, background: t.primary, color: "#fff", display: "grid", placeItems: "center" }}><Icon name="user" size={18} /></span>
              <div>
                <div style={{ fontFamily: t.display, fontWeight: 600, fontSize: t.caps ? 22 : 20, color: t.fg, textTransform: t.caps ? "uppercase" : "none" }}>Mitt konto</div>
                <div style={{ fontFamily: t.body, fontSize: 12.5, color: t.fg2 }}>Inloggad som kund · bara du ser detta</div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 20 }}>
              {kontoMods.map(m => {
                const Mk = window.CFG.MODULES[m];
                return (
                  <div key={m}>
                    <h3 style={{ ...h2Style(t), fontSize: t.caps ? 20 : 17, marginBottom: 10 }}>{SECTION_TITLES[m] || Mk.name}</h3>
                    {moduleBody(m, t, cfg, b)}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* footer */}
      <footer style={{ background: t.caps ? t.surface : `color-mix(in srgb, ${t.primary} 8%, ${t.bg})`, borderTop: `1px solid ${t.line}`, padding: "32px 40px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
        <div>
          <div style={{ fontFamily: t.display, fontSize: 18, color: t.fg, textTransform: t.caps ? "uppercase" : "none" }}>{cfg.name || "Ditt företag"}</div>
          <div style={{ fontFamily: t.body, fontSize: 13, color: t.fg2, marginTop: 6 }}>{cfg.slug || "dinsalong"}.corevo.se</div>
        </div>
        <div style={{ fontFamily: t.body, fontSize: 13, color: t.fg2, lineHeight: 1.8 }}>
          <div>Mån–Fre 09–18 · Lör 10–15</div>
          <div>Drottninggatan 12, Linköping</div>
        </div>
      </footer>
    </div>
  );
}

/* browser-frame wrapper so it's unmistakably "the customer's public site" */
function BrowserFrame({ url, children, live, device, onDevice }) {
  return (
    <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid var(--c-line)", boxShadow: "var(--shadow-lg)", background: "#fff", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#EDEAE3", borderBottom: "1px solid var(--c-line)", flex: "none" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#E0726A" }} />
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#E6B34D" }} />
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#7FB47F" }} />
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--c-ink-2)", fontFamily: "var(--font-ui)", background: "#fff", padding: "5px 14px", borderRadius: 999, border: "1px solid var(--c-line)" }}>
            <Icon name={live ? "globe" : "lock"} size={12} style={{ color: live ? "var(--c-success)" : "var(--c-ink-3)" }} />
            {url}
            {live && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--c-success)", background: "var(--c-success-bg)", padding: "1px 6px", borderRadius: 999 }}>LIVE</span>}
          </div>
        </div>
        {onDevice && (
          <div style={{ display: "flex", gap: 2, background: "rgba(0,0,0,.06)", padding: 2, borderRadius: 8 }}>
            {[["desktop", "grid"], ["mobile", "phone"]].map(([k, ic]) => (
              <button key={k} onClick={() => onDevice(k)} style={{ width: 28, height: 24, borderRadius: 6, border: "none", cursor: "pointer", background: device === k ? "#fff" : "transparent", color: device === k ? "var(--c-forest)" : "var(--c-ink-3)", display: "grid", placeItems: "center" }}><Icon name={ic === "phone" ? "creditCard" : ic} size={13} /></button>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", display: "flex", justifyContent: "center", background: device === "mobile" ? "#3A3733" : "transparent" }}>
        <div style={{ width: device === "mobile" ? 390 : "100%", flex: "none", minHeight: "100%", boxShadow: device === "mobile" ? "0 0 40px rgba(0,0,0,.3)" : "none" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Storefront, BrowserFrame, Editable });
