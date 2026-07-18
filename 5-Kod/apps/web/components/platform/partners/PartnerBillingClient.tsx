'use client'

import { useActionState } from 'react'
import {
  Badge,
  Button,
  Card,
  Field,
  PageHead,
  Stat,
  Table,
  inputStyle,
  selectStyle,
} from '@/components/portal/ui'
import { savePartnerSmsConfig } from '@/lib/platform/actions/partners'
import type { ActionState } from '@/lib/platform/actions/shared'
import type { PartnerLicenseMonth, PartnerSummary } from '@/lib/platform/partners'
import { formatPartnerMoney } from '@/lib/platform/partners-shared'
import {
  PartnerMutationSubmit,
  useRefreshOnActionSuccess,
} from './PartnerMutationControls'

export function PartnerBillingClient({
  partner,
  history,
  smsSender,
}: {
  partner: PartnerSummary
  history: PartnerLicenseMonth[]
  smsSender: string | null
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(savePartnerSmsConfig, {})
  useRefreshOnActionSuccess(state, pending)

  return (
    <>
      <PageHead
        eyebrow="Ekonomi"
        title="Licens och kommunikation"
        lede="Den öppna månaden uppdateras automatiskt när du får, aktiverar, pausar eller flyttar kunder."
      />
      <div className="bo-stat-grid" style={{ marginBottom: 18 }}>
        <Stat label="Aktiva kunder nu" value={partner.active_tenants} icon="users" />
        <Stat label="Licensgrundande denna månad" value={partner.licensed_tenants} icon="building" />
        <Stat label="Öppen licenssumma" value={formatPartnerMoney(partner.license_total_ore, partner.currency)} icon="dollar" />
        <Stat label="SMS denna månad" value={formatPartnerMoney(partner.sms_cost_ore, partner.sms_cost_currency)} icon="message" />
      </div>
      <Card>
        <p style={{ marginTop: 0 }}>
          Ditt pris är <b>{formatPartnerMoney(partner.license_price_ore, partner.currency)}</b> per
          aktiv kund och månad. En kund som varit aktiv någon gång under månaden räknas som en hel månad.
          Stängda månader är låsta.
        </p>
      </Card>
      <Card pad={0} style={{ marginTop: 16 }}>
        <Table
          cols={['Månad', 'Licensgrundande kunder', 'Summa', 'Status']}
          rows={history.map((month) => [
            month.month,
            month.customers,
            formatPartnerMoney(month.totalOre, partner.currency),
            <Badge key={month.month} tone={month.closed ? 'neutral' : 'success'} dot={false}>
              {month.closed ? 'Stängd' : 'Öppen · automatisk'}
            </Badge>,
          ])}
        />
      </Card>
      <Card style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Din SMS-leverantör</h2>
        <p style={{ color: 'var(--c-ink-2)', fontSize: 13 }}>
          Du kan använda Corevos standardväg eller ditt eget 46elks-konto. Hemligheter visas aldrig efter att de sparats.
        </p>
        <form action={action} style={{ display: 'grid', gap: 12, maxWidth: 520 }}>
          <input type="hidden" name="partnerId" value={partner.partner_id} />
          <Field label="Leverantör">
            <select name="providerKey" defaultValue={partner.sms_provider_key} style={selectStyle}>
              <option value="corevo_46elks">Corevos standardväg</option>
              <option value="partner_46elks">Mitt 46elks-konto</option>
            </select>
          </Field>
          <Field label="Avsändare"><input name="sender" defaultValue={smsSender ?? ''} maxLength={40} style={inputStyle} /></Field>
          <Field label="Användarnamn"><input name="username" autoComplete="off" style={inputStyle} placeholder="Tomt = behåll sparat" /></Field>
          <Field label="Lösenord"><input name="password" type="password" autoComplete="new-password" style={inputStyle} placeholder="Tomt = behåll sparat" /></Field>
          <Field label="Callback-hemlighet"><input name="callbackSecret" type="password" autoComplete="new-password" style={inputStyle} /></Field>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" name="enabled" defaultChecked={partner.sms_provider_enabled} /> Aktiv
          </label>
          {state.error ? <p className="auth-error" role="alert">{state.error}</p> : null}
          {state.success ? <p role="status" style={{ color: 'var(--c-success)' }}>{state.success}</p> : null}
          <PartnerMutationSubmit
            state={state}
            pending={pending}
            triggerLabel="Spara leverantör…"
            confirmLabel="Bekräfta leverantör"
            pendingLabel="Sparar…"
            warning="Leverantör, avsändare och eventuella nya hemligheter börjar gälla för dina kommande SMS."
          />
        </form>
      </Card>
    </>
  )
}
