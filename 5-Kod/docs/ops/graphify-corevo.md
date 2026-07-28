# Graphify Corevo

Det här är Corevos gemensamma lokala kodgraf för Codex och Claude Code. Den ger
snabb arkitekturorientering och små, relevanta kontextutdrag utan att en agent
behöver läsa tusentals filer på nytt.

Källkoden är fortfarande den slutliga sanningen. `graph.json` är ett
automatiskt uppdaterat index över källkoden, inte en ersättning för att öppna den
berörda filen och köra tester före en ändring.

## Flödet

```mermaid
flowchart LR
  code["5-Kod källfiler"] --> watcher["En filtrerad watcher"]
  watcher --> graph["graphify-out/graph.json"]
  reference["Open Design, read-only"] --> referenceGraph["graphify-references/open-design"]
  graph --> html["Interaktiv graph.html"]
  referenceGraph --> html
  graph --> mcp["graphify-corevo HTTP MCP"]
  referenceGraph --> mcp
  mcp --> codex["Codex"]
  mcp --> claude["Claude Code"]
```

Det finns bara:

- en Corevo-graf: `5-Kod/graphify-out/graph.json`
- en separat, ignorerad Open Design-referensgraf:
  `5-Kod/graphify-references/open-design/graphify-out/graph.json`
- en watcher som samlar verkliga filändringar i femsekundersvågor
- en global, gemensam MCP-server och projektkatalog: `graphify-corevo`
- en interaktiv sida: `http://127.0.0.1:8765/tools/graphify-live/`
- Zivar Graph Studio: `http://127.0.0.1:8768/`

MCP-servern lyssnar bara på den egna datorn. Inget exponeras på nätverket.
Projektkatalogen ligger i `~/.codex/graphify-library/registry.json`. Den
innehåller endast projekt-ID:n och pekare till graferna, så befintliga grafer
kopieras inte. Projekt utan egen graf får en hanterad graf under
`~/.codex/graphify-library/managed/`.
Sidan visar Graphifys aggregerade communityvy med ungefär 600 klickbara
områden. MCP:n behåller samtidigt alla cirka 7 600 individuella kodnoder för
detaljerade agentfrågor. Full detalj i MCP och läsbar överblick i webbläsaren
delar alltså samma `graph.json`.

Samma sida kan växla till Open Design. Referensgrafen innehåller cirka 19 900
detaljnoder för MCP och en aggregerad webbläsarvy med cirka 640 communities.

## Open Design-referensen

Klonen i `4-Dokument-Underlag/08-externa-verktyg/open-design/` är separat
Git-historik och ska aldrig ändras av Corevo-arbetet. Både klonen och den
genererade grafen är ignorerade i Corevos Git.

Bygg eller uppdatera referensgrafen från `5-Kod/`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/graphify-open-design.ps1
```

Skriptet indexerar den relevanta motorn, inte media, tester eller hundratals
upprepade designpaket. Open Design har ingen ständig watcher eftersom källan är
read-only; kör skriptet igen efter att klonen avsiktligt har uppdaterats.

## Start, status och stopp

Kör från `5-Kod/`:

```powershell
# Start är idempotent: redan startade processer dubbleras inte.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/graphify-live.ps1

# Kontrollera watcher, grafvyer och MCP.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/graphify-live.ps1 -Action Status

# Stoppa projektets watcher och vyer. Det globala MCP-biblioteket fortsätter.
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/graphify-live.ps1 -Action Stop
```

Processerna fortsätter när Codex eller Claude stängs men upphör vid
Windows-omstart. Nästa agentsession startar dem igen enligt `AGENTS.md`.

Loggar ligger i det ignorerade `5-Kod/graphify-out/`:

- `live-watch.log` och `live-watch.err.log`
- `live-view.log` och `live-view.err.log`
- `studio-mcp.log` och `studio-mcp.err.log`
- `studio-web.log` och `studio-web.err.log`
- `watch.failed` om en rebuild misslyckades och väntar på nytt försök

Det globala MCP-bibliotekets loggar ligger i
`~/.codex/graphify-library/server.log` och `server.err.log`.

## Automatisk uppdatering

Watchern använder Graphifys egen AST- och grafmotor men skickar endast filer
vars innehåll faktiskt ändrats. Det undviker Windows-händelser som annars kan
utlösa onödiga helskanningar.

När 20 kodfiler ändras tätt:

1. Watchern väntar fem sekunder efter sista ändringen.
2. De 20 filerna byggs om i samma våg.
3. `graph.json`, rapporten, den klickbara communitygrafen och call-flow-sidan
   uppdateras.
4. MCP-servern märker filändringen och laddar om grafen utan omstart.
5. De öppna webbsidorna märker den nya grafen och laddar om sina vyer.

Koduppdateringen är lokal och deterministisk. Den använder ingen LLM och kostar
inga API-token.

Ändringar i dokument, bilder eller PDF:er skapar
`graphify-out/needs_update`. De kräver en separat semantisk Graphify-uppdatering.

Om watchern varit avstängd:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/graphify-update-changed.ps1
```

Efter branchbyte eller när ändringar redan committats:

```powershell
graphify update .
```

## MCP för kodgraf och desktopstudio

Alla Codex-projekt använder exakt namnet `graphify-corevo` och URL:

```text
http://127.0.0.1:8766/mcp
```

Den globala Codex-konfigurationen och projektets `.mcp.json` ger agenter samma
anslutning. Skapa inte ytterligare namn som
`graphify`, `graphify-local` eller `corevo-graph`; de skulle bara ge dubbla
klientkonfigurationer.

