// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'

vi.mock('./Icon', () => ({ Icon: () => <span aria-hidden="true" /> }))

let root: Root
let shell: HTMLDivElement
let container: HTMLDivElement

beforeEach(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
  shell = document.createElement('div')
  shell.dataset.world = 'backoffice'
  shell.dataset.portal = 'admin'
  container = document.createElement('div')
  shell.append(container)
  document.body.append(shell)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  shell.remove()
})

describe('Modal portal host', () => {
  it('stannar i backoffice-skalet så dialogen ärver dess färg- och temavariabler', async () => {
    await act(async () => {
      root.render(
        <Modal title="Bokning" onClose={() => undefined}>
          Bokningsdetaljer
        </Modal>,
      )
    })

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.parentElement?.parentElement).toBe(shell)
  })

  it('behåller body som säker fallback utanför backoffice', async () => {
    delete shell.dataset.world
    delete shell.dataset.portal

    await act(async () => {
      root.render(
        <Modal title="Fristående dialog" onClose={() => undefined}>
          Innehåll
        </Modal>,
      )
    })

    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.parentElement?.parentElement).toBe(document.body)
  })

  it('fokuserar formulärfältet före stängknappen så mobiltangentbordet öppnas', async () => {
    await act(async () => {
      root.render(
        <Modal title="Sök i kalendern" onClose={() => undefined} anchor="top">
          <input type="search" autoFocus aria-label="Sök kund" />
        </Modal>,
      )
    })

    expect(document.activeElement).toBe(document.querySelector('[aria-label="Sök kund"]'))
  })

  it('återför fokus till den ursprungliga anslutna öppnaren vid unmount', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'Öppna bokning'
    shell.insertBefore(opener, container)
    opener.focus()

    await act(async () => {
      root.render(
        <Modal title="Bokning" onClose={() => undefined}>
          Bokningsdetaljer
        </Modal>,
      )
    })
    expect(document.activeElement).not.toBe(opener)

    await act(async () => {
      root.render(null)
    })

    expect(opener.isConnected).toBe(true)
    expect(document.activeElement).toBe(opener)
  })

  it('följer visualViewport när mobiltangentbordet ändrar den synliga höjden', async () => {
    const originalViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport')
    const viewport = new EventTarget() as EventTarget & {
      height: number
      offsetTop: number
    }
    viewport.height = 420
    viewport.offsetTop = 12
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    })

    try {
      await act(async () => {
        root.render(
          <Modal title="Sök i kalendern" onClose={() => undefined} anchor="top">
            <input aria-label="Sök kund" />
          </Modal>,
        )
      })

      const overlay = document.querySelector<HTMLElement>('[role="presentation"]')
      expect(overlay?.style.getPropertyValue('--modal-visual-height')).toBe('420px')
      expect(overlay?.style.getPropertyValue('--modal-visual-offset-top')).toBe('12px')

      viewport.height = 360
      viewport.offsetTop = 20
      await act(async () => viewport.dispatchEvent(new Event('resize')))

      expect(overlay?.style.getPropertyValue('--modal-visual-height')).toBe('360px')
      expect(overlay?.style.getPropertyValue('--modal-visual-offset-top')).toBe('20px')
    } finally {
      if (originalViewport) {
        Object.defineProperty(window, 'visualViewport', originalViewport)
      } else {
        Reflect.deleteProperty(window, 'visualViewport')
      }
    }
  })
})
