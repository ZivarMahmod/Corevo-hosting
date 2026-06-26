'use client'

// Klient-varukorg för webshop-köp-rälsen (goal-49). Browse-fasen lever klient-sida
// (localStorage); ordern föds server-side vid kassa-start (reserve_shop_order, 0042).
// EN cart per origin (tenant-subdomän) → en localStorage-nyckel räcker. Token =
// opak session-nyckel (genereras en gång), gatar den egna ordern för anon.

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import {
  cartItemCount,
  cartSubtotalCents,
  mergeCartLine,
  setCartQty,
  type CartLine,
} from '@/lib/storefront/shop/types'

const CART_KEY = 'corevo-shop-cart'
const TOKEN_KEY = 'corevo-shop-token'

type CartCtx = {
  lines: CartLine[]
  count: number
  subtotalCents: number
  token: string
  addLine: (line: Omit<CartLine, 'quantity'>, qty?: number) => void
  setQty: (variantId: string, qty: number) => void
  removeLine: (variantId: string) => void
  clear: () => void
}

const Ctx = createContext<CartCtx | null>(null)

function readLines(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CartLine[]) : []
  } catch {
    return []
  }
}

function readToken(): string {
  try {
    let t = localStorage.getItem(TOKEN_KEY)
    if (!t) {
      t = crypto.randomUUID()
      localStorage.setItem(TOKEN_KEY, t)
    }
    return t
  } catch {
    return crypto.randomUUID()
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [token, setToken] = useState('')

  // hydrate from localStorage after mount (avoid SSR mismatch).
  useEffect(() => {
    setLines(readLines())
    setToken(readToken())
  }, [])

  // persist on change (skip the pre-hydration empty render).
  useEffect(() => {
    if (!token) return
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(lines))
    } catch {
      /* storage full / disabled — cart is best-effort */
    }
  }, [lines, token])

  const addLine = useCallback((line: Omit<CartLine, 'quantity'>, qty = 1) => {
    setLines((prev) => mergeCartLine(prev, line, qty))
  }, [])

  const setQty = useCallback((variantId: string, qty: number) => {
    setLines((prev) => setCartQty(prev, variantId, qty))
  }, [])

  const removeLine = useCallback((variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId))
  }, [])

  const clear = useCallback(() => setLines([]), [])

  const value: CartCtx = {
    lines,
    count: cartItemCount(lines),
    subtotalCents: cartSubtotalCents(lines),
    token,
    addLine,
    setQty,
    removeLine,
    clear,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
