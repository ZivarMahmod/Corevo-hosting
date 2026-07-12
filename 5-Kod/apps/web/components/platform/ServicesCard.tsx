'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  createTenantService,
  updateTenantService,
  deleteTenantService,
  setServiceStaff,
  uploadServiceImage,
  removeServiceImage,
  type ActionState,
} from '@/lib/platform/actions'
import { centsToKronorInput } from '@/lib/platform/billing'
import { Icon } from '@/components/portal/ui'
import styles from './platform.module.css'

/**
 * Super-admin services surface for a CHOSEN salon. Kompakt lista där varje tjänst är
 * en hopfälld rad (native <details>) — sammanfattning syns, klick fäller ut hela
 * redigeraren. Ingen vägg av öppna formulär, ingen scroll-orgie. Tjänster grupperas
 * per kategori. Per tjänst: namn/pris/rabatt/längd/kategori/badge/beskrivning/sortering/
 * aktiv, vilka i personalen som kan utföra den (staff_services), bild (R2), samt säker
 * radering (arkiveras om den har bokningar — FK RESTRICT). Priser i kr; servern → öre.
 */
type Service = {
  id: string
  name: string
  price_cents: number
  duration_min: number
  active: boolean
  description: string | null
  category: string | null
  sale_price_cents: number | null
  badge: string | null
  image_url: string | null
  sort_order: number
  staffIds: string[]
  bookingCount: number
}
type StaffOption = { id: string; title: string | null; active: boolean }

const kr = new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 })
const OTHER = 'Övrigt'

export function ServicesCard({
  tenantId,
  services,
  staff,
  storefrontUrl,
}: {
  tenantId: string
  services: Service[]
  staff: StaffOption[]
  storefrontUrl: string
}) {
  // Group by category (blank → "Övrigt"), each group sorted by sort_order then name.
  const groups = new Map<string, Service[]>()
  for (const s of services) {
    const key = s.category?.trim() || OTHER
    const list = groups.get(key) ?? []
    list.push(s)
    groups.set(key, list)
  }
  const groupNames = [...groups.keys()].sort((a, b) =>
    a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b, 'sv'),
  )
  for (const list of groups.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'sv'))
  }
  return (
    <div>
      <div className={styles.svcHead}>
        <p className={styles.hint} style={{ margin: 0 }}>
          Klicka en tjänst för att redigera allt — pris, rabatt, kategori, personal, bild.
        </p>
        <a className={styles.svcPreviewLink} href={storefrontUrl} target="_blank" rel="noreferrer">
          <Icon name="link" size={13} />
          Så syns tjänsterna på sidan
        </a>
      </div>

      <AddServiceForm tenantId={tenantId} />

      {services.length === 0 ? (
        <p className={styles.hint} style={{ marginTop: 12 }}>
          Inga tjänster ännu — lägg till företagets första ovan. Bokningsmotorn kräver minst en
          aktiv tjänst för att ta emot bokningar.
        </p>
      ) : (
        groupNames.map((g) => (
          <div key={g} className={styles.svcGroup}>
            <p className={styles.svcGroupTitle}>
              {g} · {groups.get(g)!.length}
            </p>
            {groups.get(g)!.map((s) => (
              <ServiceRow key={s.id} tenantId={tenantId} service={s} staff={staff} />
            ))}
          </div>
        ))
      )}
    </div>
  )
}

// ── Lägg till tjänst (kompakt) ───────────────────────────────────────────────────
function AddServiceForm({ tenantId }: { tenantId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createTenantService, {})
  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenantId" value={tenantId} />
      <p className={styles.groupTitle} style={{ padding: 0 }}>
        Lägg till tjänst
      </p>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Namn</span>
          <input name="name" placeholder="t.ex. Behandling" required />
        </label>
        <label className={styles.field}>
          <span>Pris (kr)</span>
          <input name="price" inputMode="decimal" placeholder="0" />
        </label>
        <label className={styles.field}>
          <span>Längd (min)</span>
          <input name="duration_min" inputMode="numeric" defaultValue="30" />
        </label>
      </div>
      <div className={styles.actions}>
        <button type="submit" className={styles.btn} disabled={pending}>
          {pending ? 'Lägger till…' : 'Lägg till tjänst'}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  )
}

