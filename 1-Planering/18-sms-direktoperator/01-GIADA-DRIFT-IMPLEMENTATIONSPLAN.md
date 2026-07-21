# Giada SMS-drift Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gör Giada `192.168.50.101` till en reproducerbar och självövervakad driftmaskin för `corevo-sms`, åtkomlig från Codex och Claude Code på Zivars PC samt manuellt från Claude Code på Giada, utan att aktivera Corevo-integrationen eller skicka SMS.

**Architecture:** Corevo-hosting behåller `notifications_outbox` och pushar autentiserade transportjobb till Giadas lokala gateway via Cloudflare Tunnel. Giada har endast en SQLite-exekveringsjournal, modem-worker och statussvar; inga Supabase-credentials eller parallell affärskö. Systemd sköter processer, fast-forward-deploy, backup och hälsokontroll utan en permanent AI-process.

**Tech Stack:** Debian/Ubuntu, OpenSSH, Git/GitHub deploy key, NetworkManager, systemd, Python/FastAPI/SQLite, Cloudflare Tunnel, Huawei E3372-325 HiLink, Claude Code.

## Utfört driftresultat 2026-07-21

| Del | Resultat |
|---|---|
| SSH från Zivars PC | Klar, nyckelbaserad anslutning till `giada` verifierad |
| Kanonisk checkout | Klar, `/home/zivar/Skrivbord/corevo-sms` följer privat `master` |
| GitHub-åtkomst | Klar, separat read-only deploy-nyckel |
| Runtime | Klar, API + ensam worker aktiva; Supabase-poller maskerad |
| Auto-update | Klar, fem minuter, fast-forward + tester + aktiveringsrollback |
| Hälsokontroll | Klar, varje minut; API, worker och default route kontrolleras |
| Backup | Klar, dagligen 03:00; manuellt prov skapat giltig SQLite-backup |
| Modemets nätverksskydd | Installerat; fysiskt USB-hotplugprov kvar eftersom modemet inte satt i Giada |
| Claude Code på Giada | Klar, version `2.1.92`; endast manuell användning |
| Lokal permanent AI | Avsiktligt inte installerad; systemd-kontrollerna är den stabila driften |
| Corevo-databaskoppling | Inte aktiverad; väntar på byggskifte från aktiva goal-73 |
| Live-SMS | Inte kört; kräver separat canarybeslut och fysiskt modemprov |

Driftsatt gateway-SHA: `b365065`. Pull request: `ZivarMahmod/corevo-sms#1`.
Verifiering på Giada: `49 passed`, API `status=ok`, `queue_pending=0`, samtliga
update/health/backup-körningar `Result=success`.

## Global Constraints

- `SMS_DELIVERY_MODE=off` tills Zivar uttryckligen godkänner ett separat canary-SMS.
- `notifications_outbox` är enda affärskön; Giada får ingen Supabase `service_role` och `corevo-sms-supabase.service` ska vara maskerad.
- LAN ska alltid äga default route och DNS. Huawei-nätet `192.168.8.0/24` får endast användas för modem-API:t `192.168.8.1`.
- Automatisk deploy får endast fast-forwarda en ren checkout av `ZivarMahmod/corevo-sms:master`; testfel ska återställa föregående commit och inte starta om tjänsterna.
- Claude Code installeras på Giada för manuell användning men körs inte som daemon eller timer.
- Ingen lokal LLM installeras. Systemd och deterministiska shellkontroller täcker dagens driftbehov.
- Secrets, telefonnummer och meddelandetext får inte committas eller skrivas till driftloggar.
- Corevo-outbox-/databasintegrationen är ett separat bygge enligt `00-BESLUT-ARKITEKTUR-BYGGPLAN.md`; den startas först efter Giada-grunden och byggskifte från aktiv goal-73.

---

### Task 1: Nyckelbaserad SSH och skrivskyddad inventering

**Files:**
- Modify on Giada: `/home/zivar/.ssh/authorized_keys`
- Read only on Giada: `/home/zivar/Skrivbord/corevo-sms`, systemd, routes och installerade verktyg

