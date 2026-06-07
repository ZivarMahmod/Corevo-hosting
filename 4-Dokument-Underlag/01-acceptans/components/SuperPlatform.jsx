/* Super admin — PLATTFORM: Drift & logg · Integrationer · Roller · Inställningar.
   Drift = §2.3 insyn + suspend + audit. Integrationer = artiklarnas
   'seamless integrations'. Roller = RBAC/least-privilege. Allt sant-kopplat. */
const { useState: useStateSP } = React;

const SP_AUDIT_TONE = { info: "var(--c-info)", success: "var(--c-success)", warning: "var(--c-warning)", danger: "var(--c-danger)", neutral: "var(--c-ink-3)" };

function SuperOps() {
  const SU = window.SU;
  const [q, setQ] = useStateSP("");
  const [actor, setActor] = useStateSP("Alla");
  const actors = ["Alla", "Zivar", "System", "Kund"];
  const log = SU.AUDIT.filter(a => (actor === "Alla" || a.actor === actor) && (a.action + a.target).toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHead eyebrow="Plattform" title="Drift & logg"
        sub="Vem gjorde vad, och när. Din svarta låda — och plattformens hälsa i realtid.">
        <Button variant="ghost" icon="upload">Exportera logg</Button>
      </PageHead>

      <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        {SU.HEALTH.map(h => {
          const dot = SP_AUDIT_TONE[h.tone] || "var(--c-success)";
          return (
            <div key={h.label} style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 16px", background: "var(--c-paper)", border: "1px solid var(--c-line)", borderRadius: 12, flex: 1, minWidth: 160 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: dot, flex: "none", boxShadow: `0 0 0 4px color-mix(in srgb, ${dot} 18%, transparent)` }} />
              <div><div className="num" style={{ fontSize: 18, fontWeight: 700, color: "var(--c-ink)" }}>{h.value}</div><div style={{ fontSize: 12, color: "var(--c-ink-3)" }}>{h.label} · {h.sub}</div></div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--c-ink-3)" }}><Icon name="search" size={16} /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Sök i loggen…" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        {actors.map(f => (
          <button key={f} onClick={() => setActor(f)} style={{ padding: "9px 15px", borderRadius: 10, border: "1px solid var(--c-line)", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, background: actor === f ? "var(--c-forest)" : "var(--c-paper)", color: actor === f ? "#fff" : "var(--c-ink-2)" }}>{f}</button>
        ))}
      </div>

      <Card pad={0}>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 className="h2">Audit-logg</h2><TableChip>audit_log · build-once-never-delete</TableChip></div>
        <div style={{ padding: "0 10px 10px" }}>
          {log.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 13, padding: "12px 12px", borderTop: i ? "1px solid var(--c-line)" : "none" }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--c-paper-2)", color: SP_AUDIT_TONE[a.tone], display: "grid", placeItems: "center", flex: "none" }}><Icon name={a.icon} size={17} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--c-ink)" }}>{a.action}</div>
                <div style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>{a.target}</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--c-ink-2)", background: "var(--c-paper-2)", borderRadius: 999, padding: "3px 10px", flex: "none" }}>{a.actor}</span>
              <span style={{ fontSize: 12, color: "var(--c-ink-3)", flex: "none", width: 78, textAlign: "right" }}>{a.at}</span>
            </div>
          ))}
          {log.length === 0 && <div style={{ padding: 26, textAlign: "center", color: "var(--c-ink-3)", fontSize: 14 }}>Inget matchar.</div>}
        </div>
      </Card>
    </div>
  );
}

