/* Super admin — TENANT-DETALJ (M7 §2.1B "Supabase med mitt UI").
   Öppna en salong → full kontroll utan kod: data, personal, branding,
   integrationer, drift. Under-flikar, röd tråd, mappar mot riktiga tabeller. */
const { useState: useStateTN } = React;

function tnField(label, value, onChange, hint) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-ink)", fontFamily: "var(--font-ui)" }}>{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--c-ink)", outline: "none", boxSizing: "border-box" }}
        onFocus={e => e.target.style.borderColor = "var(--c-forest)"} onBlur={e => e.target.style.borderColor = "var(--c-line)"} />
      {hint && <span style={{ fontSize: 11.5, color: "var(--c-ink-3)", marginTop: 5, display: "block" }}>{hint}</span>}
    </label>
  );
}

function SuperTenantDetail({ slug, onBack, onAssist }) {
  const { actions } = useStore();
  const SU = window.SU;
  const base = SU.TENANTS[slug];
  const [tab, setTab] = useStateTN("Översikt");
  const [t, setT] = useStateTN(() => ({ ...base }));
  const [suspended, setSuspended] = useStateTN(base.status === "Pausad");
  const set = (k, v) => setT(o => ({ ...o, [k]: v }));
  const staff = SU.STAFF.filter(s => s.slug === slug);
  const custs = SU.CUSTOMERS.filter(c => c.slug === slug);
  const tabs = [["Översikt", "grid"], ["Data", "layers"], ["Personal", "scissors"], ["Branding", "palette"], ["Integrationer", "link"], ["Drift", "shield"]];
  const tone = window.statusTone(suspended ? "Pausad" : t.status === "Pausad" ? "Aktiv" : t.status);

  return (
    <div>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid var(--c-line)", background: "var(--c-paper)", color: "var(--c-ink-2)", borderRadius: 10, padding: "8px 13px", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600 }}><Icon name="arrowLeft" size={16} /> Salonger</button>
        <span className="small">/ {t.slug}.corevo.se</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: t.dot, color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 26 }}>{t.name[0]}</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h1 className="h1" style={{ margin: 0, whiteSpace: "nowrap" }}>{t.name}</h1>
              <Badge tone={suspended ? "warning" : tone}>{suspended ? "Pausad" : t.status}</Badge>
            </div>
            <div className="small" style={{ marginTop: 5, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span><Icon name="location2" size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> {t.city}</span>
              <span><Icon name="clock" size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> senast aktiv {t.lastActive}</span>
              <span>skapad {t.created}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button variant="ghost" icon="external">Öppna storefront</Button>
          <Button variant="ghost" icon="mail" onClick={() => actions.notify(`Lösenordsreset skickad till ${t.ownerEmail}`, "info", "mail")}>Lösenordsreset</Button>
          <Button variant="primary" icon="shield" onClick={() => onAssist && onAssist(base.slug, base.name)}>Hjälp salongen</Button>
        </div>
      </div>

      <SubTabs tabs={tabs} active={tab} onPick={setTab} />

      {tab === "Översikt" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, alignItems: "start" }} className="bo-2col">
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }} className="bo-stat-grid">
              <Stat label="Bokningar" value={t.bookings} icon="calendar" />
              <Stat label="Completade" value={t.completed} icon="checkCircle" />
              <Stat label="Kunder" value={t.customers} icon="users" />
              <Stat label="Personal" value={t.staff} icon="scissors" />
            </div>
            <Card>
              <h2 className="h2" style={{ marginBottom: 14 }}>Onboarding-stege</h2>
              <div style={{ display: "grid", gap: 10 }}>
                {SU.ONBOARD_STEPS.map((s, i) => {
                  const done = i < base.onboardStep; const cur = i === base.onboardStep;
                  return (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12, opacity: s.locked ? 0.6 : 1 }}>
                      <span style={{ width: 24, height: 24, borderRadius: 999, background: done ? "var(--c-success)" : cur ? "var(--c-gold)" : "var(--c-paper-2)", color: done || cur ? "#fff" : "var(--c-ink-3)", display: "grid", placeItems: "center", flex: "none", fontSize: 12, fontWeight: 700 }}>{done ? <Icon name="check" size={14} /> : i + 1}</span>
                      <div style={{ flex: 1 }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.label}</span><span style={{ fontSize: 12, color: "var(--c-ink-3)", marginLeft: 8 }}>{s.hint}</span></div>
                      {s.locked && <Badge tone="neutral" dot={false}>Spärrat</Badge>}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            <Card>
              <div className="eyebrow" style={{ marginBottom: 12 }}>Ägare</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 999, background: "var(--c-forest)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 600, fontSize: 17 }}>{t.owner[0]}</div>
                <div><div style={{ fontWeight: 600, fontSize: 15 }}>{t.owner}</div><div style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>Salongsägare</div></div>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                <KV label="E-post" value={t.ownerEmail} />
                <KV label="Telefon" value={t.ownerPhone} mono />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <Button variant="subtle" size="sm" icon="mail" onClick={() => actions.notify(`Lösenordsreset skickad till ${t.ownerEmail}`, "info", "mail")} style={{ flex: 1, justifyContent: "center" }}>Reset</Button>
                <Button variant="subtle" size="sm" icon="copy" onClick={() => actions.notify("E-post kopierad", "info", "copy")}>Kopiera</Button>
              </div>
            </Card>
            <Card style={{ background: "var(--c-paper-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><Icon name="sparkle" size={15} style={{ color: "var(--c-gold-600)" }} /><span style={{ fontWeight: 600, fontSize: 13.5 }}>Anpassningsnivå {base.level}</span></div>
              <p style={{ fontSize: 12.5, color: "var(--c-ink-2)", lineHeight: 1.5, margin: 0 }}>{base.hueNote}</p>
            </Card>
          </div>
        </div>
      )}

      {tab === "Data" && (
        <div style={{ maxWidth: 720, display: "grid", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 16px", background: "var(--c-info-bg)", borderRadius: 12 }}>
            <Icon name="layers" size={17} style={{ color: "var(--c-info)", flex: "none" }} />
            <span style={{ fontSize: 13, color: "var(--c-ink)" }}>Redigera tenant-data direkt — inget klick i rå Supabase. <b>Inga måste-fält</b>, allt sparas utan deploy.</span>
          </div>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}><h2 className="h2">Grunddata</h2><TableChip>tenants</TableChip></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {tnField("Salongsnamn", t.name, v => set("name", v))}
              {tnField("Subdomän", t.slug, v => set("slug", v), `${t.slug}.corevo.se`)}
              {tnField("Stad", t.city, v => set("city", v))}
              {tnField("Ägarens e-post", t.ownerEmail, v => set("ownerEmail", v))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
              <Button variant="ghost" icon="undo" onClick={() => setT({ ...base })}>Återställ</Button>
              <Button variant="primary" icon="check" onClick={() => actions.notify("Tenant-data sparad — slår igenom direkt", "success", "check")}>Spara</Button>
            </div>
          </Card>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}><h2 className="h2">Recensioner & länkar</h2><TableChip>tenant_settings.review_link</TableChip></div>
            {tnField("Google-recensionslänk", t.reviewLink, v => set("reviewLink", v), "Visas i kundportal + bokningsbekräftelse.")}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}><Button variant="primary" size="sm" icon="link" onClick={() => actions.notify("Recensionslänk sparad", "success", "link")}>Spara länk</Button></div>
          </Card>
          <Card pad={0}>
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 className="h2">Kunder ({t.customers})</h2><TableChip>customers · identitet/PII</TableChip></div>
            <Table cols={["Namn", "Roll", "Auth", "Besök", "Status"]}
              rows={custs.map(c => [<b style={{ fontWeight: 600 }}>{c.name}</b>, c.role, <span style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>{c.auth}</span>, <span className="num">{c.visits}</span>, <Badge tone={c.status === "Aktiv" ? "success" : c.status === "Gäst" ? "neutral" : "info"} dot={false}>{c.status}</Badge>])} />
          </Card>
        </div>
      )}

      {tab === "Personal" && (
        <div style={{ maxWidth: 760, display: "grid", gap: 16 }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <h2 className="h2">Bjud in personal åt salongen</h2><TableChip>staff · magic-link invite</TableChip>
            </div>
            <p className="small" style={{ marginBottom: 14 }}>Frisören får en engångs-länk → bekräftar → sätter eget lösenord → inne med rätt roll direkt.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <input placeholder="frisor@salong.se" style={{ flex: 1, minWidth: 220, padding: "11px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, outline: "none" }} />
              <select style={{ padding: "11px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--c-ink)", cursor: "pointer" }}>
                <option>Frisör</option><option>Barber</option><option>Salongschef</option>
              </select>
              <Button variant="primary" icon="mail" onClick={() => actions.notify("Invite skickad — magic-link på väg", "info", "mail")}>Skicka invite</Button>
            </div>
          </Card>
          <Card pad={0}>
            <div style={{ padding: "16px 20px" }}><h2 className="h2">Personal · {staff.length}</h2></div>
            <Table cols={["Namn", "Roll", "E-post", "Tjänster", "Status"]}
              rows={staff.map(s => [
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 30, height: 30, borderRadius: 999, background: "var(--c-forest)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{s.name[0]}</span><b style={{ fontWeight: 600 }}>{s.name}</b></span>,
                s.role, <span style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>{s.email}</span>,
                <span className="num">{s.services} st</span>,
                <Badge tone={s.status === "Aktiv" ? "success" : s.status === "Inbjuden" ? "info" : "warning"} dot={false}>{s.status}</Badge>,
              ])} />
            {staff.length === 0 && <div style={{ padding: 26, textAlign: "center", color: "var(--c-ink-3)", fontSize: 13.5 }}>Ingen personal ännu — bjud in första frisören ovan.</div>}
          </Card>
        </div>
      )}

      {tab === "Branding" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16, alignItems: "start" }} className="bo-2col">
          <div style={{ display: "grid", gap: 16 }}>
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span className="eyebrow">Leksakslådan · no-code</span></div>
              <p className="small" style={{ marginBottom: 16 }}>Token-branding (färg/font/logo + temamall). Slår igenom på storefronten utan deploy.</p>
              <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Temamall</div>
                <select value={t.theme} onChange={e => set("theme", e.target.value)} style={{ width: "100%", padding: "11px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--c-ink)", cursor: "pointer" }}>{Object.keys(window.THEMES).map(k => <option key={k}>{k}</option>)}</select>
              </div>
              <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Primärfärg</div>
                <div style={{ display: "flex", gap: 9 }}>{["#5E7361", "#7E6E92", "#C8743C", "#B0693F", "#3A3733"].map(c => <button key={c} onClick={() => set("dot", c)} style={{ width: 34, height: 34, borderRadius: 9, background: c, cursor: "pointer", border: t.dot === c ? "2px solid var(--c-forest)" : "2px solid var(--c-paper)", boxShadow: "0 0 0 1px var(--c-line)" }} />)}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <Button variant="ghost" icon="undo" size="sm" onClick={() => setT({ ...base })}>Ångra</Button>
                <Button variant="primary" icon="check" size="sm" onClick={() => actions.notify("Branding publicerad — live på storefronten", "success", "palette")}>Publicera</Button>
              </div>
            </Card>
            <Card style={{ background: "var(--c-paper-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><Icon name="alert" size={15} style={{ color: "var(--c-warning)" }} /><span style={{ fontWeight: 600, fontSize: 13.5 }}>Nivå-3 = kod, inte här</span></div>
              <p style={{ fontSize: 12.5, color: "var(--c-ink-2)", lineHeight: 1.5, margin: 0 }}>Scoped CSS-overrides (premium-design) görs i säker miljö med kod — aldrig via no-code-UI. Det här är token-lagret.</p>
            </Card>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><Icon name="eye" size={15} style={{ color: "var(--c-gold-600)" }} /><span className="eyebrow">Live-förhandsvisning</span></div>
            <ThemePreview name={t.theme} salon={t.name} />
          </div>
        </div>
      )}

      {tab === "Integrationer" && (
        <div style={{ maxWidth: 720, display: "grid", gap: 12 }}>
          {[
            ["Stripe Connect", t.stripe, "#635BFF", "S", "Betalning vid bokning · utbetalning veckovis", t.stripe === "Ansluten"],
            ["Google-recensioner", t.reviewLink !== "—" ? "Satt" : "Ej satt", "#EA4335", "G", t.reviewLink !== "—" ? t.reviewLink : "Ingen länk satt", t.reviewLink !== "—"],
            ["SMS (46elks)", t.sms, "#1F4636", "S", "Bekräftelse + påminnelse 24h innan", t.sms === "På"],
            ["Domän", t.domainStatus, "#F38020", "C", t.domain === "egen domän" ? "Egen domän (parkerat spår)" : "Subdomän .corevo.se", t.domainStatus === "Aktiv"],
          ].map(([name, status, color, letter, desc, ok]) => (
            <Card key={name}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: color, color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 17, flex: "none" }}>{letter}</div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14.5 }}>{name}</div><div style={{ fontSize: 12.5, color: "var(--c-ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{desc}</div></div>
                <Badge tone={ok ? "success" : "warning"}>{status}</Badge>
                <Button variant="ghost" size="sm" icon="settings">Hantera</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {tab === "Drift" && (
        <div style={{ maxWidth: 720, display: "grid", gap: 16 }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ paddingRight: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{suspended ? "Salongen är pausad" : "Salongen är aktiv"}</div>
                <div style={{ fontSize: 13, color: "var(--c-ink-3)", marginTop: 3 }}>{suspended ? "Publik storefront är blockerad. Data är orörd och går att återaktivera." : "Pausa → publik storefront blockeras direkt. Data rörs aldrig."}</div>
              </div>
              <Button variant={suspended ? "primary" : "danger"} icon={suspended ? "check" : "pause"} onClick={() => { setSuspended(!suspended); actions.notify(suspended ? `${t.name} återaktiverad` : `${t.name} suspenderad — publik blockerad`, suspended ? "success" : "warning", suspended ? "check" : "pause"); }}>{suspended ? "Återaktivera" : "Suspendera"}</Button>
            </div>
          </Card>
          <Card pad={0}>
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 className="h2">Audit-logg</h2><TableChip>audit_log</TableChip></div>
            <div style={{ padding: "0 12px 12px" }}>
              {SU.AUDIT.filter(a => a.target.includes(t.name) || a.target.includes(t.slug)).concat(SU.AUDIT.slice(0, 2)).slice(0, 5).map((a, i) => {
                const at = { info: "var(--c-info)", success: "var(--c-success)", warning: "var(--c-warning)", danger: "var(--c-danger)", neutral: "var(--c-ink-3)" }[a.tone];
                return (
                  <div key={i} style={{ display: "flex", gap: 11, padding: "10px" }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--c-paper-2)", color: at, display: "grid", placeItems: "center", flex: "none" }}><Icon name={a.icon} size={15} /></span>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{a.action}</div><div style={{ fontSize: 11.5, color: "var(--c-ink-3)" }}>{a.actor} · {a.target}</div></div>
                    <span style={{ fontSize: 11, color: "var(--c-ink-3)" }}>{a.at}</span>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card style={{ border: "1px solid var(--c-danger-bg)", background: "color-mix(in srgb, var(--c-danger-bg) 40%, var(--c-paper))" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Icon name="shield" size={16} style={{ color: "var(--c-danger)" }} /><span style={{ fontWeight: 600, fontSize: 14, color: "var(--c-ink)" }}>Riskzon · skyddad av audit-guard</span></div>
            <p style={{ fontSize: 12.5, color: "var(--c-ink-2)", lineHeight: 1.5, margin: "0 0 12px" }}>Radering av skyddade rader blockeras med flit (build-once-never-delete). Suspendera istället för att radera.</p>
            <Button variant="danger" icon="trash" onClick={() => actions.notify("Blockerad av audit-guard — skyddad rad raderas aldrig", "danger", "shield")}>Försök radera tenant</Button>
          </Card>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { SuperTenantDetail });
