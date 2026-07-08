import { redirect } from 'next/navigation'

/**
 * Varumärke ersattes av "Redigera sidan" (/admin/sida) — samma SidaStudio som
 * super-adminens kundkort, med live-preview. Gamla bokmärken/länkar landar rätt.
 */
export default function BrandingPage() {
  redirect('/admin/sida')
}
