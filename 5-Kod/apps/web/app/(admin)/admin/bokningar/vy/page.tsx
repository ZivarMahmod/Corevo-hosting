import { redirect } from 'next/navigation'

/** Helskärmskiosken var ett ANDRA system över samma bokningar: egna resurskolumner,
 *  egen dagbläddring, egna "lediga tider" räknade ur working_hour_slots — medan
 *  /admin/bokningar samtidigt visade lista + veckoraster. Två ytor, två sanningar.
 *
 *  Kalendern (goal-66) är nu ETT arbetsbord: dag/vecka/månad, kolumn per resurs, och
 *  den fyller skärmen och scrollar internt — helskärmsläget är alltså inbyggt, inte en
 *  egen sida. Kiosken har ingen uppgift kvar.
 *
 *  Routen lever vidare som omdirigering: en surfplatta med den gamla adressen sparad,
 *  eller ett bokmärke, ska landa i kalendern — aldrig i en 404. */
export default function BokningsvyRedirect() {
  redirect('/admin/bokningar?vy=dag')
}