**Interfaces:**
- Consumes: den redan autentiserade VS Code Remote-SSH-sessionen.
- Produces: `ssh -o BatchMode=yes giada` från Zivars PC.

- [ ] **Step 1: Lägg till PC-nyckeln idempotent via VS Code-terminalen**

```bash
install -d -m 700 /home/zivar/.ssh
key='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBmIwVSyWQBA9Gmpc483+NDLX8KAop/mQXEwydFgBmTn zivarpc'
grep -qxF "$key" /home/zivar/.ssh/authorized_keys 2>/dev/null || printf '%s\n' "$key" >> /home/zivar/.ssh/authorized_keys
chmod 600 /home/zivar/.ssh/authorized_keys
```

- [ ] **Step 2: Verifiera vanlig SSH från PC:n**

```powershell
ssh -o BatchMode=yes giada "hostname; id -un"
```

Expected: Giadas hostname och `zivar`, utan lösenordsfråga.

- [ ] **Step 3: Inventera utan att ändra Giada**

```bash
hostnamectl
ip -4 addr
ip route
nmcli -t -f NAME,UUID,TYPE,DEVICE connection show
systemctl is-enabled corevo-sms-api corevo-sms-worker corevo-sms-supabase 2>&1
systemctl is-active corevo-sms-api corevo-sms-worker corevo-sms-supabase 2>&1
command -v git python3 node npm claude cloudflared
test -d /home/zivar/Skrivbord/corevo-sms/.git && git -C /home/zivar/Skrivbord/corevo-sms status --short --branch || echo REPO_NOT_CLONED
```

Expected: en rapport; inga filer eller tjänster ändras.

---

### Task 2: Begränsad GitHub-åtkomst och kanonisk checkout

**Files:**
- Create on Giada: `/home/zivar/.ssh/corevo_sms_deploy`
- Modify on Giada: `/home/zivar/.ssh/config`
- Create if absent: `/home/zivar/Skrivbord/corevo-sms/`

**Interfaces:**
- Consumes: PC:ns autentiserade `gh` och Giadas publika deploy-nyckel.
- Produces: read-only GitHub-åtkomst för endast `ZivarMahmod/corevo-sms`.

- [ ] **Step 1: Skapa en dedikerad deploy-nyckel på Giada**

```bash
test -f /home/zivar/.ssh/corevo_sms_deploy || ssh-keygen -t ed25519 -N '' -f /home/zivar/.ssh/corevo_sms_deploy -C 'giada-corevo-sms-readonly'
cat /home/zivar/.ssh/corevo_sms_deploy.pub
```

- [ ] **Step 2: Registrera nyckeln read-only från PC:n**

```powershell
$key = ssh giada "cat /home/zivar/.ssh/corevo_sms_deploy.pub"
gh api repos/ZivarMahmod/corevo-sms/keys -f title='Giada corevo-sms read-only' -f key="$key" -F read_only=true
```

- [ ] **Step 3: Lås GitHub-aliaset till deploy-nyckeln**

```bash
cat >> /home/zivar/.ssh/config <<'EOF'
Host github-corevo-sms
  HostName github.com
  User git
  IdentityFile /home/zivar/.ssh/corevo_sms_deploy
  IdentitiesOnly yes
EOF
chmod 600 /home/zivar/.ssh/config
ssh-keyscan github.com >> /home/zivar/.ssh/known_hosts
chmod 600 /home/zivar/.ssh/known_hosts
ssh -T github-corevo-sms || test "$?" -eq 1
```

- [ ] **Step 4: Klona endast om ingen checkout finns**

```bash
if test -d /home/zivar/Skrivbord/corevo-sms/.git; then
  git -C /home/zivar/Skrivbord/corevo-sms remote set-url origin github-corevo-sms:ZivarMahmod/corevo-sms.git
  git -C /home/zivar/Skrivbord/corevo-sms fetch origin master
else
  test ! -e /home/zivar/Skrivbord/corevo-sms || { echo 'STOP: befintlig mapp utan .git'; exit 1; }
  git clone github-corevo-sms:ZivarMahmod/corevo-sms.git /home/zivar/Skrivbord/corevo-sms
fi
```

