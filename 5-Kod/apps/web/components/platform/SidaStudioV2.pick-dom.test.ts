// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { focusEditorControl } from './SidaStudioV2.pick'

describe('SidaStudioV2 exact control focus', () => {
  it('focuses and scrolls the exact indexed image row with reduced-motion support', () => {
    const root = document.createElement('div')
    document.body.append(root)
    root.innerHTML = `
      <button data-corevo-editor-field="hero_images.0">Bild 1</button>
      <button data-corevo-editor-field="hero_images.1">Bild 2</button>
    `
    const first = root.children[0] as HTMLButtonElement
    const second = root.children[1] as HTMLButtonElement
    first.scrollIntoView = () => { throw new Error('wrong row') }
    let options: ScrollIntoViewOptions | undefined
    second.scrollIntoView = (value) => { options = value as ScrollIntoViewOptions }

    expect(focusEditorControl(root, 'hero_images.1', true)).toBe(true)
    expect(document.activeElement).toBe(second)
    expect(options).toEqual({ behavior: 'auto', block: 'center' })
    root.remove()
  })
})