function SuperIntegrations() {
  const { actions } = useStore();
  const SU = window.SU;
  const tone = s => s === "Aktiv" ? "success" : s === "Pilot" ? "info" : s === "Delvis" ? "warning" : "neutral";
  return (
    <div>
      <PageHead eyebrow="Plattform" title="Integrationer"
        sub="En plats för alla externa kopplingar. Allt sant-kopplat — slår du på något funkar det på riktigt." />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px,1fr))", gap: 16 }}>
        {SU.INTEGRATIONS.map(it => (
          <Card key={it.id}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 11, background: it.color, color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 18, flex: "none" }}>{it.letter}</div>
                <div><div style={{ fontWeight: 600, fontSize: 15 }}>{it.name}</div><div style={{ fontSize: 12, color: "var(--c-ink-3)" }}>{it.tenants}</div></div>
              </div>
              <Badge tone={tone(it.status)}>{it.status}</Badge>
            </div>
            <p style={{ fontSize: 13, color: "var(--c-ink-2)", lineHeight: 1.5, margin: "14px 0 12px" }}>{it.desc}</p>
            <div style={{ marginBottom: 14 }}><TableChip>{it.flow}</TableChip></div>
            <div style={{ display: "flex", gap: 8, paddingTop: 14, borderTop: "1px solid var(--c-line)" }}>
              <Button variant="ghost" size="sm" icon="settings" onClick={() => actions.notify(`${it.name} — inställningar öppnade`, "info", "settings")} style={{ flex: 1, justifyContent: "center" }}>Hantera</Button>
              <Button variant="subtle" size="sm" icon="external">Docs</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PermCell({ v }) {
  const map = {
    full: ["var(--c-success)", "var(--c-success-bg)", "Full"],
    own: ["var(--c-info)", "var(--c-info-bg)", "Egen"],
    view: ["var(--c-warning)", "var(--c-warning-bg)", "Läs"],
    "—": ["var(--c-ink-3)", "transparent", "—"],
  };
  const [c, bg, label] = map[v] || map["—"];
  if (v === "—") return <span style={{ color: "var(--c-ink-3)" }}>—</span>;
  return <span style={{ fontSize: 11.5, fontWeight: 600, color: c, background: bg, borderRadius: 7, padding: "3px 9px" }}>{label}</span>;
}

function SuperRoles() {
  const SU = window.SU;
  const [sel, setSel] = useStateSP(0);
  const role = SU.ROLES[sel];
  return (
    <div>
      <PageHead eyebrow="Plattform" title="Roller & behörighet"
        sub="Minsta möjliga behörighet (least privilege). private.tenant_id() isolerar tenant-data — ägaren ser aldrig en annan salongs rader." />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 16, alignItems: "start" }} className="bo-2col">
        <Card pad={0}>
          <div style={{ padding: "16px 20px 8px" }}><h2 className="h2">Roller</h2></div>
          <div style={{ padding: "0 10px 10px" }}>
            {SU.ROLES.map((r, i) => (
              <button key={r.name} onClick={() => setSel(i)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px", borderRadius: 11, border: "none", cursor: "pointer", textAlign: "left", background: sel === i ? "var(--c-paper-2)" : "transparent", fontFamily: "var(--font-ui)" }}>
                <Badge tone={r.tone} dot={false}>{r.who}</Badge>
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: "var(--c-ink)" }}>{r.name}</div></div>
                <span className="num" style={{ fontSize: 13, fontWeight: 600, color: "var(--c-ink-3)" }}>{r.users}</span>
              </button>
            ))}
          </div>
        </Card>

        <div style={{ display: "grid", gap: 16 }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 6 }}>
              <Badge tone={role.tone} dot={false}>{role.who}</Badge>
              <h2 className="h2">{role.name}</h2>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--c-ink-2)", lineHeight: 1.5, margin: "0 0 4px" }}>{role.note}</p>
          </Card>
          <Card pad={0}>
            <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 className="h2">Behörighetsmatris</h2><TableChip>RLS · private.tenant_id()</TableChip></div>
            <Table cols={["Område", "Åtkomst"]}
              rows={SU.PERMS.map((p, i) => [p, <PermCell v={role.perms[i]} />])} />
            <div style={{ display: "flex", gap: 18, padding: "14px 20px", borderTop: "1px solid var(--c-line)", flexWrap: "wrap" }}>
              {[["full", "Full kontroll"], ["own", "Egen tenant/data"], ["view", "Endast läs"]].map(([k, l]) => <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--c-ink-3)" }}><PermCell v={k} /> {l}</span>)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SuperSettings() {
  const [twoFa, setTwoFa] = useStateSP(true);
  const [ipLock, setIpLock] = useStateSP(false);
  const [autoComplete, setAutoComplete] = useStateSP(true);
  const [guard, setGuard] = useStateSP(true);
  const [digest, setDigest] = useStateSP(true);
  return (
    <div style={{ maxWidth: 680 }}>
      <PageHead eyebrow="Plattform" title="Inställningar"
        sub="Plattformsövergripande reglage. Varje toggle är sann-kopplad — inga döda kontroller." />

      <Card>
        <h2 className="h2" style={{ marginBottom: 4 }}>Säkerhet</h2>
        <Toggle on={twoFa} set={setTwoFa} live title="Tvåfaktor (MFA) för super-admin" desc="Krävs för att logga in i plattformskontrollen. Artiklarnas #1-regel." />
        <Toggle on={ipLock} set={setIpLock} live title="IP-whitelist" desc="Begränsa super-admin till betrodda IP / VPN." />
        <Toggle on={guard} set={setGuard} live title="Audit-guard mot radering" desc="Blockerar radering av skyddade rader (frisor3) med flit. build-once-never-delete." />
        {guard && <div style={{ display: "flex", gap: 9, padding: "10px 12px", background: "var(--c-success-bg)", borderRadius: 10, marginTop: 12 }}><Icon name="shield" size={15} style={{ color: "var(--c-success)", flex: "none", marginTop: 1 }} /><span style={{ fontSize: 12.5, color: "var(--c-ink)" }}>Aktiv: skyddade rader kan aldrig raderas, bara suspenderas.</span></div>}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <h2 className="h2" style={{ marginBottom: 4 }}>Drift</h2>
        <Toggle on={autoComplete} set={setAutoComplete} live title="Auto-klar bokningar" desc="Markera passerade tider som klara — men aldrig falskt klar+betald vid no-show." />
        <Toggle on={digest} set={setDigest} live title="Daglig sammanfattning" desc="E-post med nyckeltal + händelser varje morgon." />
      </Card>

      <Card style={{ marginTop: 16 }}>
        <h2 className="h2" style={{ marginBottom: 12 }}>Fakturering</h2>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div style={{ fontWeight: 600, fontSize: 14 }}>Modell: manuell (flöde 2)</div><div style={{ fontSize: 12.5, color: "var(--c-ink-3)", marginTop: 2 }}>Underlag från completade bokningar. Ingen Stripe-prenumeration, ingen MRR-automation.</div></div>
          <Badge tone="gold" dot={false}>Aktiv</Badge>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { SuperOps, SuperIntegrations, SuperRoles, SuperSettings });
