import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const view = fs.readFileSync(path.join(HERE, 'KunderView.tsx'), 'utf8')
const tenantCustomers = fs.readFileSync(path.resolve(HERE, '..', 'TenantCustomers.tsx'), 'utf8')
const wrapper = fs.readFileSync(path.resolve(HERE, '..', 'PlatformPiiReveal.tsx'), 'utf8')

describe('goal-72 S3/2c: PII-hygien i plattformens kundvyer', () => {
  it('renderar bara servermaskerade kontaktfält i Insyns initiala tabell/drawer', () => {
    expect(view).toContain('selected.maskedEmail')
    expect(view).toContain('selected.maskedPhone')
    expect(view).toContain("c.maskedEmail !== '—' ? c.maskedEmail : c.maskedPhone")
    expect(view).not.toMatch(/c\.(email|phone)/)
    expect(view).not.toMatch(/selected\.(email|phone)/)
  })

  it('lazy-laddar detaljens kontakt via den tunna platform-wrappern', () => {
    expect(view).toContain('<PlatformPiiReveal')
    expect(view).toContain('customerId={selected.id}')
    expect(view).toContain('onContactChange={setRevealedContact}')
    expect(wrapper).toContain('revealPlatformCustomerContact')
    expect(wrapper).toContain('loadContact={() => revealPlatformCustomerContact({ customerId, tenantId })}')
  })

  it('kräver reveal för kopiering/reset och exporterar ärligt maskerade kolumner', () => {
    expect(view).toContain('disabled={!revealedContact?.email}')
    expect(view).toContain('copyEmail(revealedContact?.email ?? null)')
    expect(view).toContain('resetPassword(selected, revealedContact?.email ?? null)')
    expect(view).toContain("'E-post (maskerad)'")
    expect(view).toContain("'Telefon (maskerad)'")
    expect(view).toContain('c.maskedEmail, c.maskedPhone')
  })

  it('håller tenantens Kunder-flik serverrenderad och skickar ingen rå PII till klientgränsen', () => {
    expect(tenantCustomers).not.toMatch(/^['"]use client['"]/)
    expect(tenantCustomers).toContain('c.maskedEmail')
    expect(tenantCustomers).toContain('c.maskedPhone')
    expect(tenantCustomers).toContain('<PlatformPiiReveal')
    expect(tenantCustomers).not.toMatch(/c\.(email|phone)/)
  })
})
