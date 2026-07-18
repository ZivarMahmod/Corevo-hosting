'use client'

import { useActionState } from 'react'
import Link from 'next/link'
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
import {
  moveTenantToPartner,
  savePartnerSmsConfig,
  updatePartner,
} from '@/lib/platform/actions/partners'
import type { ActionState } from '@/lib/platform/actions/shared'
import type {
  PartnerLicenseMonth,
  PartnerSummary,
  PartnerTenantOption,
} from '@/lib/platform/partners'
import {
  formatPartnerMoney,
  partnerPriceInputValue,
} from '@/lib/platform/partners-shared'
import {
  PartnerMutationSubmit,
  useRefreshOnActionSuccess,
} from './PartnerMutationControls'

export function PartnerDetailClient({
  partner,
  tenants,
  history,
  smsSender,
}: {
  partner: PartnerSummary
  tenants: PartnerTenantOption[]
  history: PartnerLicenseMonth[]
  smsSender: string | null
}) {
  const assigned = tenants.filter((tenant) => tenant.partnerId === partner.partner_id)
  const editable = partner.partner_status === 'active' || partner.partner_status === 'suspended'

  return (
    <>
      <PageHead
        eyebrow="Partners"
        title={partner.partner_name}
        lede={`${partner.country_code} · ${partner.currency} · ${partner.timezone}`}
      >
        <Button href="/partners" variant="ghost">Till partnerlistan</Button>
      </PageHead>

      <div className="bo-stat-grid" style={{ marginBottom: 18 }}>
        <Stat label="Aktiva kunder" value={partner.active_tenants} icon="users" />
        <Stat label="Licensgrundande" value={partner.licensed_tenants} icon="building" />
        <Stat
          label="Öppen licenssumma"
          value={formatPartnerMoney(partner.license_total_ore, partner.currency)}
          icon="dollar"
        />
        <Stat
          label="SMS denna månad"
          value={formatPartnerMoney(partner.sms_cost_ore, partner.sms_cost_currency)}
          icon="mail"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))', gap: 16 }}>
        <Card>
          <h2 style={{ marginTop: 0 }}>Partner och licens</h2>
          {editable ? (
            <PartnerEditForm partner={partner} />
          ) : (
            <p className="auth-error" role="alert">
              Inbjudan blev inte fullständigt provisionerad. Kontot kan inte aktiveras manuellt;
              städa det provisoriska kontot och skapa inbjudan på nytt.
            </p>
          )}
        </Card>
        <Card>
          <h2 style={{ marginTop: 0 }}>SMS-leverantör</h2>
          <p style={{ color: 'var(--c-ink-2)', fontSize: 13 }}>
            Hemligheter visas aldrig igen. Lämna dem tomma för att behålla redan sparade värden.
          </p>
          {editable ? <SmsForm partner={partner} sender={smsSender} /> : null}
        </Card>
      </div>

      {editable ? (
        <Card style={{ marginTop: 16 }}>
          <h2 style={{ marginTop: 0 }}>Flytta eller tilldela kund</h2>
          <MoveTenantForm
            partnerId={partner.partner_id}
            partnerName={partner.partner_name}
            tenants={tenants}
          />
        </Card>
      ) : null}

      <Card pad={0} style={{ marginTop: 16 }}>
        <Table
          cols={['Kund', 'Slug', 'Status']}
          rows={assigned.map((tenant) => [
            <Link key={tenant.id} href={`/kunder/${tenant.id}`}><b>{tenant.name}</b></Link>,
            tenant.slug,
            <Badge key={`${tenant.id}-status`} tone={tenant.status === 'active' ? 'success' : 'warning'} dot={false}>
              {tenant.status}
            </Badge>,
          ])}
        />
      </Card>
      {assigned.length === 0 ? <p style={{ color: 'var(--c-ink-2)' }}>Partnern har inga kunder ännu.</p> : null}

      <Card pad={0} style={{ marginTop: 16 }}>
        <Table
          cols={['Månad', 'Licensgrundande kunder', 'Summa', 'Status']}
          rows={history.map((month) => [
            month.month,
            month.customers,
            formatPartnerMoney(month.totalOre, partner.currency),
            <Badge key={month.month} tone={month.closed ? 'neutral' : 'success'} dot={false}>
              {month.closed ? 'Stängd' : 'Öppen · räknas om'}
            </Badge>,
          ])}
        />
      </Card>
    </>
  )
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p className="auth-error" role="alert">{state.error}</p>
  if (state.success) return <p role="status" style={{ color: 'var(--c-success)', fontSize: 13 }}>{state.success}</p>
  return null
}

