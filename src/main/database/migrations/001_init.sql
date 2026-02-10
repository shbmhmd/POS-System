-- Desktop POS - Initial Schema
-- Migration: 001_init.sql

-- ============================================
-- BUSINESS & BRANCHES
-- ============================================

CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  tax_mode TEXT NOT NULL DEFAULT 'exclusive' CHECK (tax_mode IN ('inclusive', 'exclusive')),
  logo_path TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  invoice_prefix TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (business_id) REFERENCES businesses(id)
);

-- ============================================
-- USERS, ROLES & PERMISSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER NOT NULL,
  permission_key TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '1',
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER NOT NULL,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role_id INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ============================================
-- PRODUCTS & CATEGORIES
-- ============================================

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  parent_id INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barcode TEXT UNIQUE,
  sku TEXT,
  name TEXT NOT NULL,
  category_id INTEGER,
  cost_price REAL NOT NULL DEFAULT 0,
  selling_price REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id),
  CHECK (cost_price >= 0),
  CHECK (selling_price >= 0),
  CHECK (tax_rate >= 0)
);

-- ============================================
-- SUPPLIERS
-- ============================================

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- SALES
-- ============================================

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  branch_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  shift_id INTEGER,
  customer_name TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  discount_type TEXT DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'voided', 'returned', 'partial_return')),
  notes TEXT,
  original_sale_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (shift_id) REFERENCES shifts(id),
  FOREIGN KEY (original_sale_id) REFERENCES sales(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  barcode TEXT,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  cost_price REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  discount_type TEXT DEFAULT 'fixed' CHECK (discount_type IN ('fixed', 'percentage')),
  tax_rate REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash', 'card', 'qr', 'bank')),
  amount REAL NOT NULL,
  reference TEXT,
  received_amount REAL,
  change_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

-- ============================================
-- INVENTORY / STOCK
-- ============================================

CREATE TABLE IF NOT EXISTS stock_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN')),
  quantity REAL NOT NULL,
  reference_type TEXT,
  reference_id INTEGER,
  notes TEXT,
  user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS branch_stock (
  product_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (product_id, branch_id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id)
);

-- ============================================
-- PURCHASES
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  branch_id INTEGER NOT NULL,
  invoice_number TEXT,
  subtotal REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'received', 'cancelled')),
  notes TEXT,
  user_id INTEGER,
  received_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_invoice_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity REAL NOT NULL,
  unit_cost REAL NOT NULL,
  total REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ============================================
-- SHIFTS
-- ============================================

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  opening_cash REAL NOT NULL DEFAULT 0,
  closing_cash REAL,
  expected_cash REAL,
  difference REAL,
  total_sales REAL NOT NULL DEFAULT 0,
  total_refunds REAL NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT,
  notes TEXT,
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- HELD SALES (cart persistence)
-- ============================================

CREATE TABLE IF NOT EXISTS held_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  branch_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  cart_json TEXT NOT NULL,
  note TEXT,
  is_autosave INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (branch_id) REFERENCES branches(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- SETTINGS & AUDIT
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  details_json TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS google_tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token_enc TEXT,
  refresh_token_enc TEXT,
  token_expiry TEXT,
  connected_email TEXT,
  drive_folder_id TEXT,
  sheet_id TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================
-- INDEXES (Performance)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

CREATE INDEX IF NOT EXISTS idx_sales_created_branch ON sales(created_at, branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
CREATE INDEX IF NOT EXISTS idx_sales_shift ON sales(shift_id);
CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);

CREATE INDEX IF NOT EXISTS idx_payments_sale ON payments(sale_id);

CREATE INDEX IF NOT EXISTS idx_stock_moves_product_branch ON stock_moves(product_id, branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_moves_type ON stock_moves(type);
CREATE INDEX IF NOT EXISTS idx_stock_moves_ref ON stock_moves(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_branch_stock_branch ON branch_stock(branch_id);

CREATE INDEX IF NOT EXISTS idx_shifts_branch_user ON shifts(branch_id, user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_branch ON purchase_invoices(branch_id);

-- ============================================
-- SEED DATA - Roles & Permissions
-- ============================================

INSERT OR IGNORE INTO roles (id, name, description, is_system) VALUES
  (1, 'Owner/Admin', 'Full access to all features', 1),
  (2, 'Manager', 'Branch management access', 1),
  (3, 'Cashier', 'POS and basic operations', 1);

-- Owner/Admin permissions
INSERT OR IGNORE INTO permissions (role_id, permission_key, value) VALUES
  (1, 'max_discount_pct', '100'),
  (1, 'price_override', '1'),
  (1, 'refund_allowed', '1'),
  (1, 'void_sale', '1'),
  (1, 'stock_adjustment', '1'),
  (1, 'reports_access', '1'),
  (1, 'manage_users', '1'),
  (1, 'manage_products', '1'),
  (1, 'manage_settings', '1'),
  (1, 'google_connect', '1'),
  (1, 'manage_suppliers', '1'),
  (1, 'manage_purchases', '1');

-- Manager permissions
INSERT OR IGNORE INTO permissions (role_id, permission_key, value) VALUES
  (2, 'max_discount_pct', '25'),
  (2, 'price_override', '1'),
  (2, 'refund_allowed', '1'),
  (2, 'void_sale', '1'),
  (2, 'stock_adjustment', '1'),
  (2, 'reports_access', '1'),
  (2, 'manage_users', '0'),
  (2, 'manage_products', '1'),
  (2, 'manage_settings', '0'),
  (2, 'google_connect', '0'),
  (2, 'manage_suppliers', '1'),
  (2, 'manage_purchases', '1');

-- Cashier permissions
INSERT OR IGNORE INTO permissions (role_id, permission_key, value) VALUES
  (3, 'max_discount_pct', '5'),
  (3, 'price_override', '0'),
  (3, 'refund_allowed', '0'),
  (3, 'void_sale', '0'),
  (3, 'stock_adjustment', '0'),
  (3, 'reports_access', '0'),
  (3, 'manage_users', '0'),
  (3, 'manage_products', '0'),
  (3, 'manage_settings', '0'),
  (3, 'google_connect', '0'),
  (3, 'manage_suppliers', '0'),
  (3, 'manage_purchases', '0');
