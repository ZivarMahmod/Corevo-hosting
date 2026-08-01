// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installEditorPickBridge } from './SidaPreviewBridge'

const source = 'corevo-sida'

function setPickMode(
  enabled: boolean,
  fields: string[],
  origin = window.location.origin,
  eventSource: MessageEventSource = window.parent,
  messageSource = source,
) {
  window.dispatchEvent(new MessageEvent('message', {
    origin,
    source: eventSource,
    data: { source: messageSource, type: 'editor-pick-mode', enabled, fields },
  }))
}

function click(target: Element) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  target.dispatchEvent(event)
  return event
}

describe('SidaPreviewBridge editor pick interaction', () => {
  let cleanup: () => void
  let postMessage: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    document.body.innerHTML = `
      <main data-tenant>
        <a id="cta" href="/boka">
          <span id="editable"
            data-corevo-editor-stable-field="booking.variant"
            data-corevo-editor-field="heroTitle">Boka</span>
        </a>
        <button id="stale"
          data-corevo-editor-stable-field="removedField"
          data-corevo-editor-field="heroTitle">Gammal markör</button>
        <button id="scanned" data-corevo-editor-field="heroTitle">Skannad markör</button>
        <a id="unknown" href="/kontakt">Oredigerbar</a>
      </main>
    `
    postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {})
    cleanup = installEditorPickBridge()
  })

  afterEach(() => {
    cleanup()
    postMessage.mockRestore()
    document.body.innerHTML = ''
  })

  it('accepts only the exact same-origin parent command and posts the stable semantic field once', () => {
    setPickMode(true, ['booking.variant'], 'https://evil.example')
    expect(click(document.querySelector('#editable')!).defaultPrevented).toBe(false)

    setPickMode(true, ['booking.variant'], window.location.origin, {} as MessageEventSource)
    expect(click(document.querySelector('#editable')!).defaultPrevented).toBe(false)

    setPickMode(true, ['booking.variant'], window.location.origin, window.parent, 'other')
    expect(click(document.querySelector('#editable')!).defaultPrevented).toBe(false)

    setPickMode(true, ['booking.variant'])
    expect(click(document.querySelector('#editable')!).defaultPrevented).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      { source, type: 'editor-pick-field', field: 'booking.variant' },
      window.location.origin,
    )
    expect(JSON.stringify(postMessage.mock.calls.at(-1)?.[0])).not.toMatch(/selector|html|text|body/)

    postMessage.mockClear()
    expect(click(document.querySelector('#editable')!).defaultPrevented).toBe(false)
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('blocks navigation for uneditable content, keeps the mode active and never sends an unknown field', () => {
    setPickMode(true, ['booking.variant'])

    expect(click(document.querySelector('#unknown')!).defaultPrevented).toBe(true)
    expect(postMessage).not.toHaveBeenCalled()

    expect(click(document.querySelector('#editable')!).defaultPrevented).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      { source, type: 'editor-pick-field', field: 'booking.variant' },
      window.location.origin,
    )
  })

  it('lets a stable marker veto a scanned marker and accepts a scanned key only from the allowlist', () => {
    setPickMode(true, ['heroTitle'])

    expect(click(document.querySelector('#stale')!).defaultPrevented).toBe(true)
    expect(postMessage).not.toHaveBeenCalled()

    expect(click(document.querySelector('#scanned')!).defaultPrevented).toBe(true)
    expect(postMessage).toHaveBeenCalledWith(
      { source, type: 'editor-pick-field', field: 'heroTitle' },
      window.location.origin,
    )
  })

  it('outlines on hover without selecting and cancels on Escape or toggle-off', () => {
    setPickMode(true, ['booking.variant'])
    const editable = document.querySelector<HTMLElement>('#editable')!

    editable.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    expect(editable.style.outline).toContain('#D6AC6A')
    expect(editable.style.outline).toContain('solid')
    expect(editable.style.outline).toContain('2px')
    expect(postMessage).not.toHaveBeenCalled()
    editable.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    expect(editable.style.outline).toBe('')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    postMessage.mockClear()
    expect(click(editable).defaultPrevented).toBe(false)
    expect(postMessage).not.toHaveBeenCalled()

    setPickMode(true, ['booking.variant'])
    setPickMode(false, [])
    expect(click(editable).defaultPrevented).toBe(false)
  })
})
