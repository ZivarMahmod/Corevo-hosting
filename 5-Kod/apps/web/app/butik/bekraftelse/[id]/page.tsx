import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// goal-55 körning 7A: bekräftelsen flyttad till (public)/bekraftelse/[id] så köparen
// aldrig byter värld (temade naven behålls). Filen behålls som ren redirect
// (build-once-never-delete) — gamla länkar/mejl till /butik/bekraftelse landar rätt.
export default async function BekraftelseRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/bekraftelse/${id}`)
}
