import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const readWeb = (relative: string) => fs.readFileSync(path.join(WEB_ROOT, relative), 'utf8')

describe('sanningsenliga UI-besked', () => {
  it('framställer inte Google-länk eller mallvärde som ett hämtat kundbetyg', () => {
    const editor = readWeb('app/(admin)/admin/sida/page.tsx')
    const snittTheme = readWeb('components/storefront/layouts/salong/snitt.theme.ts')

    expect(editor).not.toContain('uppdateras automatiskt')
    expect(editor).toContain('Ingen betygs- eller recensionsdata hämtas automatiskt')
    expect(snittTheme).not.toMatch(/5[,.]0★/)
  })

  it('beskriver en ny eller aktiv tjänst som sparad tills personal och schema är klara', () => {
    const services = readWeb('components/admin/ServicesManager.tsx')

    expect(services).not.toContain('nu bokningsbar på din sajt')
    expect(services).not.toContain('Den blir genast bokningsbar')
    expect(services).toContain('Koppla tjänsten till aktiv personal med arbetstider')
  })

  it('skiljer sparad personalbild från publicerad personalbild', () => {
    const roster = readWeb('components/admin/StaffRoster.tsx')

    expect(roster).not.toContain("notify('Foto sparat — syns på publika sidan'")
    expect(roster).toContain('member.active && showOnSite')
    expect(roster).toContain('Fotoändringen sparades')
  })

  it('lovar inte sessionsrevokering när Supabase svarar med fel', () => {
    const security = readWeb('components/admin/AccountSecurity.tsx')

    expect(security).toContain("const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })")
    expect(security).toContain('Lösenordet är bytt, men andra enheter kunde inte loggas ut')
  })

  it('begränsar auditcopy till handlingar som faktiskt loggas', () => {
    const permissions = readWeb('components/admin/MemberPermissions.tsx')
    const customers = readWeb('components/platform/kunder/KunderView.tsx')
    const peopleActions = readWeb('lib/platform/actions/people.ts')

    expect(permissions).toContain('Sparade roll- och behörighetsändringar auditloggas')
    expect(customers).toContain('Om auditloggen inte kan skrivas visas en varning efter reset')
    expect(customers).not.toContain('Varje åtgärd loggas i audit-loggen')
    expect(customers).toContain('res.warning')
    expect(peopleActions).toContain('if (!audit.ok)')
    expect(peopleActions).toContain("reportActionError('sendPasswordReset.audit'")
    expect(peopleActions).toContain('Länken skapades, men auditloggen kunde inte skrivas')
  })

  it('lovar inte att en adress alltid kan ge en inbäddad karta', () => {
    const form = readWeb('components/platform/TenantContactForm.tsx')

    expect(form).toContain('Om adressen kan hittas visas en karta')
    expect(form).not.toContain('slås upp automatiskt när du sparar')
  })
})