En HTTP-server används i stället för en stdio-server per agent. Agenterna har
egna klientanslutningar men delar samma serverprocess och samma projektkatalog.
Kör `list_projects` och skicka alltid ett explicit projekt-ID. Corevo heter
`corevo` och Open Design heter `open-design`. Servern har avsiktligt ingen
standardgraf, vilket hindrar en session från att råka läsa ett annat projekt.

`query_projects` kan fråga 2-4 utvalda grafer samtidigt. Resultaten hålls
separata och märks med projekt-ID; verktyget skapar inga påhittade relationer
mellan kodbaserna.

Desktopappen och localhostvyn har en separat, gemensam styrkanal:

```text
zivar-graph-studio
http://127.0.0.1:8767/mcp
```

Den läser inte om grafen. Den publicerar aktuell vy och tar emot fokus-, vy-,
ändrings- och felhändelser. Händelser får innehålla agentnamn, fil eller nod,
åtgärd, tid, tokenantal när klienten känner till det, status och en kort
resultatsammanfattning. Prompts, dolda resonemang, hemligheter och kunddata får
inte skickas dit.

## Zivar Graph Studio

Den webbaserade studion startar i bakgrunden med `graphify-live.ps1` och finns
på:

```text
http://127.0.0.1:8768/
```

Den kan växla mellan Corevo och Open Design, jämföra dem, läsa Graph JSON, CSV
och SQL-schema samt hämta publika GitHub-repon. Val av en hel lokal mapp kräver
desktopappen eftersom webbläsaren inte får fri åtkomst till datorns mappar.

Starta desktopappen ovanpå samma bakgrundstjänster:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/zivar-graph-studio.ps1
```

Appen återanvänder Corevos och Open Designs råa `graph.json`, kan ladda en eller
två andra projektmappar, publika GitHub-repon, Graph JSON, CSV och SQL-schema.
Nya kodbaser analyseras med den befintliga Graphify-installationen och cachas
utanför källprojektet.

Bygg en lokal Windows-version:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/zivar-graph-studio.ps1 -Action Dist
```

## Så agenter ska använda grafen

1. Starta eller kontrollera den globala `graphify-library.ps1`.
2. Kör `list_projects` med aktuell Git-/projektrot som filter.
3. Saknas en exakt träff, kör `register_project`; verktyget återanvänder en
   befintlig graf eller bygger en hanterad kodgraf.
4. Kör `graphify reflect --if-stale` när projektet äger sin graf.
5. Fråga grafen med explicit `project` före bred sökning vid arkitektur-,
   beroende- och flödesfrågor.
6. Använd en smal fråga och rimlig tokenbudget, normalt 800-1500 token.
7. Öppna sedan de källfiler som grafen pekar ut.
8. Gör ändringen och verifiera med riktade tester.
9. Låt projektets watcher avsluta sin rebuild före nästa graffråga eller
   slutrapport.

Bra frågor:

```text
Trace booking creation from route to database mutation.
What calls requireAdminArea and which tenant guards surround it?
Find the shortest path from customer portal login to booking cancellation.
Which communities are affected by inventory reservation?
```

Grafen används inte för att:

- ersätta säkerhetskontroller, tester eller läsning av de berörda källfilerna
- dumpa hela `GRAPH_REPORT.md` i varje prompt
- göra allmän textsökning där en exakt filsökning redan är billigare
- indexera hemligheter eller miljöfiler

## Varför detta sparar tid och token

- Kodgrafen byggs lokalt utan LLM.
- MCP returnerar ett begränsat delträd i stället för hela repot.
- `.claudeignore` hindrar `graphify-out/` från att förstöra Claude Codes
  promptcache varje gång grafen skrivs om.
- En gemensam graf betyder att Codex och Claude inte gör varsin extraktion.
- Graf först, källfil sedan minskar felträffar utan att låta grafen bli facit.

## Merge till main

Följande versionshanteras och ska mergeas:

- `.mcp.json`
- `.claudeignore`
- Graphify-avsnittet i `AGENTS.md`
- `5-Kod/scripts/graphify-live.ps1`
- `5-Kod/scripts/graphify-watch.py`
- `5-Kod/scripts/graphify-update-changed.ps1`
- `5-Kod/scripts/graphify-open-design.ps1`
- `5-Kod/scripts/zivar-studio-mcp.py`
- `5-Kod/scripts/zivar-graph-studio.ps1`
- `5-Kod/apps/zivar-graph-studio/`
- `5-Kod/tools/graphify-live/index.html`
- denna dokumentation och Claude-bootstrapfilen

`5-Kod/graphify-out/`, `5-Kod/graphify-references/` och Open Design-klonen ska
inte commitas i Corevo. Graferna är stora, genererade och lokala.

När branchen är mergead:

1. Stoppa Graphify från den gamla worktreen.
2. Gå till `main/5-Kod`.
3. Bygg en ny lokal Corevo-graf från main om `graphify-out/graph.json` saknas.
4. Kör `scripts/graphify-open-design.ps1` om Open Design-referensen ska användas.
5. Starta `scripts/graphify-live.ps1` från main.
6. Kör `register_project` med `project_id="corevo"`, main som `source_path` och
   mains `5-Kod/graphify-out/graph.json` som `graph_path`.
7. Verifiera `corevo` och `open-design` via `list_projects` och sidan.
8. Ta bort den gamla worktreen först därefter.

Eftersom MCP använder samma loopback-URL behöver Codex och Claude inte pekas om
efter mergen. Endast `corevo`-postens grafpekare byts från worktreen till main.

## Ny dator eller ny utvecklare

Använd den fristående prompten:

`5-Kod/docs/ops/claude-code-graphify-bootstrap-prompt.md`

Den installerar Graphify, bygger den lokala grafen, startar tjänsterna och
verifierar att Claude använder det befintliga namnet `graphify-corevo`.
