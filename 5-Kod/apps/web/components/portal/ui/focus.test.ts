// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import { getFocusableElements, trapTab } from './focus'

describe('focus trap', () => {
  it('ignores unavailable controls and wraps Tab at both boundaries', () => {
    document.body.innerHTML = `<button id="outside"></button><div id="dialog" tabindex="-1">
      <button id="first"></button><button hidden></button><button style="display:none"></button>
      <button tabindex="-1"></button><button disabled></button><a href="/" aria-disabled="true"></a>
      <span hidden><button></button></span><a id="last" href="/"></a>
    </div>`
    const dialog = document.querySelector<HTMLElement>('#dialog')!
    const [first, last] = getFocusableElements(dialog)

    expect(getFocusableElements(dialog)).toEqual([first, last])
    last!.focus()
    trapTab(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }), dialog)
    expect(document.activeElement).toBe(first)
    first!.focus()
    trapTab(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }), dialog)
    expect(document.activeElement).toBe(last)
  })
})
