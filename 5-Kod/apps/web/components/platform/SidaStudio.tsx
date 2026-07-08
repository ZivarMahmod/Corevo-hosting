'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import type { TenantBranding } from '@corevo/ui'
import { Badge } from '@/components/portal/ui'
import { PlatformBrandingForm } from './PlatformBrandingForm'
import { StorefrontContentCard } from './StorefrontContentCard'
import { SajtbyggareControl } from './SajtbyggareControl'
import { ThemePicker } from './ThemePicker'
import { TenantContactForm } from './TenantContactForm'
import { StorefrontExtrasCard } from './StorefrontExtrasCard'
import styles from './SidaStudio.module.css'

type Copy = {
  heroEyebrow: string
  heroTitle: string
  heroLede: string
  aboutCopy: string
  tagline: string
  italic: string
}

/**
 * Sida-fliken (super-admin) som en split-view: ALLA redigeringskontroller till vänster,
 * en sticky LIVE-preview av kundens skarpa storefront till höger. Färg/typsnitt speglas
 * i previewen DIREKT medan du ändrar (postMessage → iframen sätter CSS-vars, innan spara).
 * Text/bilder syns när du sparat och klickar "Ladda om" (server-render). Redigeringen
 * skriver tenant_settings = det lagret sidan faktiskt renderar.
 */
const MSG_SOURCE = 'corevo-sida'

export function SidaStudio({
  tenantId,
  previewPath,
  storefrontUrl,
  storefrontHost,
  templateKey,
  isActive,
  branding,
  copy,
  heroImages,
  galleryImages,
  siteEditorEnabled,
  contactEmail,
  contactPhone,
  address,
}: {
  tenantId: string
  previewPath: string
  storefrontUrl: string
  storefrontHost: string
  templateKey: string
  isActive: boolean
  branding: TenantBranding
  copy: Copy
  heroImages: string[]
  galleryImages: string[]
  siteEditorEnabled: boolean
  contactEmail: string | null
  contactPhone: string | null
  address: string | null
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const src = useMemo(
    () => (reloadToken > 0 ? `${previewPath}?_p=${reloadToken}` : previewPath),
    [previewPath, reloadToken],
  )

  // Push a live brand-token patch into the preview iframe (same-origin).
  const pushTokens = useCallback((tokens: Record<string, string>) => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: MSG_SOURCE, type: 'brand-preview', tokens },
      window.location.origin,
    )
  }, [])

  return (
    <div className={styles.grid}>
      {/* ── vänster: redigering ── */}
      <div className={styles.left}>
        <section className={styles.card}>
          <h3 className={styles.cardHead}>Mall</h3>
          <p className={styles.note}>
            Klicka ett mall-kort för att byta — kundens sida byter layout direkt och previewen
            laddas om.
          </p>
          <ThemePicker
            tenantId={tenantId}
            current={templateKey}
            onSaved={() => setReloadToken((t) => t + 1)}
          />
        </section>

        <section className={styles.card}>
          <h3 className={styles.cardHead}>Varumärke</h3>
          <p className={styles.liveHint}>
            <span className={styles.liveDot} aria-hidden="true" />
            Färg &amp; typsnitt syns direkt i previewen medan du ändrar
          </p>
          <PlatformBrandingForm tenantId={tenantId} branding={branding} onLiveTokens={pushTokens} />
        </section>

        <section className={styles.card}>
          <h3 className={styles.cardHead}>Kontakt &amp; adress</h3>
          <p className={styles.note}>
            Syns i storefrontens footer. Öppettider redigeras inte här — de härleds ur
            personalens veckoscheman (Personal-fliken).
          </p>
          <TenantContactForm
            tenantId={tenantId}
            email={contactEmail}
            phone={contactPhone}
            address={address}
          />
        </section>

        <section className={styles.card}>
          <h3 className={styles.cardHead}>Text &amp; bilder</h3>
          <p className={styles.note}>
            Spara och klicka <strong>Ladda om</strong> i previewen för att se text- och
            bildändringar.
          </p>
          <StorefrontContentCard
            tenantId={tenantId}
            copy={copy}
            heroImages={heroImages}
            galleryImages={galleryImages}
          />
        </section>

        <details className={styles.card}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 17, color: 'var(--c-ink)' }}>
            Fler bilder &amp; fakta{' '}
            <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--c-ink-3)' }}>
              (används av vissa mallar, ej FreshCut)
            </span>
          </summary>
          <div style={{ marginTop: 14 }}>
            <StorefrontExtrasCard
              tenantId={tenantId}
              aboutImage={branding.about_image ?? null}
              closingImage={branding.closing_image ?? null}
              stats={branding.stats ?? []}
            />
          </div>
        </details>

        <section className={styles.card}>
          <h3 className={styles.cardHead}>Kunden redigerar själv</h3>
          <p className={styles.note}>
            Slår på/av den kund-egna sid-editorn. Påverkar bara kundens editor, aldrig den
            publika sidan.
          </p>
          <SajtbyggareControl tenantId={tenantId} enabled={siteEditorEnabled} />
        </section>
      </div>

      {/* ── höger: sticky live-preview ── */}
      <div className={styles.right}>
        <div className={styles.bar}>
          <div className={styles.barSide}>
            <span className={styles.host}>{storefrontHost}</span>
            <Badge tone="neutral">mall: {templateKey}</Badge>
          </div>
          <div className={styles.barSide}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => setReloadToken((t) => t + 1)}
              title="Ladda om previewen (efter du sparat text/bild)"
            >
              Ladda om
            </button>
            <a
              className={styles.btnPrimary}
              href={storefrontUrl}
              target="_blank"
              rel="noreferrer"
              title="Öppna den skarpa sidan i ny flik"
            >
              Öppna live ↗
            </a>
          </div>
        </div>

        <div className={styles.stage}>
          {isActive ? (
            <iframe
              ref={iframeRef}
              src={src}
              className={styles.frame}
              title={`Förhandsvisning av ${storefrontHost}`}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              loading="lazy"
            />
          ) : (
            <div className={styles.blocked}>
              <strong>Storefronten är pausad</strong>
              <p>
                Salongen är inte aktiv, så den publika sidan är blockerad. Återaktivera salongen
                i Drift för att förhandsvisa den.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
