'use client'

import * as React from 'react'
import { createStore, useStore } from 'zustand'
import type { CartDTO } from '@/lib/types'

interface CartState {
  cart: CartDTO
  setCart: (cart: CartDTO) => void
  clear: () => void
}

const EMPTY: CartDTO = { items: [], activityItems: [], subtotal: 0, expiresAt: null }

type CartStore = ReturnType<typeof createCartStore>

function createCartStore(initial: CartDTO) {
  return createStore<CartState>()((set) => ({
    cart: initial,
    setCart: (cart) => set({ cart }),
    clear: () => set({ cart: EMPTY }),
  }))
}

const CartStoreContext = React.createContext<CartStore | null>(null)

export function CartStoreProvider({
  children,
  initialCart,
}: {
  children: React.ReactNode
  initialCart: CartDTO
}) {
  const storeRef = React.useRef<CartStore | null>(null)
  if (!storeRef.current) storeRef.current = createCartStore(initialCart)
  return <CartStoreContext.Provider value={storeRef.current}>{children}</CartStoreContext.Provider>
}

export function useCartStore<T>(selector: (state: CartState) => T): T {
  const store = React.useContext(CartStoreContext)
  if (!store) throw new Error('useCartStore 必須在 <CartStoreProvider> 內使用')
  return useStore(store, selector)
}

/** 常用選擇器 */
export const useCart = () => useCartStore((s) => s.cart)
export const useSetCart = () => useCartStore((s) => s.setCart)
export const useCartCount = () => useCartStore((s) => s.cart.items.length + (s.cart.activityItems?.length ?? 0))