// ── En tjänst: hopfälld rad → full redigerare ───────────────────────────────────
function ServiceRow({ tenantId, service, staff }: { tenantId: string; service: Service; staff: StaffOption[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateTenantService, {})
  const [staffState, staffAction, staffPending] = useActionState<ActionState, FormData>(setServiceStaff, {})
  const [imgState, imgAction, imgPending] = useActionState<ActionState, FormData>(uploadServiceImage, {})
  const [rmImgState, rmImgAction, rmImgPending] = useActionState<ActionState, FormData>(removeServiceImage, {})
  const [delState, delAction, delPending] = useActionState<ActionState, FormData>(deleteTenantService, {})
  // Tvåstegsbekräftelse (samma mönster som ServicesManager/StaffRoster): raderingen är
  // KUNDENS tjänst — den som klickar är inte den som drabbas. Klick 1 armerar (knappen
  // blir "Säker? Ta bort permanent" + en Ångra), klick 2 skickar formuläret. En arm per
  // rad (komponenten är per tjänst) → kan aldrig läcka mellan tjänster.
  const [armedImg, setArmedImg] = useState(false)
  const [armedDel, setArmedDel] = useState(false)
  // Ny/utbytt bild → avväpna, annars står bild-knappen kvar SKARP och nästa klick
  // raderar den nyss uppladdade bilden på ett klick.
  useEffect(() => setArmedImg(false), [service.image_url])

  const hasSale = service.sale_price_cents !== null && service.sale_price_cents < service.price_cents
  const booked = service.bookingCount > 0

  return (
    <details className={styles.svcRow}>
      <summary className={styles.svcSummary}>
        {service.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.svcThumb} src={service.image_url} alt="" />
        ) : (
          <span className={`${styles.svcThumb} ${styles.svcThumbEmpty}`}>
            <Icon name="scissors" size={16} />
          </span>
        )}
        <span className={styles.svcSumMain}>
          <span className={styles.svcSumName}>
            {service.name}
            {service.badge ? <span className={styles.svcBadge}>{service.badge}</span> : null}
            {!service.active ? <span className={styles.svcOff}>Avstängd</span> : null}
          </span>
          <span className={styles.svcSumMeta}>
            {service.duration_min} min
            {staff.length > 0 ? ` · ${service.staffIds.length || 'alla'} i personalen` : ''}
            {booked ? ` · ${service.bookingCount} bokning(ar)` : ''}
          </span>
        </span>
        <span className={styles.svcPrice}>
          {hasSale ? (
            <>
              <span className={styles.svcOld}>{kr.format(service.price_cents / 100)}</span>
              <span className={styles.svcSale}>{kr.format(service.sale_price_cents! / 100)}</span>
            </>
          ) : (
            kr.format(service.price_cents / 100)
          )}
        </span>
        <Icon name="chevronDown" size={16} className={styles.svcChev} />
      </summary>

      <div className={styles.svcBody}>
        {/* Redigera fält */}
        <form action={formAction} className={styles.svcSub}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="serviceId" value={service.id} />
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span>Namn</span>
              <input name="name" defaultValue={service.name} required />
            </label>
            <label className={styles.field}>
              <span>Pris (kr)</span>
              <input name="price" inputMode="decimal" defaultValue={centsToKronorInput(service.price_cents)} />
            </label>
            <label className={styles.field}>
              <span>Rabattpris (kr)</span>
              <input
                name="sale_price"
                inputMode="decimal"
                placeholder="—"
                defaultValue={service.sale_price_cents !== null ? centsToKronorInput(service.sale_price_cents) : ''}
              />
            </label>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span>Längd (min)</span>
              <input name="duration_min" inputMode="numeric" defaultValue={String(service.duration_min)} />
            </label>
            <label className={styles.field}>
              <span>Kategori</span>
              <input name="category" placeholder="t.ex. Behandling" defaultValue={service.category ?? ''} />
            </label>
            <label className={styles.field}>
              <span>Badge (t.ex. Populär)</span>
              <input name="badge" placeholder="—" defaultValue={service.badge ?? ''} />
            </label>
          </div>
          <label className={styles.field}>
            <span>Beskrivning</span>
            <textarea name="description" rows={2} placeholder="Kort säljande text (valfritt)" defaultValue={service.description ?? ''} />
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.field} style={{ maxWidth: 140 }}>
              <span>Sortering</span>
              <input name="sort_order" inputMode="numeric" defaultValue={String(service.sort_order)} />
            </label>
            <label className={styles.svcCheck} style={{ alignSelf: 'end', paddingBottom: 10 }}>
              <input type="checkbox" name="active" defaultChecked={service.active} />
              <span>Aktiv (syns i bokning + på sidan)</span>
            </label>
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.btn} disabled={pending}>
              {pending ? 'Sparar…' : 'Spara'}
            </button>
            <Feedback state={state} />
          </div>
        </form>

        {/* Personal som kan utföra tjänsten */}
        <form action={staffAction} className={styles.svcSub}>
          <input type="hidden" name="tenantId" value={tenantId} />
          <input type="hidden" name="serviceId" value={service.id} />
          <p className={styles.svcSubTitle}>Vem kan utföra den</p>
          {staff.length === 0 ? (
            <p className={styles.hint} style={{ margin: 0 }}>
              Ingen personal än — lägg till i Personal-fliken. Utan koppling kan alla utföra tjänsten.
            </p>
          ) : (
            <>
              <div className={styles.svcStaffGrid}>
                {staff.map((st) => (
                  <label key={st.id} className={styles.svcCheck}>
                    <input
                      type="checkbox"
                      name="staffId"
                      value={st.id}
                      defaultChecked={service.staffIds.includes(st.id)}
                    />
                    <span>
                      {st.title || 'Medarbetare'}
                      {!st.active ? ' (inaktiv)' : ''}
                    </span>
                  </label>
                ))}
              </div>
              <div className={styles.actions}>
                <button type="submit" className={styles.btn} disabled={staffPending}>
                  {staffPending ? 'Sparar…' : 'Spara personal'}
                </button>
                <Feedback state={staffState} />
              </div>
            </>
          )}
        </form>

        {/* Bild */}
        <div className={styles.svcSub}>
          <p className={styles.svcSubTitle}>Bild</p>
          <form action={imgAction} className={styles.actions}>
            <input type="hidden" name="tenantId" value={tenantId} />
            <input type="hidden" name="serviceId" value={service.id} />
            <input type="file" name="image" accept="image/*" />
            <button type="submit" className={styles.btn} disabled={imgPending}>
              {imgPending ? 'Laddar upp…' : service.image_url ? 'Byt bild' : 'Ladda upp'}
            </button>
            <Feedback state={imgState} />
          </form>
          {service.image_url ? (
            <form action={rmImgAction} className={styles.actions}>
              <input type="hidden" name="tenantId" value={tenantId} />
              <input type="hidden" name="serviceId" value={service.id} />
              {armedImg ? (
                <>
                  <button type="submit" className={styles.btnDanger} disabled={rmImgPending}>
                    {rmImgPending ? 'Tar bort…' : 'Säker? Ta bort permanent'}
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={rmImgPending}
                    onClick={() => setArmedImg(false)}
                  >
                    Ångra
                  </button>
                </>
              ) : (
                <button type="button" className={styles.btnDanger} onClick={() => setArmedImg(true)}>
                  Ta bort bild
                </button>
              )}
              <Feedback state={rmImgState} />
            </form>
          ) : null}
        </div>

        {/* Ta bort / arkivera */}
        <div className={styles.svcSub}>
          {booked ? (
            <p className={styles.hint} style={{ margin: 0 }}>
              Tjänsten har {service.bookingCount} bokning(ar) och kan inte raderas (historiken skyddas).
              Stäng av den ovan (avmarkera Aktiv + Spara) — då försvinner den från bokning och sida.
            </p>
          ) : (
            <form action={delAction} className={styles.actions}>
              <input type="hidden" name="tenantId" value={tenantId} />
              <input type="hidden" name="serviceId" value={service.id} />
              {armedDel ? (
                <>
                  <button type="submit" className={styles.btnDanger} disabled={delPending}>
                    {delPending ? 'Tar bort…' : 'Säker? Ta bort permanent'}
                  </button>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={delPending}
                    onClick={() => setArmedDel(false)}
                  >
                    Ångra
                  </button>
                </>
              ) : (
                <button type="button" className={styles.btnDanger} onClick={() => setArmedDel(true)}>
                  Ta bort tjänst
                </button>
              )}
              <Feedback state={delState} />
            </form>
          )}
        </div>
      </div>
    </details>
  )
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <span className={`${styles.feedback} auth-error`} role="alert">
        {state.error}
      </span>
    )
  if (state.success)
    return (
      <span className={`${styles.feedback} ${styles.feedbackOk}`} role="status">
        {state.success}
      </span>
    )
  return null
}
