import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Gamla publicerade länkar och bokmärken till /butik/kassa behåller sitt URL-kontrakt
// genom denna redirect till den kanoniska kassan.
export default function KassaRedirect() {
  redirect('/kassa')
}
