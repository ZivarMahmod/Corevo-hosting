/* Corevo back-office shell + primitives + shared live store.
   The store makes the "röd tråd" literal: cancel a booking in one surface and
   the slot frees + status updates everywhere (admin, frisör, kund).         */
const { useState: useStateSh, useEffect: useEffectSh, useContext: useContextSh, createContext: createCtxSh } = React;

/* ===================================================================
   SHARED LIVE STORE
   =================================================================== */
const StoreCtx = createCtxSh(null);
const useStore = () => useContextSh(StoreCtx);

function StoreProvider({ children }) {
  const [bookings, setBookings] = useStateSh(() => window.BO.BOOKINGS.map(b => ({ ...b, notes: [...b.notes] })));
  const [customers, setCustomers] = useStateSh(() => window.BO.CUSTOMERS.map(c => ({ ...c })));
  const [revealed, setRevealed] = useStateSh({});   // time-bound PII reveals: { [custId]: true }
  const [toast, setToast] = useStateSh(null);

  useEffectSh(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3400); return () => clearTimeout(t); }, [toast]);
  const fire = (msg, tone = "success", icon = "check") => setToast({ msg, tone, icon, id: Date.now() });

  const find = id => bookings.find(b => b.id === id);
  const patch = (id, fn) => setBookings(bs => bs.map(b => b.id === id ? fn(b) : b));

  const actions = {
    cancel(id, by = "admin") {
      const b = find(id); if (!b) return;
      patch(id, x => ({ ...x, status: "avbokad", paid: false, notes: [...x.notes, { from: "system", text: `Avbokad (${by}) — tiden ${x.time} åter på storefront.`, at: "nyss" }] }));
      fire(`Tid ${b.time} frigjord — åter bokningsbar på storefronten`, "success", "repeat");
    },
    reopen(id) { const b = find(id); if (!b) return; patch(id, x => ({ ...x, status: "gjord" })); fire(`Bokning ${b.time} återställd`, "info", "undo"); },
    complete(id) { const b = find(id); if (!b) return; patch(id, x => ({ ...x, status: "klar" })); fire(`${b.time} markerad som klar`, "success", "check"); },
    markPaid(id) { patch(id, x => ({ ...x, paid: true })); fire("Markerad som betald", "success", "check"); },
    addNote(id, text, from = "kund") { patch(id, x => ({ ...x, notes: [...x.notes, { from, text, at: "nyss" }] })); fire("Notering tillagd på bokningsraden", "info", "message"); },
    setPrivacy(custId, showAs) { setCustomers(cs => cs.map(c => c.id === custId ? { ...c, showAs } : c)); fire("Visningsnamn uppdaterat", "info", "shield"); },
    revealPII(custId) { setRevealed(r => ({ ...r, [custId]: true })); fire("Kontaktuppgift synlig i 15 min (loggas)", "warning", "eye"); },
    hidePII(custId) { setRevealed(r => { const n = { ...r }; delete n[custId]; return n; }); },
    notify(msg, tone = "success", icon = "check") { fire(msg, tone, icon); },
  };

  return (
    <StoreCtx.Provider value={{ bookings, customers, revealed, actions }}>
      {children}
      <Toast toast={toast} />
    </StoreCtx.Provider>
  );
}

function Toast({ toast }) {
  const map = { success: "var(--c-success)", info: "var(--c-info)", warning: "var(--c-warning)", danger: "var(--c-danger)" };
  return (
    <div style={{ position: "fixed", left: "50%", bottom: toast ? 28 : -80, transform: "translateX(-50%)", zIndex: 90, transition: "bottom .42s var(--ease-out)", opacity: toast ? 1 : 0, pointerEvents: "none" }}>
      {toast && (
        <div style={{ display: "flex", alignItems: "center", gap: 11, background: "var(--c-forest)", color: "#fff", padding: "13px 20px", borderRadius: 12, boxShadow: "var(--shadow-lg)", fontFamily: "var(--font-ui)", fontSize: 13.5, fontWeight: 500, maxWidth: "88vw" }}>
          <span style={{ width: 26, height: 26, borderRadius: 999, background: map[toast.tone] || "var(--c-success)", display: "grid", placeItems: "center", flex: "none" }}><Icon name={toast.icon} size={15} /></span>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ===================================================================
   PRIMITIVES
   =================================================================== */
function Badge({ children, tone = "neutral", dot = true }) {
  const map = {
    neutral: ["#EFEBE3", "#A7AC9E"], success: ["var(--c-success-bg)", "var(--c-success)"],
    warning: ["var(--c-warning-bg)", "var(--c-warning)"], danger: ["var(--c-danger-bg)", "var(--c-danger)"],
    info: ["var(--c-info-bg)", "var(--c-info)"], gold: ["var(--c-gold-100)", "var(--c-gold-600)"],
  };
  const [bg, accent] = map[tone] || map.neutral;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: bg, color: "var(--c-ink)", fontSize: 12, fontWeight: 600, padding: "4px 11px", borderRadius: 999, fontFamily: "var(--font-ui)", whiteSpace: "nowrap" }}>{dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: accent, flex: "none" }} />}{children}</span>;
}