Expected: ren `master`; ett befintligt icke-Git-innehåll bevaras och stoppar arbetet.

---

### Task 3: LAN- och modemrouting

**Files:**
- Install from repo: `deploy/50-corevo-hilink` → `/etc/NetworkManager/dispatcher.d/50-corevo-hilink`
- Install from repo: `deploy/99-corevo-hilink-mm-ignore.rules` → `/etc/udev/rules.d/99-corevo-hilink-mm-ignore.rules`

**Interfaces:**
- Consumes: Huawei HiLink DHCP på `192.168.8.0/24`.
- Produces: modem-API via `192.168.8.1`, men aldrig default route eller DNS.

- [ ] **Step 1: Installera de befintliga skydden**

```bash
sudo install -o root -g root -m 0755 deploy/50-corevo-hilink /etc/NetworkManager/dispatcher.d/50-corevo-hilink
sudo install -o root -g root -m 0644 deploy/99-corevo-hilink-mm-ignore.rules /etc/udev/rules.d/99-corevo-hilink-mm-ignore.rules
sudo udevadm control --reload-rules
sudo systemctl reload NetworkManager
```

- [ ] **Step 2: Verifiera routing med modemet anslutet**

```bash
ip route get 1.1.1.1
ip route get 192.168.8.1
curl --connect-timeout 3 -fsS http://192.168.8.1/api/webserver/SesTokInfo >/dev/null
```

Expected: internet går via LAN; endast modemtrafik går till Huawei-interfacet.

---

### Task 4: Runtime och fail-closed systemd

**Files:**
- Create in `corevo-sms`: `requirements.txt`
- Delete in `corevo-sms`: `backend/app/supabase_poller.py`
- Delete in `corevo-sms`: `tests/test_customer_supabase.py`
- Delete in `corevo-sms`: `systemd/corevo-sms-supabase.service`
- Delete in `corevo-sms`: `docs/SUPABASE_INTEGRATION.md`
- Modify in `corevo-sms`: `backend/app/config.py`
- Modify in `corevo-sms`: `.env.example`
- Install from repo: `systemd/corevo-sms-api.service`
- Install from repo: `systemd/corevo-sms-worker.service`
- Disable/mask: `corevo-sms-supabase.service`
- Create locally on Giada, never commit: `/home/zivar/Skrivbord/corevo-sms/.env`

**Interfaces:**
- Consumes: ren Git-checkout, Python 3 och modem-API.
- Produces: FastAPI på `127.0.0.1:8790` och en enda modem-worker.

- [ ] **Step 1: Committa endast direkta Pythonberoenden**

```text
argon2-cffi==25.1.0
fastapi==0.139.2
httpx==0.28.1
huawei-lte-api==1.11.0
itsdangerous==2.2.0
jinja2==3.1.6
passlib==1.7.4
phonenumbers==9.0.34
pydantic-settings==2.14.2
pytest==9.1.1
python-multipart==0.0.32
requests==2.34.2
uvicorn==0.51.0
```

- [ ] **Step 2: Ta bort den konkurrerande Supabase-pollern**

Radera poller, pollertest, poller-service och pollerdokument. Ta bort de fem `supabase_*`-fälten från `Settings` och motsvarande `COREVO_SUPABASE_*` från `.env.example`.

- [ ] **Step 3: Skapa reproducerbar Pythonmiljö från committad dependencyfil**

```bash
cd /home/zivar/Skrivbord/corevo-sms
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
.venv/bin/pytest -q
```

Expected: alla tester passerar innan tjänster installeras.

- [ ] **Step 4: Installera endast API och worker**

