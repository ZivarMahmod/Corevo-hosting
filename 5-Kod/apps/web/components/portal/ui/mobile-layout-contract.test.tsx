// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Card } from './Card'
import { Table } from './Table'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  ;(
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('back-office mobile layout primitives', () => {
  it('lets shared cards shrink inside narrow grid and flex parents', async () => {
    await act(async () => root.render(<Card>Innehåll</Card>))

    const card = container.firstElementChild as HTMLElement
    expect(card.style.boxSizing).toBe('border-box')
    expect(card.style.minWidth).toBe('0')
    expect(card.style.maxWidth).toBe('100%')
  })

  it('keeps table overflow local to the table wrapper', async () => {
    await act(async () =>
      root.render(
        <Table
          cols={['Kund', 'Subdomän']}
          rows={[[<span key="n">Väldigt långt kundnamn</span>, 'freshcut.corevo.se']]}
        />,
      ),
    )

    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.width).toBe('100%')
    expect(wrapper.style.maxWidth).toBe('100%')
    expect(wrapper.style.minWidth).toBe('0')
    expect(wrapper.style.overflowX).toBe('auto')
  })
})
