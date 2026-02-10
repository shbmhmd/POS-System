// ========== Common ==========
export interface IpcResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

// ========== Business ==========
export interface Business {
  id: number
  name: string
  currency: string
  tax_mode: 'inclusive' | 'exclusive'
  logo_path: string | null
  created_at: string
  updated_at: string
}

// ========== Branch ==========
export interface Branch {
  id: number
  business_id: number
  name: string
  code: string
  invoice_prefix: string
  address: string | null
  phone: string | null
  is_active: number
  created_at: string
  updated_at: string
}

// ========== Role & Permission ==========
export interface Role {
  id: number
  name: string
  description: string | null
  is_system: number
  created_at: string
}

export interface Permission {
  permission_key: string
  value: string
}

export type PermissionKey =
  | 'max_discount_pct'
  | 'price_override'
  | 'refund_allowed'
  | 'void_sale'
  | 'stock_adjustment'
  | 'reports_access'
  | 'manage_users'
  | 'manage_products'
  | 'manage_settings'
  | 'google_connect'
  | 'manage_suppliers'
  | 'manage_purchases'

// ========== User ==========
export interface User {
  id: number
  username: string
  display_name: string
  role_id: number
  role_name: string
  branch_id: number
  branch_name: string
  is_active: number
  last_login_at: string | null
  created_at: string
  permissions: Record<string, string>
}

// ========== Category ==========
export interface Category {
  id: number
  name: string
  description: string | null
  parent_id: number | null
  sort_order: number
  is_active: number
  product_count?: number
  created_at: string
  updated_at: string
}

// ========== Product ==========
export interface Product {
  id: number
  barcode: string | null
  sku: string | null
  name: string
  category_id: number | null
  category_name?: string | null
  cost_price: number
  selling_price: number
  tax_rate: number
  unit: string
  low_stock_threshold: number
  is_active: number
  stock_on_hand?: number
  stock_quantity?: number
  tax_percent?: number
  min_stock?: number
  created_at: string
  updated_at: string
}

// ========== Cart ==========
export interface CartItem {
  id: string // unique cart line id (UUID)
  product_id: number
  product_name: string
  barcode: string | null
  quantity: number
  unit_price: number
  cost_price: number
  discount_amount: number
  discount_type: 'fixed' | 'percentage'
  tax_rate: number
  tax_amount: number
  total: number
}

// ========== Sale ==========
export interface Sale {
  id: number
  invoice_number: string
  branch_id: number
  branch_name?: string
  user_id: number
  cashier_name?: string
  shift_id: number | null
  customer_name: string | null
  subtotal: number
  discount_amount: number
  discount_type: string
  tax_amount: number
  total: number
  status: 'completed' | 'voided' | 'returned' | 'partial_return'
  notes: string | null
  original_sale_id: number | null
  created_at: string
  updated_at: string
  items?: SaleItem[]
  payments?: Payment[]
}

export interface SaleItem {
  id: number
  sale_id: number
  product_id: number
  product_name: string
  barcode: string | null
  quantity: number
  unit_price: number
  cost_price: number
  discount_amount: number
  discount_type: string
  tax_rate: number
  tax_amount: number
  total: number
  created_at: string
}

export interface Payment {
  id: number
  sale_id: number
  method: 'cash' | 'card' | 'qr' | 'bank'
  amount: number
  reference: string | null
  received_amount: number | null
  change_amount: number
  created_at: string
}

export type PaymentMethod = 'cash' | 'card' | 'qr' | 'bank' | 'mobile' | 'other'

// ========== Inventory ==========
export interface StockItem {
  id: number
  product_id: number
  barcode: string | null
  name: string
  product_name: string
  sku: string | null
  cost_price: number
  selling_price: number
  low_stock_threshold: number
  min_stock: number
  unit: string
  category_name: string | null
  quantity: number
}

export interface StockMove {
  id: number
  product_id: number
  branch_id: number
  type: 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'TRANSFER_OUT' | 'TRANSFER_IN'
  quantity: number
  reference_type: string | null
  reference_id: number | null
  notes: string | null
  user_id: number | null
  user_name?: string
  created_at: string
}

// ========== Supplier ==========
export interface Supplier {
  id: number
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: number
  created_at: string
  updated_at: string
}

// ========== Purchase ==========
export interface PurchaseInvoice {
  id: number
  supplier_id: number
  supplier_name?: string
  branch_id: number
  branch_name?: string
  invoice_number: string | null
  subtotal: number
  tax_amount: number
  total: number
  status: 'draft' | 'received' | 'cancelled'
  notes: string | null
  user_id: number | null
  user_name?: string
  received_at: string | null
  created_at: string
  updated_at: string
  items?: PurchaseItem[]
}

export interface PurchaseItem {
  id: number
  purchase_invoice_id: number
  product_id: number
  product_name?: string
  barcode?: string
  quantity: number
  unit_cost: number
  total: number
  created_at: string
}

// ========== Shift ==========
export interface Shift {
  id: number
  branch_id: number
  branch_name?: string
  user_id: number
  user_name?: string
  opening_cash: number
  closing_cash: number | null
  expected_cash: number | null
  difference: number | null
  total_sales: number
  total_refunds: number
  total_transactions: number
  status: 'open' | 'closed'
  opened_at: string
  closed_at: string | null
  notes: string | null
}

// ========== Reports ==========
export interface DailySalesReport {
  date: string
  total_transactions: number
  total_sales: number
  total_refunds: number
  total_discounts: number
  total_tax: number
}

export interface ProductSalesReport {
  product_id: number
  product_name: string
  category_name: string
  qty_sold: number
  revenue: number
  cost: number
  profit: number
}

export interface PaymentBreakdownReport {
  method: string
  count: number
  total: number
}

export interface DashboardData {
  today_sales: { count: number; total: number }
  low_stock_count: number
  total_products: number
  recent_sales: {
    id: number
    invoice_number: string
    total: number
    status: string
    created_at: string
    cashier_name: string
  }[]
}

// ========== Held Sale ==========
export interface HeldSale {
  id: number
  branch_id: number
  user_id: number
  user_name?: string
  cart_json: string
  note: string | null
  is_autosave: number
  created_at: string
  updated_at: string
}
