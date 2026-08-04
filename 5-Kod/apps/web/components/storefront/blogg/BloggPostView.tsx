import Link from 'next/link'
import { formatBloggLongDate, type BloggPost } from '@/lib/storefront/blogg/types'
import s from './blogg-post.module.css'

export function BloggPostView({
  post,
  backHref = '/blogg',
}: {
  post: BloggPost
  backHref?: string
}) {
  const date = formatBloggLongDate(post.publishedAt)
  const paragraphs = (post.body ?? '')
    .split(/\r?\n\r?\n/)
    .map((text) => text.trim())
    .filter(Boolean)

  return (
    <section className="section" data-module="blogg" data-view="post">
      <div className={`section-inner ${s.inner}`}>
        <p className={s.back}>
          <Link href={backHref} className={s.backLink}>
            ← Alla inlägg
          </Link>
        </p>

        {post.coverImageUrl ? (
          <div className={s.cover}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.coverImageUrl}
              alt={post.coverImageAlt ?? post.title}
              className={s.coverImg}
            />
          </div>
        ) : null}

        {date ? <p className={s.date}>{date}</p> : null}
        <h1 className={s.title}>{post.title}</h1>

        <div className={s.body}>
          {paragraphs.map((text, index) => (
            <p key={index} className={s.para}>
              {text}
            </p>
          ))}
        </div>
      </div>
    </section>
  )
}
