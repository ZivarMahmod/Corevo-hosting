/* Salong-admin — Personal (M6 §3.4) + Inställningar (M6 §3.7).
   Personal: mer frisör-info + speglar verklig dag (samma bokningar som M5).
   Inställningar: varje toggle är sann-kopplad — inga döda toggles.        */
const { useState: useStateSt } = React;

function SalonStaff() {
  const { bookings, actions } = useStore();
  const { STAFF, custName, CUSTOMERS } = window.BO;
  const [sel, setSel] = useStateSt(null);
  const [accounts, setAccounts] = useStateSt({ st1: true, st2: false, st3: true });
  const toggleAcct = id => setAccounts(a => { const n = !a[id]; actions.notify(n ? "Invite skickad — frisören får eget konto + egen vy" : "Eget konto stängt — hanteras i salongens sida", n ? "info" : "neutral", n ? "mail" : "user"); return { ...a, [id]: n }; });
  const dayOf = id => bookings.filter(b => b.staffId === id && b.status !== "avbokad").sort((a, b) => a.time.localeCompare(b.time));
  const selS = STAFF.find(s => s.id === sel);

  return (
    <div>
      <PageHead eyebrow="Studio Salvia" title="Personal"
        sub="Varje frisörs riktiga dag — speglad live. Ge dem ett eget konto med egen vy, eller hantera dem härifrån.">
        <Button variant="primary" icon="plus">Lägg till</Button>
      </PageHead>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
        {STAFF.map(s => {
          const day = dayOf(s.id);
          const hasAcct = accounts[s.id];
          return (
            <Card key={s.id} onClick={() => setSel(s.id)} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <div style={{ width: 48, height: 48, borderRadius: 999, background: s.color, color: "#fff", display: "grid", placeItems: "center", fontWeight: 600, fontSize: 18, flex: "none" }}>{s.name[0]}</div>
                <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 600, fontSize: 15 }}>{s.name}</div><div style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>{s.role}</div></div>
                <Badge tone={hasAcct ? "success" : "neutral"} dot={false}>{hasAcct ? "Eget konto" : "Hanteras här"}</Badge>
              </div>
              <p style={{ fontSize: 13, color: "var(--c-ink-2)", lineHeight: 1.5, margin: "14px 0 0" }}>{s.bio}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>{s.specialties.map(sp => <span key={sp} style={{ fontSize: 12, background: "var(--c-paper-2)", borderRadius: 999, padding: "4px 10px", color: "var(--c-ink-2)" }}>{sp}</span>)}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--c-line)" }}>
                <span style={{ fontSize: 12.5, color: "var(--c-ink-3)", display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="location2" size={14} /> {s.location} · v.{s.week}</span>
                <span className="num" style={{ fontSize: 13, fontWeight: 600, color: "var(--c-forest)" }}>{day.length} idag</span>
              </div>
            </Card>
          );
        })}
      </div>

      <DetailModal open={!!selS} onClose={() => setSel(null)} width={460}
        title={selS ? selS.name : ""} sub={selS ? selS.role : ""}>
        {selS && (
          <div style={{ display: "grid", gap: 20 }}>
            <section>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Om</div>
              <p style={{ fontSize: 13.5, color: "var(--c-ink-2)", lineHeight: 1.6, margin: 0 }}>{selS.bio}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>{selS.specialties.map(sp => <Badge key={sp}>{sp}</Badge>)}</div>
            </section>

            {/* eget konto · egen vy — annars hanteras i salongens sida */}
            <section style={{ background: accounts[selS.id] ? "var(--c-success-bg)" : "var(--c-paper-2)", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                <div style={{ paddingRight: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}><Icon name="calendar" size={15} style={{ color: accounts[selS.id] ? "var(--c-success)" : "var(--c-ink-3)" }} /> Eget konto · egen vy</div>
                  <div style={{ fontSize: 12.5, color: "var(--c-ink-2)", marginTop: 4, lineHeight: 1.5 }}>{accounts[selS.id] ? "Frisören loggar in själv och får sin egen snabbvy — en kalender med bara sina tider." : "Hanteras i salongens sida. Slå på för att ge ett eget konto med egen kalender."}</div>
                </div>
                <button onClick={() => toggleAcct(selS.id)} style={{ width: 46, height: 26, borderRadius: 999, border: "none", cursor: "pointer", background: accounts[selS.id] ? "var(--c-forest)" : "var(--c-line-strong)", position: "relative", flex: "none" }}>
                  <span style={{ position: "absolute", top: 3, left: accounts[selS.id] ? 23 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left var(--dur-fast)", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
                </button>
              </div>
              {accounts[selS.id] && <div style={{ display: "flex", gap: 8, marginTop: 12 }}><Button variant="subtle" size="sm" icon="external" style={{ flex: 1, justifyContent: "center" }}>Öppna frisörens vy</Button><Button variant="subtle" size="sm" icon="mail">Ny magic-link</Button></div>}
            </section>

            {/* parked: multi-location reminder */}
            <div style={{ display: "flex", gap: 10, padding: "12px 14px", background: "var(--c-paper-2)", borderRadius: 12 }}>
              <Icon name="location2" size={16} style={{ color: "var(--c-ink-3)", flex: "none", marginTop: 1 }} />
              <span style={{ fontSize: 12.5, color: "var(--c-ink-2)" }}>Denna vecka på <b>{selS.location}</b>. Dela frisören mellan två salonger per vecka? Det kommer — bokningarna får aldrig krocka.</span>
            </div>

            <section>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Verklig dag · idag</div>
              <div style={{ display: "grid", gap: 8 }}>
                {dayOf(selS.id).length === 0 && <div style={{ fontSize: 13, color: "var(--c-ink-3)" }}>Inga bokningar idag.</div>}
                {dayOf(selS.id).map(b => {
                  const c = CUSTOMERS.find(x => x.id === b.customerId);
                  return (
                    <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: "var(--c-paper)", border: "1px solid var(--c-line)" }}>
                      <span className="num" style={{ width: 44, fontWeight: 700, color: "var(--c-forest)", fontSize: 14 }}>{b.time}</span>
                      <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{custName(c)}</div><div style={{ fontSize: 12, color: "var(--c-ink-3)" }}>{b.service}</div></div>
                      <StatusBadge status={b.status} paid={b.paid} />
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </DetailModal>
    </div>
  );
}

function SalonSettings() {
  const [confirm, setConfirm] = useStateSt(true);
  const [reminders, setReminders] = useStateSt(true);
  const [accounts, setAccounts] = useStateSt(true);
  const [dropin, setDropin] = useStateSt(false);
  const [payAtBooking, setPay] = useStateSt(true);

  return (
    <div style={{ maxWidth: 640 }}>
      <PageHead eyebrow="Studio Salvia" title="Inställningar"
        sub="Varje reglage är på riktigt kopplat. Slår du på något funkar funktionen — annars finns den inte här." />

      <Card>
        <h2 className="h2" style={{ marginBottom: 4 }}>Bokning</h2>
        <Toggle on={confirm} set={setConfirm} live title="Bokningsbekräftelse" desc="Kunden får en bekräftelse direkt vid bokning. Är den på skickas den på riktigt." />
        {confirm && <div style={{ display: "flex", gap: 9, padding: "10px 12px", background: "var(--c-success-bg)", borderRadius: 10, margin: "12px 0 4px" }}><Icon name="check" size={15} style={{ color: "var(--c-success)", flex: "none", marginTop: 1 }} /><span style={{ fontSize: 12.5, color: "var(--c-ink)" }}>Aktiv: bekräftelse via e-post + SMS testad och fungerande.</span></div>}
        <Toggle on={reminders} set={setReminders} live title="SMS-påminnelse" desc="Påminnelse 24 h innan bokad tid." />
        <Toggle on={accounts} set={setAccounts} live title="Kund-konton" desc="Kunder kan logga in, se och omboka sina tider, samla lojalitet." />
        <Toggle on={dropin} set={setDropin} live title="Drop-in synligt" desc="Visa 'Drop in eller boka online' i topp-baren på hemsidan." />
      </Card>

      <Card style={{ marginTop: 16 }}>
        <h2 className="h2" style={{ marginBottom: 4 }}>Betalning</h2>
        <Toggle on={payAtBooking} set={setPay} live title="Betalning vid bokning" desc="Kunden betalar när tiden bokas." />
        {payAtBooking && <div style={{ display: "flex", gap: 9, padding: "10px 12px", background: "var(--c-warning-bg)", borderRadius: 10, margin: "12px 0 16px" }}><Icon name="shield" size={15} style={{ color: "var(--c-warning)", flex: "none", marginTop: 1 }} /><span style={{ fontSize: 12.5, color: "var(--c-ink)" }}>Skydd: en sen kund eller no-show markeras aldrig automatiskt som klar + betald.</span></div>}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: payAtBooking ? 0 : 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 40, height: 40, borderRadius: 10, background: "#635BFF", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-ui)", fontWeight: 700 }}>S</div><div><div style={{ fontWeight: 600, fontSize: 14 }}>Stripe</div><div style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>Ansluten · utbetalning varje vecka</div></div></div>
          <Badge tone="success"><Icon name="check" size={13} /> Ansluten</Badge>
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { SalonStaff, SalonSettings });
