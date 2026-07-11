import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// goal-55 körning 7A: kassan flyttad till (public)/kassa så köparen aldrig byter
// värld (temade naven behålls). Filen behålls som ren redirect (build-once-never-
// delete) — gamla länkar/bokmärken till /butik/kassa landar rätt.
export default function KassaRedirect() {
  redirect('/kassa')
}