function PartnerEditForm({ partner }: { partner: PartnerSummary }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updatePartner, {})
  useRefreshOnActionSuccess(state, pending)
  return (
    <form action={action} style={{ display: 'grid', gap: 12 }}>
      <input type="hidden" name="partnerId" value={partner.partner_id} />
      <Field label="Namn"><input name="name" defaultValue={partner.partner_name} required style={inputStyle} /></Field>
      <Field label={`Pris per aktiv kund (${partner.currency})`}>
        <input name="licensePrice" defaultValue={partnerPriceInputValue(partner.license_price_ore)} required inputMode="decimal" style={inputStyle} />
      </Field>
      <p style={{ margin: '-5px 0 0', color: 'var(--c-ink-2)', fontSize: 12 }}>
        Valfri summa. Ändringen räknar om alla licensrader i den öppna månaden; stängda månader ändras aldrig.
      </p>
      <Field label="Status">
        <select name="status" defaultValue={partner.partner_status} style={selectStyle}>
          <option value="active">Aktiv</option>
          <option value="suspended">Pausad</option>
        </select>
      </Field>
      <Feedback state={state} />
      <PartnerMutationSubmit
        state={state}
        pending={pending}
        triggerLabel="Spara partner…"
        confirmLabel="Bekräfta partnerändring"
        pendingLabel="Sparar…"
        warning="Pris eller status kan ändra åtkomst och räknar om partnerns öppna licensmånad. Stängda månader påverkas inte."
      />
    </form>
  )
}

function MoveTenantForm({
  partnerId,
  partnerName,
  tenants,
}: {
  partnerId: string
  partnerName: string
  tenants: PartnerTenantOption[]
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(moveTenantToPartner, {})
  useRefreshOnActionSuccess(state, pending)
  return (
    <form action={action} style={{ display: 'flex', alignItems: 'end', flexWrap: 'wrap', gap: 10 }}>
      <div style={{ flex: '1 1 260px' }}>
        <Field label="Kund">
          <select name="tenantId" required defaultValue="" style={selectStyle}>
            <option value="" disabled>Välj kund…</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name} · {tenant.status}{tenant.partnerId === partnerId ? ' · redan tilldelad' : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div style={{ flex: '1 1 220px' }}>
        <Field label="Mottagare">
          <select name="partnerId" defaultValue={partnerId} style={selectStyle}>
            <option value={partnerId}>{partnerName}</option>
            <option value="">Corevo · partner noll</option>
          </select>
        </Field>
      </div>
      <PartnerMutationSubmit
        state={state}
        pending={pending}
        triggerLabel="Tilldela partnern…"
        confirmLabel="Bekräfta tilldelning"
        pendingLabel="Flyttar…"
        warning="Flytten ändrar vem som kontrollerar kunden. Aktivitet någon gång under månaden räknas som hel månad hos berörda partners; Corevo är partner noll."
      />
      <div style={{ flexBasis: '100%' }}><Feedback state={state} /></div>
    </form>
  )
}

function SmsForm({ partner, sender }: { partner: PartnerSummary; sender: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(savePartnerSmsConfig, {})
  useRefreshOnActionSuccess(state, pending)
  return (
    <form action={action} style={{ display: 'grid', gap: 12 }}>
      <input type="hidden" name="partnerId" value={partner.partner_id} />
      <Field label="Leverantör">
        <select name="providerKey" defaultValue={partner.sms_provider_key} style={selectStyle}>
          <option value="corevo_46elks">Corevos standardväg</option>
          <option value="partner_46elks">Partnerns 46elks-konto</option>
        </select>
      </Field>
      <Field label="Avsändare"><input name="sender" defaultValue={sender ?? ''} maxLength={40} style={inputStyle} /></Field>
      <Field label="Användarnamn"><input name="username" autoComplete="off" style={inputStyle} placeholder="Tomt = behåll sparat" /></Field>
      <Field label="Lösenord"><input name="password" type="password" autoComplete="new-password" style={inputStyle} placeholder="Tomt = behåll sparat" /></Field>
      <Field label="Callback-hemlighet"><input name="callbackSecret" type="password" autoComplete="new-password" style={inputStyle} /></Field>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" name="enabled" defaultChecked={partner.sms_provider_enabled} /> Aktiv
      </label>
      <Feedback state={state} />
      <PartnerMutationSubmit
        state={state}
        pending={pending}
        triggerLabel="Spara SMS-inställning…"
        confirmLabel="Bekräfta SMS-inställning"
        pendingLabel="Sparar…"
        warning="Leverantör, avsändare och eventuella nya hemligheter börjar gälla för partnerns kommande SMS."
      />
    </form>
  )
}