/* status badge for bookings */
function StatusBadge({ status, paid }) {
  if (status === "avbokad") return <Badge tone="danger">Avbokad</Badge>;
  if (status === "klar") return <Badge tone="success">{paid ? "Klar · betald" : "Klar"}</Badge>;
  return <Badge tone="gold">Bokad</Badge>;
}

function Button({ children, variant = "primary", icon, iconRight, onClick, size = "md", style = {}, disabled }) {
  const pad = size === "sm" ? "8px 14px" : "11px 18px";
  const base = { display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: size === "sm" ? 13 : 14, padding: pad, borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer", border: "1px solid transparent", transition: "all var(--dur-fast)", whiteSpace: "nowrap", opacity: disabled ? 0.45 : 1, ...style };
  const variants = {
    primary: { background: "var(--c-forest)", color: "#fff" }, gold: { background: "var(--c-gold)", color: "#3A2A06" },
    ghost: { background: "transparent", color: "var(--c-ink)", border: "1px solid var(--c-line-strong)" },
    subtle: { background: "var(--c-paper-2)", color: "var(--c-ink)" },
    danger: { background: "var(--c-danger-bg)", color: "var(--c-danger)" },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant] }}
    onMouseEnter={e => { if (disabled) return; if (variant === "primary") e.currentTarget.style.background = "var(--c-forest-700)"; if (variant === "gold") e.currentTarget.style.background = "var(--c-gold-600)"; if (variant === "ghost") e.currentTarget.style.background = "var(--c-paper-2)"; }}
    onMouseLeave={e => { if (disabled) return; if (variant === "primary") e.currentTarget.style.background = "var(--c-forest)"; if (variant === "gold") e.currentTarget.style.background = "var(--c-gold)"; if (variant === "ghost") e.currentTarget.style.background = "transparent"; }}>
    {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}{children}{iconRight && <Icon name={iconRight} size={size === "sm" ? 15 : 17} />}</button>;
}

function Card({ children, style = {}, pad = 22, onClick }) {
  return <div onClick={onClick} style={{ background: "var(--c-paper)", border: "1px solid var(--c-line)", borderRadius: 16, padding: pad, boxShadow: "var(--shadow-sm)", ...style }}>{children}</div>;
}

function Stat({ label, value, delta, deltaTone = "success", icon, hint }) {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <span className="eyebrow">{label}</span>
        {icon && <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--c-paper-2)", color: "var(--c-forest)", display: "grid", placeItems: "center" }}><Icon name={icon} size={18} /></div>}
      </div>
      <div className="num" style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, color: "var(--c-forest)", lineHeight: 1.15, marginTop: 10, whiteSpace: "nowrap" }}>{value}</div>
      {delta && <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: deltaTone === "success" ? "var(--c-success)" : "var(--c-ink-3)", fontFamily: "var(--font-ui)" }}>{deltaTone === "success" && <Icon name="trendUp" size={15} />}{delta}</div>}
      {hint && <div style={{ marginTop: 6, fontSize: 12, color: "var(--c-ink-3)" }}>{hint}</div>}
    </Card>
  );
}

function PageHead({ eyebrow, title, sub, children }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
      <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1 className="h1" style={{ margin: eyebrow ? "8px 0 0" : 0 }}>{title}</h1>{sub && <div className="body" style={{ marginTop: 6, maxWidth: 560 }}>{sub}</div>}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Toggle({ on, set, title, desc, live }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid var(--c-line)" }}>
      <div style={{ paddingRight: 20 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 }}>{title}{live && <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".05em", color: on ? "var(--c-success)" : "var(--c-ink-3)", background: on ? "var(--c-success-bg)" : "var(--c-paper-2)", padding: "2px 7px", borderRadius: 999, textTransform: "uppercase" }}>{on ? "Aktiv" : "Av"}</span>}</div>
        <div style={{ fontSize: 13, color: "var(--c-ink-3)", marginTop: 3, maxWidth: 420 }}>{desc}</div>
      </div>
      <button onClick={() => set(!on)} style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", background: on ? "var(--c-forest)" : "var(--c-line-strong)", position: "relative", transition: "background var(--dur-fast)", flex: "none" }}>
        <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left var(--dur-fast)", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
      </button>
    </div>
  );
}

