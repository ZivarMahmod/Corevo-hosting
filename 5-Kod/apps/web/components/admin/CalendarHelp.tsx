'use client'

import { useState, type ReactNode } from 'react'
import { Icon, Modal } from '@/components/portal/ui'
import styles from './calendar.module.css'

/** Hjälp för kalendern (goal-66).
 *
 *  Wavy har ingen manual — de har en fråga-knapp och korta artiklar. Det är rätt:
 *  en frisör läser aldrig en handbok, men glömmer gärna EN sak ("hur blockerar jag
 *  lunch?") och vill ha svaret på tre sekunder.
 *
 *  Därför: en enda diskret knapp, och svar på de frågor folk faktiskt ställer — inte
 *  en funktionslista. Ingen tour, ingen popup som tar över första gången (det är en
 *  arbetsyta man öppnar femtio gånger om dagen; en tour blir en irritation nio av tio). */

const TIPS: { q: string; a: string }[] = [
  {
    q: 'Hur bokar jag in en kund?',
    a: 'Klicka på en ledig tid i kalendern — då är personen och tiden redan ifyllda. Välj tjänst, skriv kundens namn, klart. Bara namnet krävs; e-post och telefon är frivilliga.',
  },
  {
    q: 'Kunden finns inte i listan',
    a: 'Skriv bara klart namnet ändå. Får du ingen träff läggs kunden upp som ny när du bokar — du behöver inte skapa den först.',
  },
  {
    q: 'Hur flyttar jag en tid?',
    a: 'Dra bokningen dit du vill ha den — även till en annan person. Du ser tiden växa fram medan du drar, och får bekräfta innan något ändras. Krockar tiden med en annan bokning stoppas flytten och bokningen ligger kvar.',
  },
  {
    q: 'Hur lägger jag in lunch eller frånvaro?',
    a: 'Blockera tid. Samma sak används för rast, frånvaro och möten — blockerad tid går inte att boka, varken av dig eller av en kund på sajten. Klicka på en blockering för att ta bort den.',
  },
  {
    q: 'Varför visas inte alla tider?',
    a: 'Kalendern erbjuder bara tider där tjänsten faktiskt får plats — inom personens arbetstid, utan att krocka med en bokning eller blockering. Saknas tider: kolla arbetstiderna under Inställningar.',
  },
  {
    q: 'Får kunden ett mejl?',
    a: 'Bara om du väljer det. Innan du sparar står det exakt vad som skickas och till vilken adress. Saknar kunden e-post kan inget skickas — och då säger vi det, i stället för att låtsas.',
  },
  {
    q: 'Vad betyder de streckade rutorna?',
    a: 'Randigt mönster = blockerad eller utanför arbetstid. Streckad kant och ⚠ = obekräftad bokning som väntar på ditt beslut.',
  },
]

export function CalendarHelp({
  label,
  mobileHeader = false,
  children,
}: {
  label?: string
  mobileHeader?: boolean
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={`${styles.helpBtn}${label ? ` ${styles.helpBtnLabelled}` : ''}${mobileHeader ? ` ${styles.helpBtnMobileHeader}` : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Hjälp om kalendern"
        title="Hjälp"
      >
        {mobileHeader ? <span aria-hidden="true">?</span> : <Icon name="info" size={16} />}
        {label && <span>{label}</span>}
      </button>

      {open && (
        <Modal title="Hjälp" sub="Kalendern" onClose={() => setOpen(false)} ariaLabel="Hjälp">
          <div className={styles.helpList}>
            {TIPS.map((t) => (
              // <details> är webbläsarens egen dragspelskontroll: fungerar med
              // tangentbord och skärmläsare utan en rad JavaScript.
              <details key={t.q} className={styles.helpItem}>
                <summary className={styles.helpQ}>
                  {t.q}
                  <Icon name="chevronRight" size={15} />
                </summary>
                <p className={styles.helpA}>{t.a}</p>
              </details>
            ))}
          </div>
          {children ? <div className={styles.helpExtras}>{children}</div> : null}
        </Modal>
      )}
    </>
  )
}
