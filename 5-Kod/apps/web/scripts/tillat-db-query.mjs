#!/usr/bin/env node
/**
 * Lägger till permission-regeln som låter Claude köra `npx supabase db query`
 * mot den länkade databasen utan att fråga varje gång.
 *
 *   node 5-Kod/apps/web/scripts/tillat-db-query.mjs        # lägg till
 *   node 5-Kod/apps/web/scripts/tillat-db-query.mjs --ta-bort
 *
 * Måste köras av ZIVAR, inte av Claude: en agent får inte utöka sina egna
 * behörigheter (auto-klassaren stoppar det, och det är rätt). Skriptet finns bara
 * för att SSH-terminalen bryter långa inklistrade rader — så kommandot blir kort.
 *
 * REGELN GER SKRIVRÄTT mot prod-DB:n. Den behövs för E2E-sviten (seeda fixtur → kör →
 * riv → verifiera 0 kvarvarande rader). Ta bort den efteråt om du vill hålla det snävt.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REGEL = 'Bash(npx supabase db query:*)'
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const FIL = path.join(REPO, '.claude', 'settings.local.json')

const j = JSON.parse(readFileSync(FIL, 'utf8'))
j.permissions ??= {}
j.permissions.allow ??= []

const taBort = process.argv.includes('--ta-bort')
const fanns = j.permissions.allow.includes(REGEL)

if (taBort) {
  j.permissions.allow = j.permissions.allow.filter((r) => r !== REGEL)
  console.log(fanns ? `BORTTAGEN: ${REGEL}` : 'Regeln fanns inte — inget att ta bort.')
} else if (fanns) {
  console.log(`Fanns redan: ${REGEL}`)
} else {
  j.permissions.allow.push(REGEL)
  console.log(`TILLAGD: ${REGEL}`)
}

writeFileSync(FIL, JSON.stringify(j, null, 2) + '\n', 'utf8')
console.log(`Skrev ${FIL}`)
console.log('Starta om Claude Code så läses regeln in.')