```bash
sudo install -o root -g root -m 0644 systemd/corevo-sms-api.service /etc/systemd/system/corevo-sms-api.service
sudo install -o root -g root -m 0644 systemd/corevo-sms-worker.service /etc/systemd/system/corevo-sms-worker.service
sudo systemctl disable --now corevo-sms-supabase.service 2>/dev/null || true
sudo systemctl mask corevo-sms-supabase.service
sudo systemctl daemon-reload
sudo systemctl enable --now corevo-sms-api.service corevo-sms-worker.service
curl -fsS http://127.0.0.1:8790/health
```

Expected: API och worker är `active`; pollern kan inte startas.

---

### Task 5: Automatisk deploy, backup och deterministisk hälsokontroll

**Files:**
- Create in `corevo-sms`: `scripts/update.sh`
- Create in `corevo-sms`: `scripts/healthcheck.sh`
- Create in `corevo-sms`: `systemd/corevo-sms-update.service`
- Create in `corevo-sms`: `systemd/corevo-sms-update.timer`
- Create in `corevo-sms`: `systemd/corevo-sms-health.service`
- Create in `corevo-sms`: `systemd/corevo-sms-health.timer`
- Create in `corevo-sms`: `systemd/corevo-sms-backup.service`
- Create in `corevo-sms`: `systemd/corevo-sms-backup.timer`
- Test: `tests/test_ops_scripts.py`

**Interfaces:**
- Consumes: `origin/master`, lokal health endpoint och LAN-route.
- Produces: fast-forward-only deploy var femte minut, hälsokontroll varje minut och daglig SQLite-backup.

- [ ] **Step 1: Testa shellkontrakten utan modem eller riktiga SMS**

```python
from pathlib import Path


def test_ops_scripts_are_fail_closed():
    root = Path(__file__).parents[1]
    update = (root / "scripts/update.sh").read_text()
    health = (root / "scripts/healthcheck.sh").read_text()
    assert "merge --ff-only" in update
    assert "pytest -q" in update
    assert "reset --hard \"$old\"" in update
    assert "127.0.0.1:8790/health" in health
    assert "192.168.8.1" in health
```

- [ ] **Step 2: Implementera fail-closed uppdatering och hälsokontroll**

`scripts/update.sh`:

```sh
#!/bin/sh
set -eu
repo=/home/zivar/Skrivbord/corevo-sms
cd "$repo"
test -z "$(git status --porcelain)" || exit 0
git fetch origin master
old=$(git rev-parse HEAD)
new=$(git rev-parse origin/master)
test "$old" != "$new" || exit 0
git merge-base --is-ancestor "$old" "$new"
git merge --ff-only origin/master
if ! .venv/bin/pip install -q -r requirements.txt || ! .venv/bin/pytest -q; then
  git reset --hard "$old"
  .venv/bin/pip install -q -r requirements.txt || true
  exit 1
fi
touch "$repo/.deploy-restart-required"
```

`scripts/healthcheck.sh`:

```sh
#!/bin/sh
set -eu
systemctl is-active --quiet corevo-sms-api corevo-sms-worker
curl --connect-timeout 3 -fsS http://127.0.0.1:8790/health >/dev/null
case "$(ip route get 1.1.1.1)" in
  *"via 192.168.8.1"*) echo 'Huawei HiLink owns default route' >&2; exit 1 ;;
esac
```

- [ ] **Step 3: Lägg till systemd-enheter**

`systemd/corevo-sms-update.service`:

```ini
[Unit]
Description=Corevo SMS fast-forward update
After=network-online.target

[Service]
Type=oneshot
User=zivar
WorkingDirectory=/home/zivar/Skrivbord/corevo-sms
ExecStart=/home/zivar/Skrivbord/corevo-sms/scripts/update.sh
ExecStartPost=+/bin/sh -c 'test ! -f /home/zivar/Skrivbord/corevo-sms/.deploy-restart-required || { rm -f /home/zivar/Skrivbord/corevo-sms/.deploy-restart-required; systemctl restart corevo-sms-api corevo-sms-worker; }'
```

`systemd/corevo-sms-update.timer`:

```ini
[Unit]
Description=Check Corevo SMS updates every five minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
Persistent=true

[Install]
WantedBy=timers.target
```

`systemd/corevo-sms-health.service`:

