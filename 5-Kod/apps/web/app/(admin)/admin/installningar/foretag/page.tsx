import { redirect } from 'next/navigation'

/** Bakåtkompatibel väg för gamla bokmärken. Företagssidan var en blandad skrivyta
 * för plats, bokningsregler, utskick, integrationer och sekretess. Dessa har nu en
 * tydlig ägare; den enda gamla navlänken hit avsåg påminnelser. */
export default function LegacyCompanySettingsPage() {
  redirect('/admin/installningar/paminnelser')
}
