// S0 spike — THE render-bridge (the core assumption the whole site-builder rests on).
//
// Turns stored template HTML into a React tree and swaps every
//   <corevo-module type="X" pos="…">
// marker for a preloaded module node. This is what lets a static, faithful vendor
// layout host the LIVE Corevo modules (booking/shop/…) at exact positions.
//
// CRITICAL: html-react-parser's replace() is SYNCHRONOUS — it cannot await data.
// So callers pass ALREADY-CONSTRUCTED nodes in `modules` (e.g. <BookingMount/>, an
// async server component that loads its own data when React renders it). replace()
// only PLACES the node; the data fetch happens later, during the subtree's render.
//
// An unknown module type degrades to an inert, greppable placeholder rather than a
// broken element — so a typo'd marker can never crash the page (validate_markers.mjs
// in S3 will catch them at author time).
import parse, { Element, type HTMLReactParserOptions, type DOMNode } from 'html-react-parser'
import type { ReactNode } from 'react'

export function renderTemplate(
  html: string,
  modules: Record<string, ReactNode>,
): ReactNode {
  const options: HTMLReactParserOptions = {
    replace: (node: DOMNode) => {
      if (node instanceof Element && node.name === 'corevo-module') {
        const type = node.attribs?.type ?? ''
        const slot = modules[type]
        return slot !== undefined ? <>{slot}</> : <span data-corevo-module-missing={type} />
      }
      return undefined
    },
  }
  return parse(html, options)
}
