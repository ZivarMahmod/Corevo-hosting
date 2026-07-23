# Goal 76 — gemensam localhostacceptans

Körs först när localhost uttryckligen startats mot Supabase-previewbranchen
`localhost-acceptance`. Kontrollera projekt-ref `cwnhpesrgolflkmyjbrm` innan
någon skrivning. Port 3000 använder just nu `.env.production` och får inte
användas för detta prov förrän processen startats om med previewmiljön.

## En enda acceptanskedja

1. Logga in som previewbranchens globala superadmin och öppna `/kunder/ny`.
2. Skapa en kund. Bekräfta att resultatet säger **Under konfiguration**, visar
   `<slug>.boka.corevo.se` och inte länkar till en publik liveyta.
3. Öppna kundkortet. Bekräfta att **Publiceringskontroll** namnger det som saknas
   och att **Publicera kund** är spärrad.
4. Fyll endast de blockerare som kundkortet visar. Ladda om och bekräfta att
   kontrollen blir grön.
5. Klicka **Publicera kund** en gång. Bekräfta status **Aktiv**, publik länk och
   att `http://localhost:3000/boka?tenant=<slug>` öppnar kundens bokningsyta.

Godkänt när kedjan passerar utan 404, 5xx eller fel i browserkonsolen. Upprepa
inte variantmatriser här; de hör till nästa bokningsgoal.

## Redan automatiskt verifierat

- Previewmigrationen är applicerad.
- Readiness och publicering är runtimeprovade med rollback.
- Direkt `status='active'` och RPC-publicering nekas när ett krav saknas.
- Ompublicering av en aktiv kund är idempotent.
- Full websvit, typecheck, lint och build är gröna.

## Parkerat till release

- produktionsmigration,
- Cloudflare-/HTTPS-smoke,
- produktionspublicering av en ny kund.
