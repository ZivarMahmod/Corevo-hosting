/* Corevo back-office — role + section routing across 4 surfaces:
   super admin · salong-admin · frisörens egna sida · kundens sida.
   Super-admin är Zivars fulla kontrollcenter (M7). Zivar kan dessutom
   gå in i en salongs admin i SUPPORT-LÄGE (remote-assist) utan att logga
   in på deras sida — tydlig banner + väg tillbaka. ⌘K-kommandopalett. */
const { useState: useStateApp, useEffect: useEffectApp } = React;

const SUPER_SCREENS = {
  "Översikt": SuperOverview, "Fakturering": SuperBilling, "Salonger": SuperSalons, "Onboarda salong": SuperOnboard,
  "Kunder": SuperCustomers, "Personal": SuperStaff, "Drift & logg": SuperOps,
  "Integrationer": SuperIntegrations, "Roller": SuperRoles, "Inställningar": SuperSettings,
};
const SALON_SCREENS = {
  "Dashboard": SalonDashboard, "Bokningar": SalonBookings, "Kunder": SalonCustomers, "Tjänster": SalonServices,
  "Personal": SalonStaff, "Schema": SalonSchedule, "Varumärke": BrandingEditor, "Inställningar": SalonSettings,
};
const STAFF_SCREENS = { "Idag": StaffToday, "Mitt schema": StaffSchedule, "Frånvaro": StaffAbsence };

function AssistBanner({ name, onExit }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 24px", background: "var(--c-gold)", color: "#3A2A06", fontFamily: "var(--font-ui)", position: "sticky", top: 0, zIndex: 30 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13 }}><Icon name="shield" size={16} /> Support-läge</span>
      <span style={{ fontSize: 13.5, flex: 1, minWidth: 0 }}>Du hjälper <b>{name}</b> remote — du ser och styr deras admin utan att logga in som dem. Allt loggas i audit-loggen.</span>
      <button onClick={onExit} style={{ display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid rgba(58,42,6,.3)", background: "rgba(255,255,255,.35)", color: "#3A2A06", borderRadius: 9, padding: "7px 13px", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, flex: "none" }}><Icon name="arrowLeft" size={15} /> Tillbaka till plattform</button>
    </div>
  );
}

const FORCED = (typeof window !== "undefined" && window.__FORCE_ROLE) || null;
const FIRST_OF = { super: "Översikt", salon: "Dashboard", staff: "Idag", customer: "Mina sidor" };

function BackOffice() {
  const [role, setRole] = useStateApp(FORCED || "super");
  const [section, setSection] = useStateApp(FIRST_OF[FORCED] || "Översikt");
  const [tenant, setTenant] = useStateApp(null);   // open tenant slug (super only)
  const [assist, setAssist] = useStateApp(null);    // { slug, name } — remote-assist into a salon
  const [palette, setPalette] = useStateApp(false);

  const firstOf = FIRST_OF;
  const setRoleReset = r => { setRole(r); setSection(firstOf[r]); setTenant(null); setAssist(null); };
  const goSection = s => { setTenant(null); setSection(s); };
  const openTenant = slug => { setTenant(slug); };
  const enterAssist = (slug, name) => { setAssist({ slug, name }); setRole("salon"); setSection("Dashboard"); setTenant(null); };
  const exitAssist = () => { const slug = assist && assist.slug; setAssist(null); setRole("super"); setSection("Salonger"); setTenant(slug || null); };

  // ⌘K / Ctrl+K command palette
  useEffectApp(() => {
    const onKey = e => { if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); setPalette(p => !p); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const maps = { super: SUPER_SCREENS, salon: SALON_SCREENS, staff: STAFF_SCREENS };
  const Screen = (maps[role] || SALON_SCREENS)[section] || SalonDashboard;
  const ctx = role === "super" ? "super" : "salon";
  const override = assist ? { brand: assist.name, sub: "Support · Corevo" } : null;

  return (
    <StoreProvider>
      {!FORCED && <RoleSwitcher role={role} onRole={setRoleReset} />}
      {role === "customer" ? (
        <div data-screen-label="Kundens sida"><CustomerPortal /></div>
      ) : (
        <div data-world="backoffice" data-screen-label={"Back-office · " + (assist ? "support:" + assist.name : role) + " · " + (tenant ? "tenant:" + tenant : section)} style={{ minHeight: "100vh", background: "var(--c-cream)" }}>
          {assist && <AssistBanner name={assist.name} onExit={exitAssist} />}
          <div style={{ display: "flex", minHeight: assist ? "calc(100vh - 41px)" : "100vh" }}>
            <Sidebar role={role} active={tenant ? "Salonger" : section} onNav={goSection} override={override} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <Topbar context={ctx} onOpenPalette={() => setPalette(true)} />
              <main style={{ padding: "30px", flex: 1 }}>
                {role === "super" && tenant
                  ? <SuperTenantDetail key={tenant} slug={tenant} onBack={() => setTenant(null)} onAssist={enterAssist} />
                  : <Screen onNav={goSection} onOpenTenant={openTenant} assist={assist} />}
              </main>
            </div>
          </div>
        </div>
      )}
      <CommandPalette open={palette} onClose={() => setPalette(false)} role={role}
        onNav={s => { setRole("super"); goSection(s); }} onOpenTenant={s => { setRole("super"); openTenant(s); }} />
    </StoreProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<BackOffice />);
