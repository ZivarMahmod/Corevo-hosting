/** White-label footer — tenant name only, never any Corevo branding. */
export function Footer({ tenant }: { tenant: { name: string } }) {
  return (
    <footer className="footer">
      <p>
        © {new Date().getFullYear()} {tenant.name}
      </p>
    </footer>
  )
}
