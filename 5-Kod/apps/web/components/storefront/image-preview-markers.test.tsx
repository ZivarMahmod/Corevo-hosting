import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Gallery } from './Gallery'
import { HeroCarousel } from './HeroCarousel'
import { Parallax } from './Parallax'

describe('generic preview image slot markers', () => {
  it('keeps duplicate URLs assigned to their semantic hero and gallery indexes', () => {
    const duplicate = 'https://images.example/shared.jpg'
    const html = renderToStaticMarkup(<>
      <HeroCarousel images={[{ src: duplicate, alt: '' }, { src: duplicate, alt: '' }]}>
        <h1>Rubrik</h1>
      </HeroCarousel>
      <Gallery photos={[{ src: duplicate, alt: 'Ett' }, { src: duplicate, alt: 'Två' }]} />
    </>)

    for (const field of ['hero_images.0', 'hero_images.1', 'gallery_images.0', 'gallery_images.1']) {
      expect(html).toContain(`data-corevo-editor-stable-field="${field}"`)
    }
  })

  it('owns a stable semantic marker for singleton imagery', () => {
    const html = renderToStaticMarkup(
      <Parallax src="https://images.example/shared.jpg" alt="" editorField="closing_image">
        <span>Innehåll</span>
      </Parallax>,
    )
    expect(html).toContain('data-corevo-editor-stable-field="closing_image"')
  })
})
