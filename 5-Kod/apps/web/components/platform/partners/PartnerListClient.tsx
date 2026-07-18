'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Badge,
  Button,
  Card,
  Drawer,
  Field,
  PageHead,
  Stat,
  Table,
  inputStyle,
  useToast,
} from '@/components/portal/ui'
import { createPartner } from '@/lib/platform/actions/partners'
import type { ActionState } from '@/lib/platform/actions/shared'
import type { PartnerSummary } from '@/lib/platform/partners'
import { formatPartnerMoney } from '@/lib/platform/partners-shared'
import { PartnerMutationSubmit } from './PartnerMutationControls'

export function PartnerListClient({ partners }: { partners: PartnerSummary[] }) {
  const [creating, setCreating] = useState(false)
  const active = partners.filter((partner) => partner.partner_status === 'active').length
  const customers = partners.reduce((sum, partner) => sum + partner.active_tenants, 0)
  const licenseTotalSek = partners
    .filter((partner) => partner.currency === 'SEK')
    .reduce((sum, partner) => sum + partner.license_total_ore, 0)

  return (
    <>
      <PageHead
        eyebrow="Plattform"
        title="Partners"
        lede="Skapa partnern, välj valfritt licenspris och skicka inbjudan direkt från frontend."
      >
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
          Ny partner
        </Button>
      </PageHead>

      <div className="bo-stat-grid" style={{ marginBottom: 18 }}>
        <Stat label="Partners" value={partners.length} icon="building" />
        <Stat label="Aktiva" value={active} icon="checkCircle" />
        <Stat label="Aktiva kunder" value={customers} icon="users" />
        <Stat
          label="Öppen licens · SEK"
          value={formatPartnerMoney(licenseTotalSek, 'SEK')}
          icon="dollar"
        />
      </div>

      <Card pad={0}>
        <Table
          cols={['Partner', 'Konto', 'Aktiva kunder', 'Pris / kund', 'Öppen månad', 'SMS', 'Status']}
          rows={partners.map((partner) => [
            <Link key={`${partner.partner_id}-name`} href={`/partners/${partner.partner_id}`}>
              <b>{partner.partner_name}</b>
              <span style={{ display: 'block', color: 'var(--c-ink-3)', fontSize: 12 }}>
                {partner.country_code} · {partner.timezone}
              </span>
            </Link>,
            partner.member_email ?? 'Ingen medlem',
            partner.active_tenants,
            formatPartnerMoney(partner.license_price_ore, partner.currency),
            <b key={`${partner.partner_id}-total`}>
              {formatPartnerMoney(partner.license_total_ore, partner.currency)}
              <span style={{ display: 'block', color: 'var(--c-ink-3)', fontSize: 12, fontWeight: 400 }}>
                {partner.licensed_tenants} licensgrundande
              </span>
            </b>,
            formatPartnerMoney(partner.sms_cost_ore, partner.sms_cost_currency),
            <Badge
              key={`${partner.partner_id}-status`}
              tone={partner.partner_status === 'active' ? 'success' : 'warning'}
              dot={false}
            >
              {partner.partner_status === 'active'
                ? 'Aktiv'
                : partner.partner_status === 'suspended'
                  ? 'Pausad'
                  : 'Åtgärd krävs'}
            </Badge>,
          ])}
        />
      </Card>

      {partners.length === 0 ? (
        <p style={{ color: 'var(--c-ink-2)' }}>Ingen partner ännu. Skapa den första med knappen ovan.</p>
      ) : null}

      {creating ? <CreatePartnerDrawer onClose={() => setCreating(false)} /> : null}
    </>
  )
}

function CreatePartnerDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { notify } = useToast()
  const [state, action, pending] = useActionState<ActionState, FormData>(createPartner, {})

  useEffect(() => {
    if (!state.success) return
    notify(state.success, 'success')
    router.refresh()
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success])

  return (
    <Drawer
      title="Ny partner"
      sub="Kontot får full kontroll över sina egna kunder men aldrig Corevos globala inställningar."
      ariaLabel="Skapa och bjud in partner"
      onClose={onClose}
    >
      <form action={action} style={{ display: 'grid', gap: 14 }}>
        <Field label="Partnernamn">
          <input name="name" required maxLength={160} style={inputStyle} placeholder="Exempel Partner AB" />
        </Field>
        <Field label="Slug">
          <input name="slug" required minLength={2} maxLength={63} style={inputStyle} placeholder="exempel-partner" />
        </Field>
        <Field label="Ägarens e-post">
          <input name="email" required type="email" style={inputStyle} placeholder="agare@example.com" />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Land">
            <input name="countryCode" required maxLength={2} defaultValue="SE" style={inputStyle} />
          </Field>
          <Field label="Valuta">
            <input name="currency" required maxLength={3} defaultValue="SEK" style={inputStyle} />
          </Field>
        </div>
        <Field label="Tidszon">
          <input name="timezone" required defaultValue="Europe/Stockholm" style={inputStyle} />
        </Field>
        <Field label="Valfritt pris per aktiv kund och månad">
          <input
            name="licensePrice"
            required
            inputMode="decimal"
            defaultValue="50.00"
            style={inputStyle}
            aria-describedby="partner-price-help"
          />
        </Field>
        <p id="partner-price-help" style={{ margin: '-7px 0 0', color: 'var(--c-ink-2)', fontSize: 12.5 }}>
          Du kan sätta valfri summa och ändra den senare. Den öppna månaden räknas om automatiskt.
        </p>
        {state.error ? <p className="auth-error" role="alert">{state.error}</p> : null}
        <div style={{ display: 'grid', gap: 8 }}>
          <PartnerMutationSubmit
            state={state}
            pending={pending}
            triggerLabel="Skapa och bjud in…"
            confirmLabel="Bekräfta konto och inbjudan"
            pendingLabel="Skapar och skickar…"
            warning="Partnerkontot skapas med angivet licenspris och inbjudan skickas till e-postadressen ovan."
          />
          <Button variant="ghost" onClick={onClose} style={{ justifyContent: 'center' }}>
            Stäng utan att skapa
          </Button>
        </div>
      </form>
    </Drawer>
  )
}
