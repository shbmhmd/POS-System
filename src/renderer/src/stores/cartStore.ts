import { create } from 'zustand'
import type { CartItem, Product, PaymentMethod } from '@/types'
import { generateId, calculateTax } from '@/lib/utils'

interface PaymentEntry {
  method: PaymentMethod
  amount: number
  reference?: string
  received_amount?: number
  change_amount?: number
}

interface CartState {
  items: CartItem[]
  billDiscount: number
  billDiscountType: 'fixed' | 'percentage'
  customerName: string
  note: string

  // Computed values (call the getters)
  getSubtotal: () => number
  getDiscountAmount: () => number
  getTaxAmount: () => number
  getTotal: () => number
  getItemCount: () => number

  // Actions
  addProduct: (product: Product, taxMode: 'inclusive' | 'exclusive') => void
  updateQuantity: (cartItemId: string, delta: number) => void
  setQuantity: (cartItemId: string, quantity: number) => void
  setItemDiscount: (cartItemId: string, amount: number, type: 'fixed' | 'percentage') => void
  removeItem: (cartItemId: string) => void
  setBillDiscount: (amount: number, type: 'fixed' | 'percentage') => void
  setCustomerName: (name: string) => void
  setNote: (note: string) => void
  clearCart: () => void
  loadCart: (items: CartItem[], billDiscount: number, billDiscountType: 'fixed' | 'percentage') => void
}

function recalcItem(item: CartItem, taxMode: 'inclusive' | 'exclusive'): CartItem {
  let lineTotal = item.quantity * item.unit_price

  // Apply item discount
  if (item.discount_type === 'percentage') {
    lineTotal -= lineTotal * (item.discount_amount / 100)
  } else {
    lineTotal -= item.discount_amount * item.quantity
  }

  const tax = calculateTax(lineTotal, item.tax_rate, taxMode)

  return {
    ...item,
    tax_amount: tax.taxAmount,
    total: taxMode === 'exclusive' ? tax.totalAmount : lineTotal
  }
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  billDiscount: 0,
  billDiscountType: 'fixed' as const,
  customerName: '',
  note: '',

  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  },

  getDiscountAmount: () => {
    const { items, billDiscount, billDiscountType } = get()
    const itemDiscounts = items.reduce((sum, item) => {
      if (item.discount_type === 'percentage') {
        return sum + item.quantity * item.unit_price * (item.discount_amount / 100)
      }
      return sum + item.discount_amount * item.quantity
    }, 0)

    let billDiscountCalc = 0
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
    if (billDiscountType === 'percentage') {
      billDiscountCalc = (subtotal - itemDiscounts) * (billDiscount / 100)
    } else {
      billDiscountCalc = billDiscount
    }

    return itemDiscounts + billDiscountCalc
  },

  getTaxAmount: () => {
    return get().items.reduce((sum, item) => sum + item.tax_amount, 0)
  },

  getTotal: () => {
    const items = get().items
    const itemsTotal = items.reduce((sum, item) => sum + item.total, 0)
    const { billDiscount, billDiscountType } = get()

    if (billDiscountType === 'percentage') {
      return itemsTotal * (1 - billDiscount / 100)
    }
    return Math.max(0, itemsTotal - billDiscount)
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0)
  },

  addProduct: (product: Product, taxMode: 'inclusive' | 'exclusive') => {
    set((state) => {
      // Check if product already in cart
      const existing = state.items.find((item) => item.product_id === product.id)

      if (existing) {
        return {
          items: state.items.map((item) =>
            item.product_id === product.id
              ? recalcItem({ ...item, quantity: item.quantity + 1 }, taxMode)
              : item
          )
        }
      }

      const newItem: CartItem = {
        id: generateId(),
        product_id: product.id,
        product_name: product.name,
        barcode: product.barcode,
        quantity: 1,
        unit_price: product.selling_price,
        cost_price: product.cost_price,
        discount_amount: 0,
        discount_type: 'fixed',
        tax_rate: product.tax_rate,
        tax_amount: 0,
        total: 0
      }

      return {
        items: [...state.items, recalcItem(newItem, taxMode)]
      }
    })
  },

  updateQuantity: (cartItemId: string, delta: number) => {
    set((state) => {
      const items = state.items
        .map((item) => {
          if (item.id !== cartItemId) return item
          const newQty = item.quantity + delta
          if (newQty <= 0) return null
          return recalcItem({ ...item, quantity: newQty }, 'exclusive') // TODO: get tax mode from app store
        })
        .filter(Boolean) as CartItem[]

      return { items }
    })
  },

  setQuantity: (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      get().removeItem(cartItemId)
      return
    }
    set((state) => ({
      items: state.items.map((item) =>
        item.id === cartItemId
          ? recalcItem({ ...item, quantity }, 'exclusive')
          : item
      )
    }))
  },

  setItemDiscount: (cartItemId: string, amount: number, type: 'fixed' | 'percentage') => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === cartItemId
          ? recalcItem({ ...item, discount_amount: amount, discount_type: type }, 'exclusive')
          : item
      )
    }))
  },

  removeItem: (cartItemId: string) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== cartItemId)
    }))
  },

  setBillDiscount: (amount: number, type: 'fixed' | 'percentage') => {
    set({ billDiscount: amount, billDiscountType: type })
  },

  setCustomerName: (name: string) => set({ customerName: name }),

  setNote: (note: string) => set({ note }),

  clearCart: () => {
    set({
      items: [],
      billDiscount: 0,
      billDiscountType: 'fixed',
      customerName: '',
      note: ''
    })
  },

  loadCart: (items: CartItem[], billDiscount: number, billDiscountType: 'fixed' | 'percentage') => {
    set({ items, billDiscount, billDiscountType })
  }
}))
