import type { ReactNode } from 'react'

/**
 * Back-office data table — uppercase hairline header, hover-striped rows, last
 * column right-aligned. Ported from the design-system handoff (back-office/
 * Shell.jsx); row hover is done in CSS (.ptable, app/portal-global.css, scoped
 * under [data-world="backoffice"]) instead of the prototype's JS handlers, so it
 * works in server components. Consumes the back-office --c-* tokens + .num role.
 */
export function Table({ cols, rows }: { cols: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="ptable">
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} data-last={i === cols.length - 1 ? '' : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci} data-last={ci === r.length - 1 ? '' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
