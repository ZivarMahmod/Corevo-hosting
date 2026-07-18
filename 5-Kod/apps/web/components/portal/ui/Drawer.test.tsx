// @vitest-environment happy-dom

import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Drawer } from './Drawer'

vi.mock('./Icon', () => ({ Icon: () => <span aria-hidden="true" /> }))

let root: Root
let container: HTMLDivElement

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Öppna</button>
      {open ? (
        <Drawer title="Partner" onClose={() => setOpen(false)}>
          <input aria-label="Partnernamn" />
        </Drawer>
      ) : null}
    </>
  )
}

function button(label: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find((node) => node.textContent?.includes(label) || node.getAttribute('aria-label') === label)
  if (!(match instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  return match
}

beforeEach(() => {
  vi.useFakeTimers()
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('Drawer accessibility', () => {
  it('traps keyboard focus inside the modal', async () => {
    await act(async () => root.render(<Harness />))
    await act(async () => button('Öppna').click())
    const close = button('Stäng')
    const input = container.querySelector('input')
    if (!(input instanceof HTMLInputElement)) throw new Error('Input not found')

    input.focus()
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })))
    expect(document.activeElement).toBe(close)

    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })))
    expect(document.activeElement).toBe(input)
  })

  it('returns focus to the opener after the close animation', async () => {
    await act(async () => root.render(<Harness />))
    const opener = button('Öppna')
    opener.focus()
    await act(async () => opener.click())

    await act(async () => button('Stäng').click())
    await act(async () => vi.advanceTimersByTime(330))

    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(opener)
  })
})
