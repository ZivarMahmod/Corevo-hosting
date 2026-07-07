'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/portal/ui'
import styles from './TenantPreviewFrame.module.css'

/**
 * Live storefront preview for the Sida tab. Frames the SAME-ORIGIN preview route
 * (/salong-preview/[slug]) which server-renders the tenant's REAL storefront — so no
 * X-Frame-Options block (the public <slug>.corevo.se page is cross-origin, always
 * DENY). "Ladda om" cache-busts after a save; "Öppna live" opens the true public page.
 * Read-only mirror — all editing happens in the forms below, which the reload reflects.
 */
export function SidaPreview({
  previewPath,
  storefrontUrl,
  storefrontHost,
  templateKey,
  isActive,
}: {
  previewPath: string
  storefrontUrl: string
  storefrontHost: string
  templateKey: string
  isActive: boolean
}) {
  const [reloadToken, setReloadToken] = useState(0)
  const src = useMemo(
    () => (reloadToken > 0 ? `${previewPath}?_p=${reloadToken}` : previewPath),
    [previewPath, reloadToken],
  )

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <span className={styles.host}>{storefrontHost}</span>
          <Badge tone="neutral">mall: {templateKey}</Badge>
        </div>
        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={styles.tbBtn}
            onClick={() => setReloadToken((t) => t + 1)}
            title="Ladda om förhandsvisningen (efter du sparat en ändring)"
          >
            Ladda om
          </button>
          <a
            className={styles.tbBtnPrimary}
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
              Salongen är inte aktiv, så den publika sidan är blockerad. Återaktivera salongen i
              Drift för att förhandsvisa den.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
