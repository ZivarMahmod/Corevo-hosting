/* Super admin — DATA & DRIFT: Kunder + Personal (M7 §2.1B / §2.4).
   "Det Zivar vill slippa: klicka i råa Supabase." Här exponeras de
   operativa uppgifterna no-code: välja/lägga till kund, lösenordsreset,
   onboarda personal åt en salong (magic-link). private.tenant_id()
   isolerar — Zivar kringgår med super-access. */
const { useState: useStateSD } = React;

function SuperCustomers() {
  const { actions } = useStore();
  const SU = window.SU;
  const [q, setQ] = useStateSD("");
  const [tenant, setTenant] = useStateSD("Alla");
  const [sel, setSel] = useStateSD(null);
  const [adding, setAdding] = useStateSD(false);
  const tenants = ["Alla", ...Object.values(SU.TENANTS).map(t => t.name)];
  const list = SU.CUSTOMERS.filter(c => (tenant === "Alla" || c.tenant === tenant) && (c.name + c.email + c.tenant).toLowerCase().includes(q.toLowerCase()));
  const selC = SU.CUSTOMERS.find(c => c.id === sel);
  const roleTone = r => r === "Ägare" ? "gold" : r === "Gäst" ? "neutral" : "info";

  return (
    <div>
      <PageHead eyebrow="Data & drift" title="Kunder"
        sub="Sök vem som helst tvärs alla salonger. Allt du brukade klicka i rå Supabase — här, no-code.">
        <Button variant="ghost" icon="upload">Exportera</Button>
        <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Lägg till kund</Button>
      </PageHead>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 18 }} className="bo-stat-grid">
        <Stat label="Användare totalt" value="3 087" icon="users" />
        <Stat label="Ägare" value={SU.CUSTOMERS.filter(c => c.role === "Ägare").length + " / 24"} icon="user" />
        <Stat label="Gästbokningar" value="412" icon="bookmark" hint="stabil gäst-nyckel" />
        <Stat label="Reset (7 dgr)" value="9" icon="mail" hint="lösenord" />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--c-ink-3)" }}><Icon name="search" size={16} /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Sök namn, e-post, salong…" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        <select value={tenant} onChange={e => setTenant(e.target.value)} style={{ padding: "10px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--c-ink)", cursor: "pointer" }}>{tenants.map(t => <option key={t}>{t}</option>)}</select>
      </div>

      <Card pad={0}>
        <Table cols={["Namn", "Salong", "Roll", "Auth", "Senast inloggad", "Status"]} onRow={i => setSel(list[i].id)}
          rows={list.map(c => [
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 30, height: 30, borderRadius: 999, background: "var(--c-forest)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700, flex: "none" }}>{c.name[0]}</span><span><b style={{ fontWeight: 600 }}>{c.name}</b><div style={{ fontSize: 12, color: "var(--c-ink-3)" }}>{c.email}</div></span></span>,
            c.tenant, <Badge tone={roleTone(c.role)} dot={false}>{c.role}</Badge>,
            <span style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>{c.auth}</span>,
            <span style={{ fontSize: 12.5, color: "var(--c-ink-2)" }}>{c.lastLogin}</span>,
            <Badge tone={c.status === "Aktiv" ? "success" : c.status === "Pausad" ? "warning" : c.status === "Gäst" ? "neutral" : "info"} dot={false}>{c.status}</Badge>,
          ])} />
      </Card>

      {/* detail drawer */}
      <Drawer open={!!selC} onClose={() => setSel(null)} width={460}
        title={selC ? selC.name : ""} sub={selC ? selC.tenant : ""}
        accent={selC && <div style={{ marginBottom: 8 }}><Badge tone={roleTone(selC.role)} dot={false}>{selC.role}</Badge></div>}
        footer={selC && (
          <>
            <Button variant="primary" icon="mail" onClick={() => { actions.notify(`Lösenordsreset skickad till ${selC.email}`, "info", "mail"); }} style={{ flex: 1, justifyContent: "center" }}>Skicka lösenordsreset</Button>
          </>
        )}>
        {selC && (
          <div style={{ display: "grid", gap: 18 }}>
            <section>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Konto</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
                <KV label="E-post" value={selC.email} />
                <KV label="Telefon" value={selC.phone} mono />
                <KV label="Auth-metod" value={selC.auth} />
                <KV label="Besök" value={<span className="num">{selC.visits}</span>} />
              </div>
            </section>
            <section style={{ background: "var(--c-paper-2)", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}><Icon name="shield" size={15} style={{ color: "var(--c-info)" }} /><span style={{ fontWeight: 600, fontSize: 13.5 }}>Operativa åtgärder</span><TableChip>auth.users</TableChip></div>
              <div style={{ display: "grid", gap: 8 }}>
                <Button variant="subtle" icon="mail" onClick={() => actions.notify(`Lösenordsreset skickad till ${selC.email}`, "info", "mail")} style={{ justifyContent: "flex-start" }}>Skicka lösenordsreset</Button>
                <Button variant="subtle" icon="repeat" onClick={() => actions.notify("Magic-link skickad", "info", "link")} style={{ justifyContent: "flex-start" }}>Skicka ny magic-link</Button>
                <Button variant="subtle" icon="copy" onClick={() => actions.notify("E-post kopierad", "info", "copy")} style={{ justifyContent: "flex-start" }}>Kopiera e-post</Button>
              </div>
            </section>
            <div style={{ fontSize: 12, color: "var(--c-ink-3)", display: "flex", gap: 8, alignItems: "flex-start" }}><Icon name="info" size={14} style={{ flex: "none", marginTop: 1 }} /> Varje åtgärd loggas i audit-loggen med dig som aktör.</div>
          </div>
        )}
      </Drawer>

      {/* add customer drawer */}
      <Drawer open={adding} onClose={() => setAdding(false)} width={440} title="Lägg till kund" sub="Inget fält är tvingande — fyll det du vet."
        footer={<>
          <Button variant="ghost" onClick={() => setAdding(false)} style={{ flex: 1, justifyContent: "center" }}>Avbryt</Button>
          <Button variant="primary" icon="check" onClick={() => { setAdding(false); actions.notify("Kund tillagd — stabil kund-rad skapad", "success", "check"); }} style={{ flex: 1, justifyContent: "center" }}>Skapa kund</Button>
        </>}>
        <div style={{ display: "grid", gap: 14 }}>
          <Field label="Namn" ph="För- och efternamn" />
          <Field label="E-post" ph="kund@mail.se (valfritt)" />
          <Field label="Telefon" ph="070-000 00 00 (valfritt)" />
          <div><label style={{ fontSize: 13, fontWeight: 600 }}>Salong</label>
            <select style={{ width: "100%", marginTop: 6, padding: "11px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--c-ink)", cursor: "pointer" }}>{Object.values(SU.TENANTS).map(t => <option key={t.slug}>{t.name}</option>)}</select>
          </div>
          <div style={{ marginTop: 2 }}><TableChip>customers · stabil id</TableChip></div>
        </div>
      </Drawer>
    </div>
  );
}

