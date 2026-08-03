import { redirect } from 'next/navigation'

export default function BokningsvyRedirect() {
  redirect('/admin/bokningar?vy=dag')
}
