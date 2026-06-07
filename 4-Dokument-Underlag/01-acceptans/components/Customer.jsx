/* Kundens sida (NY — M4-portal, ej byggd förut).
   Inloggade kundens egna yta PÅ salongens sida. Avsiktligt i STOREFRONT-
   världen (salongens sage-tema) — inte Corevo-grönt — för att respektera
   two-worlds. Stänger röd tråd-loopen: kunden avbokar här → frigör tiden
   och syns avbokad i salong-admin direkt. Visningsnamn-valet slår mot
   salong-admins kundvy. Inloggad kund: Sara Lind (c3).                    */
const { useState: useStateKP } = React;

const SAGE = { primary: "#5E7361", primaryD: "#44543F", bg: "#F1EFE8", surface: "#FFFFFF", fg: "#232520", fg2: "#5C5F55", line: "#E2DED2", soft: "#EAEBE3", gold: "#B08A4A" };
const serif = "'Cormorant Garamond', Georgia, serif";
const sans = "'Jost', 'Inter', sans-serif";

function CustomerPortal() {
  const { bookings, customers, actions } = useStore();
  const { MY_HISTORY, custName, CUST_PROFILE } = window.BO;
  const me = customers.find(c => c.id === "c3");
  const prof = CUST_PROFILE.c3;
  const upcoming = bookings.filter(b => b.customerId === "c3" && b.status !== "avbokad");
  const cancelled = bookings.filter(b => b.customerId === "c3" && b.status === "avbokad");
  const nextTier = 4000;
  const todayBk = upcoming.find(b => b.day === window.BO.TODAY);

  return (
    <div data-world="storefront" data-theme="salvia" style={{ minHeight: "100vh", background: SAGE.bg, color: SAGE.fg, fontFamily: sans }}>
      {/* header */}
      <header style={{ background: SAGE.surface, borderBottom: `1px solid ${SAGE.line}`, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "18px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: serif, fontSize: 24, fontWeight: 600, color: SAGE.fg }}>Studio Salvia</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, color: SAGE.fg2 }}>Mina sidor</span>
            <div style={{ width: 38, height: 38, borderRadius: 999, background: SAGE.primary, color: "#fff", display: "grid", placeItems: "center", fontWeight: 600, fontFamily: sans }}>{me.fullName[0]}</div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 80px", display: "grid", gap: 26 }}>
        {/* greeting + personal teaser */}
        <section>
          <div style={{ fontSize: 13, letterSpacing: ".16em", textTransform: "uppercase", color: SAGE.primary, fontWeight: 600 }}>Välkommen tillbaka</div>
          <h1 style={{ fontFamily: serif, fontSize: 44, fontWeight: 600, margin: "8px 0 0", lineHeight: 1.05 }}>Hej {me.fullName.split(" ")[0]}</h1>
          {todayBk && <div style={{ fontFamily: serif, fontStyle: "italic", fontSize: 19, color: SAGE.fg2, marginTop: 8 }}>Vi ses idag {todayBk.time} hos {todayBk.staff} — {todayBk.service.toLowerCase()}.</div>}
        </section>

        {/* DIN FRISÖR — den emotionella kärnan: "min frisör har koll på mig" */}
        <StylistCard me={me} prof={prof} />

        {/* loyalty */}
        <section style={{ background: SAGE.primary, color: "#fff", borderRadius: 18, padding: 26, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 18 }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 12.5, letterSpacing: ".14em", textTransform: "uppercase", opacity: .8 }}>Lojalitet · {me.tier}</div>
            <div style={{ fontFamily: serif, fontSize: 40, fontWeight: 600, marginTop: 4, whiteSpace: "nowrap", lineHeight: 1.1 }}>{me.points.toLocaleString("sv-SE")} poäng</div>
            <div style={{ marginTop: 14, width: "100%", maxWidth: 300 }}>
              <div style={{ height: 7, borderRadius: 999, background: "rgba(255,255,255,.25)", overflow: "hidden" }}><div style={{ height: "100%", width: `${(me.points / nextTier) * 100}%`, background: "#fff", borderRadius: 999 }} /></div>
              <div style={{ fontSize: 12.5, opacity: .85, marginTop: 7 }}>{(nextTier - me.points).toLocaleString("sv-SE")} p kvar — då bjuder vi på en inpackning.</div>
            </div>
          </div>
          <div style={{ width: 64, height: 64, borderRadius: 999, background: "rgba(255,255,255,.15)", display: "grid", placeItems: "center", flex: "none" }}><Icon name="gift" size={30} style={{ color: "#fff" }} /></div>
        </section>

        {/* din vanliga — smart omboka i ett tryck */}
        <UsualCard prof={prof} me={me} actions={actions} />

        {/* my bookings */}
        <section>
          <h2 style={{ fontFamily: serif, fontSize: 28, fontWeight: 600, margin: "0 0 16px" }}>Mina bokningar</h2>
          {upcoming.length === 0 && (
            <div style={{ background: SAGE.surface, border: `1px solid ${SAGE.line}`, borderRadius: 16, padding: 28, textAlign: "center" }}>
              <div style={{ fontSize: 15, color: SAGE.fg2 }}>Du har inga kommande tider.</div>
              <button style={{ ...sageBtn(SAGE), marginTop: 16 }}>Boka ny tid</button>
            </div>
          )}
          {upcoming.map(b => <MyBooking key={b.id} b={b} actions={actions} me={me} />)}
          {cancelled.map(b => (
            <div key={b.id} style={{ background: SAGE.surface, border: `1px solid ${SAGE.line}`, borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, opacity: .7, marginTop: 12 }}>
              <div style={{ fontFamily: serif, fontSize: 22, color: SAGE.fg2, textDecoration: "line-through" }}>{b.time}</div>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 15 }}>{b.service}</div><div style={{ fontSize: 13, color: SAGE.fg2 }}>{b.day} · {b.staff}</div></div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#9E5A57", background: "#F1E2E0", padding: "5px 12px", borderRadius: 999 }}>Avbokad</span>
            </div>
          ))}
        </section>

        {/* history */}
        <section>
          <h2 style={{ fontFamily: serif, fontSize: 28, fontWeight: 600, margin: "0 0 16px" }}>Tidigare besök</h2>
          <div style={{ background: SAGE.surface, border: `1px solid ${SAGE.line}`, borderRadius: 16, overflow: "hidden" }}>
            {MY_HISTORY.map((h, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 20px", borderBottom: i < MY_HISTORY.length - 1 ? `1px solid ${SAGE.line}` : "none" }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: SAGE.soft, display: "grid", placeItems: "center", flex: "none" }}><Icon name="scissors" size={17} style={{ color: SAGE.primary }} /></div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14.5 }}>{h.service}</div><div style={{ fontSize: 12.5, color: SAGE.fg2 }}>{h.date} · {h.staff}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 14, fontWeight: 600 }}>{h.price} kr</div><div style={{ fontSize: 12, color: SAGE.gold, fontWeight: 600 }}>+{h.points} p</div></div>
              </div>
            ))}
          </div>
        </section>

        {/* privacy + profile */}
        <PrivacyPanel me={me} actions={actions} />
      </main>
    </div>
  );
}

