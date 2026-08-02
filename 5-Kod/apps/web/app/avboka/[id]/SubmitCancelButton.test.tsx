import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SubmitCancelButton } from './SubmitCancelButton'

describe('SubmitCancelButton', () => {
  it('renders the cancellation action', () => {
    expect(renderToStaticMarkup(<SubmitCancelButton />)).toContain('Avboka tid')
  })
})