function Field({ label, ph, val, on, type = "text", hint }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink)", fontFamily: "var(--font-ui)" }}>{label}</span>
      <input type={type} value={val} onChange={e => on && on(e.target.value)} placeholder={ph} style={{ width: "100%", marginTop: 6, padding: "11px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--c-ink)", outline: "none", boxSizing: "border-box" }}
        onFocus={e => e.target.style.borderColor = "var(--c-forest)"} onBlur={e => e.target.style.borderColor = "var(--c-line)"} />
      {hint && <span style={{ fontSize: 12, color: "var(--c-ink-3)", marginTop: 5, display: "block" }}>{hint}</span>}
    </label>
  );
}

function Table({ cols, rows, onRow }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-ui)" }}>
        <thead><tr>{cols.map((c, i) => <th key={i} style={{ textAlign: i === cols.length - 1 ? "right" : "left", padding: "11px 14px", fontSize: 11.5, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--c-ink-3)", fontWeight: 600, borderBottom: "1px solid var(--c-line)" }}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, ri) => (
          <tr key={ri} onClick={onRow ? () => onRow(ri) : undefined} style={{ transition: "background var(--dur-fast)", cursor: onRow ? "pointer" : "default" }} onMouseEnter={e => e.currentTarget.style.background = "var(--c-paper-2)"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            {r.map((cell, ci) => <td key={ci} style={{ padding: "13px 14px", fontSize: 13.5, color: "var(--c-ink)", borderBottom: "1px solid var(--c-line)", textAlign: ci === r.length - 1 ? "right" : "left" }}>{cell}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/* slide-over drawer */
function Drawer({ open, onClose, title, sub, accent, children, footer, width = 460 }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 70, pointerEvents: open ? "auto" : "none" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,30,24,.34)", opacity: open ? 1 : 0, transition: "opacity .28s" }} />
      <aside style={{ position: "absolute", top: 0, right: 0, height: "100%", width, maxWidth: "94vw", background: "var(--c-cream)", boxShadow: "var(--shadow-lg)", transform: open ? "translateX(0)" : "translateX(102%)", transition: "transform .34s var(--ease-out)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--c-line)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, background: "var(--c-paper)" }}>
          <div>{accent}<h2 className="h2" style={{ margin: 0 }}>{title}</h2>{sub && <div className="small" style={{ marginTop: 4 }}>{sub}</div>}</div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--c-line)", background: "var(--c-paper)", color: "var(--c-ink-2)", cursor: "pointer", display: "grid", placeItems: "center", flex: "none" }}><Icon name="x" size={17} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>{children}</div>
        {footer && <div style={{ padding: "16px 24px", borderTop: "1px solid var(--c-line)", background: "var(--c-paper)", display: "flex", gap: 10 }}>{footer}</div>}
      </aside>
    </div>
  );
}

/* light, centered detail card — iPad-friendly. Less space + less chaos than a
   full-height drawer: auto-height, floats, dismiss by tapping outside. Mirrors
   Drawer's API (title/sub/accent/children/footer) so it's a drop-in. */
function DetailModal({ open, onClose, title, sub, accent, children, footer, width = 480 }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 75, pointerEvents: open ? "auto" : "none", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,30,24,.28)", backdropFilter: "blur(2px)", opacity: open ? 1 : 0, transition: "opacity .26s" }} />
      <div style={{ position: "relative", width, maxWidth: "100%", maxHeight: "86vh", background: "var(--c-paper)", borderRadius: 20, boxShadow: "var(--shadow-lg)", border: "1px solid var(--c-line)", display: "flex", flexDirection: "column", overflow: "hidden", transform: open ? "translateY(0) scale(1)" : "translateY(10px) scale(.98)", opacity: open ? 1 : 0, transition: "transform .28s var(--ease-out), opacity .22s" }}>
        <div style={{ padding: "18px 20px 16px", borderBottom: "1px solid var(--c-line)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 }}>
          <div style={{ minWidth: 0 }}>{accent}<h2 className="h2" style={{ margin: 0 }}>{title}</h2>{sub && <div className="small" style={{ marginTop: 4 }}>{sub}</div>}</div>
          <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", color: "var(--c-ink-2)", cursor: "pointer", display: "grid", placeItems: "center", flex: "none" }}><Icon name="x" size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>{children}</div>
        {footer && <div style={{ padding: "14px 20px", borderTop: "1px solid var(--c-line)", background: "var(--c-paper)", display: "flex", gap: 10 }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ===================================================================
   SIDEBAR + TOPBAR + ROLE SWITCHER
   =================================================================== */
const NAV = {
  super: { brand: "Corevo", sub: "Plattform", label: "Zivar", org: "Super admin", items: [
    ["group", "Insyn"], ["grid", "Översikt"], ["dollar", "Fakturering"],
    ["group", "Tenants"], ["building", "Salonger"], ["plus", "Onboarda salong"],
    ["group", "Data & drift"], ["users", "Kunder"], ["scissors", "Personal"], ["alert", "Drift & logg"],
    ["group", "Plattform"], ["layers", "Integrationer"], ["shield", "Roller"], ["settings", "Inställningar"],
  ] },
  salon: { brand: "Studio Salvia", sub: "Salong-admin", label: "Elin Sandberg", org: "Ägare", items: [
    ["group", "Din dag"], ["home", "Dashboard"], ["calendar", "Bokningar"],
    ["group", "Hantera"], ["users", "Kunder"], ["scissors", "Tjänster"], ["user", "Personal"], ["clock", "Schema"],
    ["group", "Din sida"], ["palette", "Varumärke"], ["settings", "Inställningar"],
  ] },
  staff: { brand: "Studio Salvia", sub: "Frisör", label: "Maja Lund", org: "Inloggad", items: [["home", "Idag"], ["calendar", "Mitt schema"], ["coffee", "Frånvaro"]] },
};

function Sidebar({ role, active, onNav, override }) {
  const cfg = NAV[role];
  const brand = (override && override.brand) || cfg.brand;
  const sub = (override && override.sub) || cfg.sub;
  return (
    <aside style={{ width: 244, flex: "none", background: "var(--c-forest)", color: "var(--c-on-forest)", minHeight: "100vh", display: "flex", flexDirection: "column", padding: "22px 16px", position: "sticky", top: 0, height: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 8px 22px" }}>
        <div style={{ width: 34, height: 34, flex: "none", borderRadius: 9, background: "var(--c-gold)", color: "var(--c-forest-700)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 19 }}>C</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, lineHeight: 1.15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brand}</div>
          <div style={{ fontSize: 10.5, color: "var(--c-on-forest-2)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 3 }}>{sub}</div>
        </div>
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, overflowY: "auto", marginRight: -6, paddingRight: 6 }}>
        {cfg.items.map(([ic, label], idx) => {
          if (ic === "group") return <div key={"g" + idx} style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--c-on-forest-2)", opacity: .65, padding: idx === 0 ? "2px 13px 7px" : "16px 13px 7px" }}>{label}</div>;
          const on = active === label;
          return (
            <button key={label} onClick={() => onNav(label)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 13px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: on ? 600 : 500, background: on ? "var(--c-forest-700)" : "transparent", color: on ? "#fff" : "var(--c-on-forest-2)", borderLeft: on ? "2px solid var(--c-gold)" : "2px solid transparent", transition: "all var(--dur-fast)" }}
              onMouseEnter={e => { if (!on) { e.currentTarget.style.background = "rgba(255,255,255,.05)"; e.currentTarget.style.color = "var(--c-on-forest)"; } }}
              onMouseLeave={e => { if (!on) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--c-on-forest-2)"; } }}>
              <Icon name={ic} size={18} stroke={1.7} />{label}
            </button>
          );
        })}
      </nav>
      <div style={{ borderTop: "1px solid var(--c-forest-300)", paddingTop: 14, display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 34, height: 34, borderRadius: 999, background: "var(--c-forest-300)", display: "grid", placeItems: "center", fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 14, color: "#fff" }}>{cfg.label[0]}</div>
        <div style={{ flex: 1, lineHeight: 1.2, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cfg.label}</div><div style={{ fontSize: 11, color: "var(--c-on-forest-2)" }}>{cfg.org}</div></div>
        <Icon name="logout" size={17} style={{ color: "var(--c-on-forest-2)", cursor: "pointer" }} />
      </div>
    </aside>
  );
}

function Topbar({ context, onOpenPalette }) {
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform || "");
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 30px", borderBottom: "1px solid var(--c-line)", background: "color-mix(in srgb, var(--c-cream) 80%, transparent)", backdropFilter: "blur(8px)", position: "sticky", top: 0, zIndex: 20 }}>
      <button onClick={onOpenPalette} style={{ display: "flex", alignItems: "center", gap: 10, width: 340, maxWidth: "42vw", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-ui)" }}>
        <Icon name="search" size={17} style={{ color: "var(--c-ink-3)", flex: "none" }} />
        <span style={{ flex: 1, fontSize: 13.5, color: "var(--c-ink-3)" }}>{context === "super" ? "Sök salong, kund, personal, åtgärd…" : "Sök bokning, kund, tjänst…"}</span>
        <kbd style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, color: "var(--c-ink-3)", background: "var(--c-paper-2)", border: "1px solid var(--c-line)", borderRadius: 6, padding: "2px 7px" }}>{isMac ? "⌘" : "Ctrl"} K</kbd>
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {context === "super" && <a href="#" onClick={e => e.preventDefault()} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--c-forest)", textDecoration: "none", padding: "8px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)" }}><Icon name="external" size={15} /> Supabase</a>}
        {context === "salon" && <a href="#" onClick={e => e.preventDefault()} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "var(--c-forest)", textDecoration: "none", padding: "8px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)" }}><Icon name="external" size={15} /> Se din sida</a>}
        <button style={{ position: "relative", width: 38, height: 38, borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", color: "var(--c-ink-2)", cursor: "pointer", display: "grid", placeItems: "center" }}>
          <Icon name="bell" size={18} /><span style={{ position: "absolute", top: 8, right: 9, width: 7, height: 7, borderRadius: 999, background: "var(--c-gold)" }} />
        </button>
      </div>
    </div>
  );
}

/* ===================================================================
   COMMAND PALETTE (⌘K) — hitta salong / kund / personal / åtgärd direkt
   =================================================================== */
function CommandPalette({ open, onClose, role, onNav, onOpenTenant }) {
  const [q, setQ] = useStateSh("");
  const [hi, setHi] = useStateSh(0);
  useEffectSh(() => { if (open) { setQ(""); setHi(0); } }, [open]);

  const items = [];
  if (role === "super") {
    const SU = window.SU || {};
    [["grid", "Översikt"], ["dollar", "Fakturering"], ["building", "Salonger"], ["plus", "Onboarda salong"], ["users", "Kunder"], ["scissors", "Personal"], ["alert", "Drift & logg"], ["layers", "Integrationer"], ["shield", "Roller"], ["settings", "Inställningar"]]
      .forEach(([ic, label]) => items.push({ ic, label, kind: "Gå till", run: () => onNav(label) }));
    Object.values(SU.TENANTS || {}).forEach(t => items.push({ ic: "building", label: t.name, kind: "Salong · öppna", sub: t.slug + ".corevo.se", run: () => onOpenTenant(t.slug) }));
    (SU.CUSTOMERS || []).forEach(c => items.push({ ic: "user", label: c.name, kind: "Kund · " + c.tenant, sub: c.email, run: () => onNav("Kunder") }));
    [["mail", "Skicka lösenordsreset"], ["plus", "Skapa ny tenant"], ["pause", "Suspendera salong"], ["link", "Sätt Google-recensionslänk"]]
      .forEach(([ic, label]) => items.push({ ic, label, kind: "Åtgärd", run: () => onNav(label === "Skapa ny tenant" ? "Onboarda salong" : label === "Suspendera salong" ? "Drift & logg" : "Kunder") }));
  }
  const ql = q.toLowerCase();
  const list = (q ? items.filter(it => (it.label + " " + it.kind + " " + (it.sub || "")).toLowerCase().includes(ql)) : items).slice(0, 9);

  useEffectSh(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(list.length - 1, h + 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(0, h - 1)); }
      else if (e.key === "Enter") { e.preventDefault(); const it = list[hi]; if (it) { it.run(); onClose(); } }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, list, hi]);

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 95, display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "12vh" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,30,24,.4)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "relative", width: 560, maxWidth: "92vw", background: "var(--c-paper)", borderRadius: 16, boxShadow: "var(--shadow-lg)", overflow: "hidden", border: "1px solid var(--c-line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "16px 18px", borderBottom: "1px solid var(--c-line)" }}>
          <Icon name="search" size={19} style={{ color: "var(--c-ink-3)" }} />
          <input autoFocus value={q} onChange={e => { setQ(e.target.value); setHi(0); }} placeholder="Sök salong, kund, personal eller åtgärd…" style={{ flex: 1, border: "none", outline: "none", fontFamily: "var(--font-ui)", fontSize: 16, color: "var(--c-ink)", background: "transparent" }} />
          <kbd style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, color: "var(--c-ink-3)", background: "var(--c-paper-2)", border: "1px solid var(--c-line)", borderRadius: 6, padding: "3px 7px" }}>esc</kbd>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto", padding: 8 }}>
          {list.length === 0 && <div style={{ padding: "26px 14px", textAlign: "center", color: "var(--c-ink-3)", fontSize: 14 }}>Inget matchar “{q}”.</div>}
          {list.map((it, i) => (
            <button key={i} onMouseEnter={() => setHi(i)} onClick={() => { it.run(); onClose(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 13, padding: "11px 12px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left", background: i === hi ? "var(--c-paper-2)" : "transparent", fontFamily: "var(--font-ui)" }}>
              <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--c-cream)", color: "var(--c-forest)", display: "grid", placeItems: "center", flex: "none" }}><Icon name={it.ic} size={17} /></span>
              <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)" }}>{it.label}</span>{it.sub && <span style={{ fontSize: 12, color: "var(--c-ink-3)", marginLeft: 8 }}>{it.sub}</span>}</span>
              <span style={{ fontSize: 11.5, color: "var(--c-ink-3)", fontWeight: 500, flex: "none" }}>{it.kind}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* extra shared primitives used across super screens */
function SubTabs({ tabs, active, onPick }) {
  return (
    <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--c-line)", marginBottom: 22, flexWrap: "wrap" }}>
      {tabs.map(([k, ic]) => {
        const on = active === k;
        return (
          <button key={k} onClick={() => onPick(k)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 15px", border: "none", borderBottom: on ? "2px solid var(--c-forest)" : "2px solid transparent", marginBottom: -1, background: "transparent", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: on ? "var(--c-forest)" : "var(--c-ink-3)", transition: "all var(--dur-fast)" }}>
            {ic && <Icon name={ic} size={16} />}{k}
          </button>
        );
      })}
    </div>
  );
}

function KV({ label, value, mono }) {
  return <div><div style={{ fontSize: 11, color: "var(--c-ink-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div><div className={mono ? "num" : ""} style={{ fontSize: 14, fontWeight: 500, marginTop: 3, color: "var(--c-ink)" }}>{value}</div></div>;
}

/* tiny chip showing the real backend table/flow a no-code control maps to */
function TableChip({ children }) {
  return <span className="num" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--c-info)", background: "var(--c-info-bg)", border: "1px solid color-mix(in srgb, var(--c-info) 20%, transparent)", borderRadius: 7, padding: "2px 8px" }}><Icon name="layers" size={12} />{children}</span>;
}

function Sparkline({ data, w = 220, h = 48, color = "var(--c-gold)" }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 6) - 3}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", maxWidth: "100%" }} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* always-visible demo role switcher (4 surfaces) */
function RoleSwitcher({ role, onRole }) {
  const opts = [["super", "Super"], ["salon", "Salong"], ["staff", "Frisör"], ["customer", "Kund"]];
  return (
    <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 80, display: "flex", gap: 2, background: "rgba(31,70,54,.92)", padding: 4, borderRadius: 12, boxShadow: "var(--shadow-md)", backdropFilter: "blur(6px)" }}>
      {opts.map(([k, l]) => (
        <button key={k} onClick={() => onRole(k)} style={{ padding: "7px 15px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, background: role === k ? "var(--c-gold)" : "transparent", color: role === k ? "#3A2A06" : "rgba(255,255,255,.8)", transition: "all var(--dur-fast)" }}>{l}</button>
      ))}
    </div>
  );
}

Object.assign(window, { StoreProvider, useStore, Badge, StatusBadge, Button, Card, Stat, PageHead, Toggle, Field, Table, Drawer, DetailModal, Sidebar, Topbar, RoleSwitcher, CommandPalette, SubTabs, KV, TableChip, Sparkline });
