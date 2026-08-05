import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Gamla publicerade länkar och mejl till /butik/bekraftelse behåller sitt URL-kontrakt
// genom denna redirect till den kanoniska bekräftelsen.
export default async function BekraftelseRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/bekraftelse/${id}`)
}