function SuperStaff() {
  const { actions } = useStore();
  const SU = window.SU;
  const [q, setQ] = useStateSD("");
  const [status, setStatus] = useStateSD("Alla");
  const [inviting, setInviting] = useStateSD(false);
  const statuses = ["Alla", "Aktiv", "Inbjuden", "Väntar bekräftelse"];
  const list = SU.STAFF.filter(s => (status === "Alla" || s.status === status) && (s.name + s.email + s.tenant).toLowerCase().includes(q.toLowerCase()));
  const stTone = s => s === "Aktiv" ? "success" : s === "Inbjuden" ? "info" : "warning";

  return (
    <div>
      <PageHead eyebrow="Data & drift" title="Personal"
        sub="Onboarda frisörer åt salonger som vill ha hjälp. Magic-link-invite — rätt roll tilldelas direkt.">
        <Button variant="primary" icon="mail" onClick={() => setInviting(true)}>Bjud in personal</Button>
      </PageHead>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 18 }} className="bo-stat-grid">
        <Stat label="Personal totalt" value={SU.STAFF.length + 32} icon="scissors" />
        <Stat label="Aktiva" value={SU.STAFF.filter(s => s.status === "Aktiv").length + 30} icon="checkCircle" />
        <Stat label="Väntar invite" value={SU.STAFF.filter(s => s.status !== "Aktiv").length} icon="mail" hint="magic-link" />
        <Stat label="Salonger" value="24" icon="building" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 16px", background: "var(--c-warning-bg)", borderRadius: 12, marginBottom: 16 }}>
        <Icon name="alert" size={17} style={{ color: "var(--c-warning)", flex: "none" }} />
        <span style={{ fontSize: 13, color: "var(--c-ink)" }}>Invite-vägen kräver <span className="num" style={{ fontWeight: 600 }}>SERVICE_ROLE_KEY</span> som Worker-secret — kod-klar men overifierad. Verifiera i bygget.</span>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--c-ink-3)" }}><Icon name="search" size={16} /></span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Sök personal, salong…" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        </div>
        {statuses.map(f => (
          <button key={f} onClick={() => setStatus(f)} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid var(--c-line)", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, background: status === f ? "var(--c-forest)" : "var(--c-paper)", color: status === f ? "#fff" : "var(--c-ink-2)" }}>{f}</button>
        ))}
      </div>

      <Card pad={0}>
        <Table cols={["Namn", "Salong", "Roll", "Tjänster", "Inbjuden", "Status", ""]}
          rows={list.map(s => [
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ width: 30, height: 30, borderRadius: 999, background: "var(--c-forest)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700, flex: "none" }}>{s.name[0]}</span><span><b style={{ fontWeight: 600 }}>{s.name}</b><div style={{ fontSize: 12, color: "var(--c-ink-3)" }}>{s.email}</div></span></span>,
            s.tenant, s.role, <span className="num">{s.services} st</span>,
            <span style={{ fontSize: 12.5, color: "var(--c-ink-2)" }}>{s.invited}</span>,
            <Badge tone={stTone(s.status)} dot={false}>{s.status}</Badge>,
            s.status !== "Aktiv"
              ? <button onClick={() => actions.notify(`Påminnelse skickad till ${s.email}`, "info", "mail")} style={{ border: "1px solid var(--c-line-strong)", background: "var(--c-paper)", color: "var(--c-forest)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600 }}>Påminn</button>
              : <Icon name="check" size={16} style={{ color: "var(--c-success)" }} />,
          ])} />
      </Card>

      <Drawer open={inviting} onClose={() => setInviting(false)} width={440} title="Bjud in personal" sub="Engångs-invite. Frisören sätter eget lösenord."
        footer={<>
          <Button variant="ghost" onClick={() => setInviting(false)} style={{ flex: 1, justifyContent: "center" }}>Avbryt</Button>
          <Button variant="primary" icon="mail" onClick={() => { setInviting(false); actions.notify("Invite skickad — magic-link på väg", "info", "mail"); }} style={{ flex: 1, justifyContent: "center" }}>Skicka invite</Button>
        </>}>
        <div style={{ display: "grid", gap: 14 }}>
          <Field label="E-post" ph="frisor@salong.se" />
          <Field label="Namn" ph="Valfritt — frisören kan fylla i själv" />
          <div><label style={{ fontSize: 13, fontWeight: 600 }}>Salong</label>
            <select style={{ width: "100%", marginTop: 6, padding: "11px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--c-ink)", cursor: "pointer" }}>{Object.values(SU.TENANTS).map(t => <option key={t.slug}>{t.name}</option>)}</select>
          </div>
          <div><label style={{ fontSize: 13, fontWeight: 600 }}>Roll</label>
            <select style={{ width: "100%", marginTop: 6, padding: "11px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--c-ink)", cursor: "pointer" }}><option>Frisör</option><option>Barber</option><option>Salongschef</option></select>
          </div>
          <div style={{ display: "flex", gap: 9, padding: "11px 13px", background: "var(--c-info-bg)", borderRadius: 10 }}><Icon name="info" size={15} style={{ color: "var(--c-info)", flex: "none", marginTop: 1 }} /><span style={{ fontSize: 12.5, color: "var(--c-ink)" }}>Magic-link = engångs-invite, inte löpande login. Rätt roll/access tilldelas direkt.</span></div>
        </div>
      </Drawer>
    </div>
  );
}

Object.assign(window, { SuperCustomers, SuperStaff });
