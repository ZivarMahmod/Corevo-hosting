/** Back-office UI primitives (design-system handoff → stack). Most consume the
 *  [data-world="backoffice"] --c-* tokens + type roles, so render them only inside
 *  a back-office shell. EXCEPTION: LoyaltyBlock is world-aware (pass
 *  world="storefront" for /konto — it then reads the salon's --color-* theme,
 *  never Corevo gold). CustomerRecognition + LoyaltyBlock are hook-free and
 *  server-safe; CommandPalette / PiiReveal / NotesThread are client components. */
export { Icon, type IconName } from './Icon'
export { Card } from './Card'
export { Badge, type BadgeTone } from './Badge'
export { Button, type ButtonVariant, type ButtonSize } from './Button'
export { Stat } from './Stat'
export { Sparkline } from './Sparkline'
export { PageHead } from './PageHead'
export { Table } from './Table'
export { Callout, type CalloutTone } from './Callout'
export { Drawer } from './Drawer'
export { ToastProvider, useToast, type ToastTone } from './Toast'
export { ViewSwitcher, usePersistentView, type ViewOption } from './ViewSwitcher'
export { CommandPalette, type CommandItem } from './CommandPalette'
export { CustomerRecognition, tierTone } from './CustomerRecognition'
export { LoyaltyBlock, type LoyaltyWorld } from './LoyaltyBlock'
export { PiiReveal, maskPhone, maskEmail } from './PiiReveal'
export { NotesThread, type ThreadNote } from './NotesThread'
