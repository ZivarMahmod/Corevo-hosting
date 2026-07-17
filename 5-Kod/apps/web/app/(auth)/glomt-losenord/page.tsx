import type { Metadata } from 'next'
import { PasswordResetRequestForm } from './PasswordResetRequestForm'

export const metadata: Metadata = { title: 'Glömt lösenord' }

export default function ForgotPasswordPage() {
  return <PasswordResetRequestForm />
}
