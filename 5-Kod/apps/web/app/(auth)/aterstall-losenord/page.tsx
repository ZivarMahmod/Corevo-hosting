import type { Metadata } from 'next'
import { PasswordResetForm } from './PasswordResetForm'

export const metadata: Metadata = { title: 'Återställ lösenord' }

export default function ResetPasswordPage() {
  return <PasswordResetForm />
}
