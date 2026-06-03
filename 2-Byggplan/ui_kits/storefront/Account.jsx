/* Customer account — login / register / "Mina tider" (my bookings).
   Rendered as a centered modal within the storefront shell. */
const { useState: useStateA } = React;

function Account({ t, open, onClose }) {
  const [view, setView] = useStateA("login"); // login | register | account
  const dark = t.theme === "zigge";
  if (!open) return null;
  const accentText = dark ? "#14120E" : "#fff";

  const field = (label, ph, type = "text") => (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--color-fg)" }}>{label}</span>
      <input type={type} placeholder={ph} style={{ width: "100%", marginTop: 6, padding: "12px 14px", borderRadius: "var(--sf-radius)", border: "1.5px solid var(--color-line)", background: "var(--color-bg)", color: "var(--color-fg)", fontFamily: "var(--font-body)", fontSize: 15, outline: "none", boxSizing: "border-box" }}
        onFocus={e => e.target.style.borderColor = "var(--color-primary)"} onBlur={e => e.target.style.borderColor = "var(--color-line)"} />
    </label>
  );
  const primaryBtn = (label, onClick) => (
    <button onClick={onClick} style={{ width: "100%", padding: "14px", borderRadius: "var(--radius-pill)", border: "none", background: "var(--color-primary)", color: accentText, fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, cursor: "pointer", letterSpacing: dark ? "0.06em" : "0.01em", textTransform: dark ? "uppercase" : "none" }}>{label}</button>
  );

  const bookings = [
    { svc: t.services[0].name, who: t.team[0].name, when: "Tor 12 jun · 14:30", status: "Kommande" },
    { svc: t.services[2].name, who: t.team[1].name, when: "Fre 28 mar · 11:00", status: "Genomförd" },
  ];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(0,0,0,.45)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(460px, 100%)", background: "var(--color-surface)", borderRadius: "calc(var(--sf-radius) + 6px)", overflow: "hidden", boxShadow: "0 40px 100px rgba(0,0,0,.4)" }}>
        <div style={{ padding: "22px 26px", borderBottom: "1px solid var(--color-line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Wordmark t={t} />
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-fg)", opacity: 0.7 }}><Icon name="x" size={22} /></button>
        </div>

        <div style={{ padding: 26 }}>
          {view !== "account" && (
            <div style={{ display: "flex", gap: 4, background: "var(--color-accent-soft)", borderRadius: "var(--radius-pill)", padding: 4, marginBottom: 22 }}>
              {[["login", "Logga in"], ["register", "Skapa konto"]].map(([k, l]) => (
                <button key={k} onClick={() => setView(k)} style={{ flex: 1, padding: "9px", borderRadius: "var(--radius-pill)", border: "none", background: view === k ? "var(--color-surface)" : "transparent", color: "var(--color-fg)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", boxShadow: view === k ? "var(--sf-shadow-soft)" : "none" }}>{l}</button>
              ))}
            </div>
          )}

          {view === "login" && (<>
            {field("E-post", "du@exempel.se", "email")}
            {field("Lösenord", "••••••••", "password")}
            <div style={{ marginTop: 8 }}>{primaryBtn("Logga in", () => setView("account"))}</div>
            <p style={{ textAlign: "center", marginTop: 14, fontFamily: "var(--font-body)", fontSize: 13, color: "var(--color-fg-2)", cursor: "pointer" }}>Glömt lösenord?</p>
          </>)}

          {view === "register" && (<>
            {field("Namn", "Förnamn Efternamn")}
            {field("E-post", "du@exempel.se", "email")}
            {field("Telefon", "07X XXX XX XX", "tel")}
            <div style={{ marginTop: 8 }}>{primaryBtn("Skapa konto", () => setView("account"))}</div>
          </>)}

          {view === "account" && (<>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
              <div style={{ width: 52, height: 52, borderRadius: 999, background: "var(--color-primary)", color: accentText, display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontSize: 22 }}>A</div>
              <div><div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--color-fg)" }}>Anna Bergström</div><div className="sf-body" style={{ fontSize: 13.5 }}>anna@exempel.se</div></div>
            </div>
            <h4 className="sf-eyebrow" style={{ marginBottom: 12 }}>Mina tider</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {bookings.map((b, i) => (
                <div key={i} style={{ border: "1px solid var(--color-line)", borderRadius: "var(--sf-radius)", padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15.5, color: "var(--color-fg)" }}>{b.svc}</div>
                      <div className="sf-body" style={{ fontSize: 13.5, marginTop: 3 }}>{b.who} · {b.when}</div>
                    </div>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: b.status === "Kommande" ? "var(--color-accent-soft)" : "transparent", color: b.status === "Kommande" ? "var(--color-primary)" : "var(--color-fg-2)", border: b.status === "Kommande" ? "none" : "1px solid var(--color-line)" }}>{b.status}</span>
                  </div>
                  {b.status === "Kommande" && (
                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                      <button style={{ flex: 1, padding: "9px", borderRadius: "var(--radius-pill)", border: "1.5px solid var(--color-line)", background: "transparent", color: "var(--color-fg)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Omboka</button>
                      <button style={{ flex: 1, padding: "9px", borderRadius: "var(--radius-pill)", border: "1.5px solid var(--color-line)", background: "transparent", color: "var(--color-fg-2)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Avboka</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => { setView("login"); onClose(); }} style={{ width: "100%", marginTop: 18, padding: "12px", borderRadius: "var(--radius-pill)", border: "1.5px solid var(--color-line)", background: "transparent", color: "var(--color-fg-2)", fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon name="logout" size={16} /> Logga ut</button>
          </>)}
        </div>
      </div>
    </div>
  );
}

window.Account = Account;