/* DIN FRISÖR — relationen, det som gör att kunden känner sig ihågkommen */
function StylistCard({ me, prof }) {
  const [sent, setSent] = useStateKP(false);
  const [note, setNote] = useStateKP("");
  return (
    <section style={{ background: SAGE.surface, border: `1px solid ${SAGE.line}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,.05)" }}>
      <div style={{ padding: "24px 26px", display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: 60, height: 60, borderRadius: 999, background: SAGE.primary, color: "#fff", display: "grid", placeItems: "center", fontFamily: serif, fontSize: 28, fontWeight: 600, flex: "none" }}>{me.favStaff[0]}</div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: SAGE.primary, fontWeight: 600 }}>Din frisör</div>
          <div style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, marginTop: 4 }}>{me.favStaff} Sandberg</div>
          <div style={{ fontSize: 13.5, color: SAGE.fg2, marginTop: 2 }}>Färgspecialist · din frisör sedan {prof.since} · ni har setts {me.visits} gånger</div>
        </div>
      </div>

      {/* personlig hälsning från frisören */}
      <div style={{ margin: "0 26px", padding: "18px 20px", background: SAGE.soft, borderRadius: 14, position: "relative" }}>
        <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 18, lineHeight: 1.5, color: SAGE.fg, margin: 0 }}>"Vi landade så fint i ljusbrunt sist. Nästa gång testar vi en ännu mjukare övergång — jag har en idé. Vi ses snart!"</p>
        <div style={{ fontFamily: serif, fontSize: 16, color: SAGE.primary, marginTop: 8 }}>— {me.favStaff}</div>
      </div>

      {/* det din frisör minns om dig */}
      <div style={{ padding: "20px 26px 8px" }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: SAGE.fg2, marginBottom: 10 }}>Det här minns {me.favStaff} om dig</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {prof.prefs.map(p => <span key={p} style={{ fontSize: 13, color: SAGE.fg, background: SAGE.bg, border: `1px solid ${SAGE.line}`, borderRadius: 999, padding: "6px 13px" }}>{p}</span>)}
          <span style={{ fontSize: 13, color: SAGE.fg, background: SAGE.bg, border: `1px solid ${SAGE.line}`, borderRadius: 999, padding: "6px 13px", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="coffee" size={14} style={{ color: SAGE.primary }} /> {prof.drink}</span>
        </div>
      </div>

      {/* sparade looks / referenser */}
      {prof.style.length > 0 && (
        <div style={{ padding: "16px 26px 4px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: SAGE.fg2, marginBottom: 10 }}>Din stil hos {me.favStaff}</div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {prof.style.map((s, i) => (
              <div key={i} style={{ flex: "none", width: 116 }}>
                <div style={{ height: 116, borderRadius: 12, border: `1px solid ${SAGE.line}`, background: `repeating-linear-gradient(135deg, ${SAGE.soft}, ${SAGE.soft} 9px, ${SAGE.bg} 9px, ${SAGE.bg} 18px)`, display: "grid", placeItems: "center" }}><Icon name="scissors" size={20} style={{ color: SAGE.primary, opacity: .5 }} /></div>
                <div style={{ fontSize: 11.5, color: SAGE.fg2, marginTop: 6, lineHeight: 1.3 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: "16px 26px 24px", display: "flex", gap: 10, flexWrap: "wrap", borderTop: `1px solid ${SAGE.line}`, marginTop: 14 }}>
        <button style={sageBtn(SAGE)}>Boka hos {me.favStaff}</button>
        {sent
          ? <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: SAGE.primaryD, fontWeight: 600 }}><Icon name="check" size={16} /> Skickat till {me.favStaff}</span>
          : <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 220 }}>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder={`Skriv till ${me.favStaff}…`} style={{ flex: 1, padding: "11px 14px", borderRadius: 999, border: `1px solid ${SAGE.line}`, background: SAGE.bg, fontFamily: sans, fontSize: 14, outline: "none" }} />
              <button onClick={() => { if (note.trim()) setSent(true); }} style={sageBtnGhost(SAGE)}>Skicka</button>
            </div>}
      </div>
    </section>
  );
}

/* DIN VANLIGA — smart omboka i ett tryck */
function UsualCard({ prof, me, actions }) {
  return (
    <section style={{ background: SAGE.surface, border: `1px solid ${SAGE.line}`, borderRadius: 18, padding: "22px 26px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: SAGE.soft, display: "grid", placeItems: "center", flex: "none" }}><Icon name="repeat" size={22} style={{ color: SAGE.primary }} /></div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 12, letterSpacing: ".14em", textTransform: "uppercase", color: SAGE.primary, fontWeight: 600 }}>Din vanliga</div>
        <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, marginTop: 3 }}>Färg & slingor hos {me.favStaff}</div>
        <div style={{ fontSize: 13.5, color: SAGE.fg2, marginTop: 3 }}>Du brukar boka var {prof.cadence}:e vecka · senast {me.lastVisit}. Dags snart?</div>
      </div>
      <button onClick={() => actions.notify("Vi hittar din vanliga tid…", "info", "calendar")} style={sageBtn(SAGE)}>Boka din vanliga</button>
    </section>
  );
}

function MyBooking({ b, actions, me }) {
  const [msg, setMsg] = useStateKP("");
  const [sent, setSent] = useStateKP(false);
  return (
    <div style={{ background: SAGE.surface, border: `1px solid ${SAGE.line}`, borderRadius: 16, overflow: "hidden" }}>
      <div style={{ padding: 22, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ textAlign: "center", minWidth: 72 }}>
          <div style={{ fontSize: 12.5, letterSpacing: ".08em", textTransform: "uppercase", color: SAGE.primary, fontWeight: 600 }}>{b.day}</div>
          <div style={{ fontFamily: serif, fontSize: 32, fontWeight: 600, color: SAGE.fg }}>{b.time}</div>
        </div>
        <div style={{ width: 1, alignSelf: "stretch", background: SAGE.line }} />
        <div style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontWeight: 600, fontSize: 17 }}>{b.service}</div>
          <div style={{ fontSize: 13.5, color: SAGE.fg2, marginTop: 3 }}>{b.dur} min · hos {b.staff}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={sageBtnGhost(SAGE)}>Omboka</button>
          <button onClick={() => actions.cancel(b.id, "kund")} style={sageBtnGhost(SAGE, "#9E5A57")}>Avboka</button>
        </div>
      </div>
      {/* message to salon — lands as note on the booking row */}
      <div style={{ borderTop: `1px solid ${SAGE.line}`, padding: "14px 22px", background: SAGE.soft }}>
        {sent ? (
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: SAGE.primaryD }}><Icon name="check" size={16} /> Skickat — landar som notering hos din frisör.</div>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
            <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Meddela något inför besöket…" style={{ flex: 1, padding: "11px 14px", borderRadius: 10, border: `1px solid ${SAGE.line}`, background: SAGE.surface, fontFamily: sans, fontSize: 14, outline: "none" }} />
            <button onClick={() => { if (msg.trim()) { actions.addNote(b.id, msg.trim(), "kund"); setSent(true); } }} style={{ ...sageBtn(SAGE), padding: "11px 18px" }}>Skicka</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PrivacyPanel({ me, actions }) {
  const showOpts = [["full", "Fullt namn"], ["first", "Bara förnamn"], ["initial", "Initialer"]];
  const [consent, setConsent] = useStateKP(me.consent);
  return (
    <section style={{ background: SAGE.surface, border: `1px solid ${SAGE.line}`, borderRadius: 18, padding: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}><Icon name="shield" size={18} style={{ color: SAGE.primary }} /><h2 style={{ fontFamily: serif, fontSize: 26, fontWeight: 600, margin: 0 }}>Integritet</h2></div>
      <p style={{ fontSize: 14, color: SAGE.fg2, lineHeight: 1.6, margin: "0 0 20px" }}>Du bestämmer hur du syns för salongen. Ditt lojalitetsband finns kvar oavsett — det bygger på dig, inte på dina kontaktuppgifter.</p>

      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Så här ser frisören mitt namn</div>
      <div style={{ display: "flex", gap: 6, background: SAGE.soft, padding: 5, borderRadius: 12, marginBottom: 8 }}>
        {showOpts.map(([k, l]) => (
          <button key={k} onClick={() => actions.setPrivacy(me.id, k)} style={{ flex: 1, padding: "10px 8px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: sans, fontSize: 13, fontWeight: 600, background: me.showAs === k ? SAGE.primary : "transparent", color: me.showAs === k ? "#fff" : SAGE.fg2 }}>{l}</button>
        ))}
      </div>
      <div style={{ fontSize: 13, color: SAGE.fg2, marginBottom: 22 }}>Visas i salongens system som <b style={{ color: SAGE.fg }}>{window.BO.custName(me)}</b></div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div><div style={{ fontSize: 12, color: SAGE.fg2, marginBottom: 6 }}>Telefon</div><input defaultValue={me.phone} style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: `1px solid ${SAGE.line}`, fontFamily: sans, fontSize: 14, outline: "none", boxSizing: "border-box" }} /></div>
        <div><div style={{ fontSize: 12, color: SAGE.fg2, marginBottom: 6 }}>E-post</div><input defaultValue={me.email} style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: `1px solid ${SAGE.line}`, fontFamily: sans, fontSize: 14, outline: "none", boxSizing: "border-box" }} /></div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: SAGE.soft, borderRadius: 12 }}>
        <div style={{ paddingRight: 16 }}><div style={{ fontWeight: 600, fontSize: 14 }}>Spara mina uppgifter för nästa gång</div><div style={{ fontSize: 12.5, color: SAGE.fg2, marginTop: 2 }}>Annars gallras kontaktuppgifterna efter besöket.</div></div>
        <button onClick={() => setConsent(!consent)} style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", background: consent ? SAGE.primary : "#CFC9BC", position: "relative", flex: "none" }}><span style={{ position: "absolute", top: 3, left: consent ? 23 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left .16s" }} /></button>
      </div>
    </section>
  );
}

function sageBtn(c, bg) { return { background: bg || c.primary, color: "#fff", border: "none", borderRadius: 999, padding: "12px 22px", fontFamily: sans, fontSize: 14, fontWeight: 600, cursor: "pointer" }; }
function sageBtnGhost(c, color) { return { background: "transparent", color: color || c.fg, border: `1px solid ${color || c.line}`, borderRadius: 999, padding: "10px 18px", fontFamily: sans, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }; }

window.CustomerPortal = CustomerPortal;
