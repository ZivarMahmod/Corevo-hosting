import s from '../blogg-section.module.css'

function pageHref(basePath: string, page: number): string {
  return page === 1 ? basePath : `${basePath}?page=${page}`
}

export function BloggPagination({
  page,
  totalPages,
  basePath = '/blogg',
}: {
  page: number
  totalPages: number
  basePath?: string
}) {
  if (totalPages <= 1) return null
  return (
    <nav className={s.pagination} aria-label="Bloggsidor">
      {page > 1 ? (
        <a className={s.paginationLink} href={pageHref(basePath, page - 1)} rel="prev">
          ← Föregående
        </a>
      ) : <span />}
      <span className={s.paginationStatus}>Sida {page} av {totalPages}</span>
      {page < totalPages ? (
        <a className={s.paginationLink} href={pageHref(basePath, page + 1)} rel="next">
          Nästa →
        </a>
      ) : <span />}
    </nav>
  )
}
