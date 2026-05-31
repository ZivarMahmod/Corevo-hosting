// The (kund) route group hosts BOTH the public signup (/registrera) and the
// auth-gated account area (/konto/*). The auth guard + portal chrome therefore
// live one level down in (kund)/konto/layout.tsx, NOT here — otherwise the
// signup page would redirect unauthenticated visitors to /login.
export default function KundLayout({ children }: { children: React.ReactNode }) {
  return children
}
