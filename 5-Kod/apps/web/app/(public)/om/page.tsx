import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { currentTenant } from '@/lib/tenant-data'
import { BookCta } from '@/components/brand/BookCta'
import styles from '@/components/brand/brand.module.css'

export const metadata: Metadata = { title: 'Om oss' }

const POINTS = [
  { mark: '✓', text: 'Erfarna stylister som lyssnar på vad du vill ha.' },
  { mark: '✓', text: 'Kvalitetsprodukter och behandlingar med omsorg.' },
  { mark: '✓', text: 'Enkel bokning online — ändra eller avboka när du behöver.' },
] as const

export default async function AboutPage() {
  const bundle = await currentTenant()
  if (!bundle) notFound()
  const { tenant } = bundle

  return (
    <section className="section">
      <div className={`section-inner ${styles.sectionInner}`}>
        <p className={styles.sectionEyebrow}>Om oss</p>
        <h1>Om {tenant.name}</h1>
        <div className="prose">
          <p>
            {tenant.name} är en salong där hantverk, kvalitet och personlig service står i
            centrum. Vårt mål är att du ska lämna oss nöjd – varje gång.
          </p>
          <p>
            Vi tar emot både nya och återkommande gäster. Boka enkelt online och välj den tid
            som passar dig bäst.
          </p>
        </div>

        <ul className={styles.points}>
          {POINTS.map((p) => (
            <li key={p.text} className={styles.point}>
              <span className={styles.pointMark} aria-hidden="true">
                {p.mark}
              </span>
              <span>{p.text}</span>
            </li>
          ))}
        </ul>

        <p className="section-more">
          <BookCta />
        </p>
      </div>
    </section>
  )
}