```ini
[Unit]
Description=Corevo SMS health check

[Service]
Type=oneshot
ExecStart=/home/zivar/Skrivbord/corevo-sms/scripts/healthcheck.sh
```

`systemd/corevo-sms-health.timer`:

```ini
[Unit]
Description=Check Corevo SMS health every minute

[Timer]
OnBootSec=1min
OnUnitActiveSec=1min
Persistent=true

[Install]
WantedBy=timers.target
```

`systemd/corevo-sms-backup.service`:

```ini
[Unit]
Description=Backup Corevo SMS SQLite database

[Service]
Type=oneshot
User=zivar
WorkingDirectory=/home/zivar/Skrivbord/corevo-sms
ExecStart=/home/zivar/Skrivbord/corevo-sms/scripts/backup.sh
```

`systemd/corevo-sms-backup.timer`:

```ini
[Unit]
Description=Daily Corevo SMS backup

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

- [ ] **Step 4: Kör kontraktstestet**

Run: `.venv/bin/pytest -q tests/test_ops_scripts.py`

Expected: PASS. Uppdateraren lämnar en smutsig checkout orörd, fast-forwardar bara, testar och återställer vid testfel. Healthcheck failar om API/worker är nere eller internetroute går via `192.168.8.1`.

- [ ] **Step 5: Installera timers**

```bash
sudo install -o root -g root -m 0644 systemd/corevo-sms-{update,health,backup}.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now corevo-sms-update.timer corevo-sms-health.timer corevo-sms-backup.timer
systemctl list-timers --all --no-pager | grep corevo-sms
```

Expected: tre timers syns; inga AI-processer körs.

---

### Task 6: Claude Code på Giada, vilande som standard

**Files:**
- User-local installation under `/home/zivar/.local/`
- No systemd unit, cron entry or timer

**Interfaces:**
- Consumes: manuell SSH/VPN-session och Zivars egen Claude-inloggning.
- Produces: kommandot `claude` när Zivar själv loggar in på Giada.

- [ ] **Step 1: Verifiera krav och installera utan sudo**

```bash
node --version
npm --version
npm config set prefix /home/zivar/.local
npm install -g @anthropic-ai/claude-code
/home/zivar/.local/bin/claude doctor
```

Expected: Node är minst 18 och `claude doctor` hittar en användarinstallation. Om Node är äldre stoppas installationen i stället för att ändra systemets Node blint.

- [ ] **Step 2: Bevisa att Claude inte körs permanent**

```bash
systemctl list-unit-files --no-pager | grep -i claude && exit 1 || true
systemctl list-timers --all --no-pager | grep -i claude && exit 1 || true
pgrep -af claude && exit 1 || true
```

Expected: ingen aktiv eller schemalagd Claude-process. Zivar autentiserar interaktivt första gången han själv använder verktyget.

---

### Task 7: Driftprov och separat canary-grind

**Files:**
- Update after verified run: `5-Kod/docs/ops/sms-activation.md`
- Record manual test: `6-Testing/`

**Interfaces:**
- Consumes: installerade tjänster, tunnel och avstängd Corevo-provider.
- Produces: bevis för boot, USB hotplug, nät, backup, rollback och idempotens.

- [ ] **Step 1: Kör icke-sändande driftprov**

```bash
sudo systemctl restart NetworkManager corevo-sms-api corevo-sms-worker
systemctl is-active corevo-sms-api corevo-sms-worker
curl -fsS http://127.0.0.1:8790/health
ip route get 1.1.1.1
ip route get 192.168.8.1
sudo systemctl start corevo-sms-backup.service
systemctl is-failed corevo-sms-backup.service
```

Expected: LAN behåller internet, modem-API:t är separat, tjänsterna återstartar och backup lyckas.

- [ ] **Step 2: Stoppa vid canary-grinden**

Inget riktigt SMS skickas och `SMS_DELIVERY_MODE` ändras inte. Ett canary-SMS är en separat, uttrycklig Zivar-åtgärd efter att mottagarnummer, kostnad och rollback har visats.
