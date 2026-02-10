import { ipcMain } from 'electron'
import { getDatabase } from '../database'

interface CreateSaleData {
  branch_id: number
  user_id: number
  shift_id: number | null
  customer_name?: string
  items: {
    product_id: number
    product_name: string
    barcode?: string
    quantity: number
    unit_price: number
    cost_price: number
    discount_amount: number
    discount_type: 'fixed' | 'percentage'
    tax_rate: number
    tax_amount: number
    total: number
  }[]
  subtotal: number
  discount_amount: number
  discount_type: 'fixed' | 'percentage'
  tax_amount: number
  total: number
  payments: {
    method: 'cash' | 'card' | 'mobile' | 'other' | 'qr' | 'bank'
    amount: number
    reference?: string
    received_amount?: number
    change_amount?: number
  }[]
  notes?: string
}

function generateInvoiceNumber(db: any, branchId: number): string {
  const branch = db.prepare('SELECT invoice_prefix FROM branches WHERE id = ?').get(branchId) as { invoice_prefix: string }
  const year = new Date().getFullYear()
  const seqKey = `last_invoice_seq_${branchId}_${year}`

  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(seqKey) as { value: string } | undefined
  const nextSeq = setting ? parseInt(setting.value) + 1 : 1

  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(seqKey, nextSeq.toString())

  return `${branch.invoice_prefix}-${year}-${nextSeq.toString().padStart(6, '0')}`
}

export function registerSalesHandlers(): void {
  ipcMain.handle('sales:create', async (_event, data: CreateSaleData) => {
    try {
      const db = getDatabase()

      // Validate payment total
      const paymentTotal = data.payments.reduce((sum, p) => sum + p.amount, 0)
      if (paymentTotal < data.total - 0.01) {
        return { success: false, error: 'Payment total does not match bill total' }
      }

      const createSale = db.transaction((saleData: CreateSaleData) => {
        // Generate invoice number
        const invoiceNumber = generateInvoiceNumber(db, saleData.branch_id)

        // Insert sale
        const saleResult = db
          .prepare(
            `INSERT INTO sales (invoice_number, branch_id, user_id, shift_id, customer_name,
                                subtotal, discount_amount, discount_type, tax_amount, total, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            invoiceNumber,
            saleData.branch_id,
            saleData.user_id,
            saleData.shift_id,
            saleData.customer_name ?? null,
            saleData.subtotal,
            saleData.discount_amount,
            saleData.discount_type,
            saleData.tax_amount,
            saleData.total,
            saleData.notes ?? null
          )
        const saleId = saleResult.lastInsertRowid as number

        // Insert sale items
        const insertItem = db.prepare(
          `INSERT INTO sale_items (sale_id, product_id, product_name, barcode, quantity,
                                   unit_price, cost_price, discount_amount, discount_type,
                                   tax_rate, tax_amount, total)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )

        // Insert stock moves and update branch_stock
        const insertMove = db.prepare(
          `INSERT INTO stock_moves (product_id, branch_id, type, quantity, reference_type, reference_id, user_id)
           VALUES (?, ?, 'SALE', ?, 'sale', ?, ?)`
        )
        const updateStock = db.prepare(
          `UPDATE branch_stock SET quantity = quantity + ?, updated_at = datetime('now')
           WHERE product_id = ? AND branch_id = ?`
        )
        const insertStockIfMissing = db.prepare(
          `INSERT OR IGNORE INTO branch_stock (product_id, branch_id, quantity) VALUES (?, ?, 0)`
        )

        for (const item of saleData.items) {
          insertItem.run(
            saleId, item.product_id, item.product_name, item.barcode ?? null,
            item.quantity, item.unit_price, item.cost_price,
            item.discount_amount, item.discount_type,
            item.tax_rate, item.tax_amount, item.total
          )

          // Stock move (negative for sale)
          insertMove.run(item.product_id, saleData.branch_id, -item.quantity, saleId, saleData.user_id)

          // Update branch_stock cache
          insertStockIfMissing.run(item.product_id, saleData.branch_id)
          updateStock.run(-item.quantity, item.product_id, saleData.branch_id)
        }

        // Insert payments
        const insertPayment = db.prepare(
          `INSERT INTO payments (sale_id, method, amount, reference, received_amount, change_amount)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        for (const payment of saleData.payments) {
          insertPayment.run(
            saleId, payment.method, payment.amount,
            payment.reference ?? null,
            payment.received_amount ?? payment.amount,
            payment.change_amount ?? 0
          )
        }

        // Update shift totals if shift is active
        if (saleData.shift_id) {
          db.prepare(
            `UPDATE shifts SET
               total_sales = total_sales + ?,
               total_transactions = total_transactions + 1
             WHERE id = ?`
          ).run(saleData.total, saleData.shift_id)
        }

        return { saleId, invoiceNumber }
      })

      const result = createSale(data)
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:get', async (_event, id: number) => {
    try {
      const db = getDatabase()
      const sale = db
        .prepare(
          `SELECT s.*, u.display_name as cashier_name, b.name as branch_name
           FROM sales s
           JOIN users u ON s.user_id = u.id
           JOIN branches b ON s.branch_id = b.id
           WHERE s.id = ?`
        )
        .get(id) as any

      if (!sale) return { success: true, data: null }

      sale.items = db
        .prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id')
        .all(id)

      sale.payments = db
        .prepare('SELECT * FROM payments WHERE sale_id = ? ORDER BY id')
        .all(id)

      return { success: true, data: sale }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:get-by-invoice', async (_event, invoiceNumber: string) => {
    try {
      const db = getDatabase()
      const sale = db
        .prepare(
          `SELECT s.*, u.display_name as cashier_name, b.name as branch_name
           FROM sales s
           JOIN users u ON s.user_id = u.id
           JOIN branches b ON s.branch_id = b.id
           WHERE s.invoice_number = ?`
        )
        .get(invoiceNumber) as any

      if (!sale) return { success: true, data: null }

      sale.items = db
        .prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id')
        .all(sale.id)

      sale.payments = db
        .prepare('SELECT * FROM payments WHERE sale_id = ? ORDER BY id')
        .all(sale.id)

      return { success: true, data: sale }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:list', async (_event, filters?: {
    branch_id?: number
    user_id?: number
    status?: string
    date_from?: string
    date_to?: string
    limit?: number
    offset?: number
  }) => {
    try {
      const db = getDatabase()
      let sql = `
        SELECT s.*, u.display_name as cashier_name, b.name as branch_name
        FROM sales s
        JOIN users u ON s.user_id = u.id
        JOIN branches b ON s.branch_id = b.id
      `
      const conditions: string[] = []
      const params: any[] = []

      if (filters?.branch_id) { conditions.push('s.branch_id = ?'); params.push(filters.branch_id) }
      if (filters?.user_id) { conditions.push('s.user_id = ?'); params.push(filters.user_id) }
      if (filters?.status) { conditions.push('s.status = ?'); params.push(filters.status) }
      if (filters?.date_from) { conditions.push('s.created_at >= ?'); params.push(filters.date_from) }
      if (filters?.date_to) { conditions.push('s.created_at <= ?'); params.push(filters.date_to) }

      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')

      sql += ' ORDER BY s.created_at DESC'

      if (filters?.limit) {
        sql += ' LIMIT ?'
        params.push(filters.limit)
        if (filters.offset) {
          sql += ' OFFSET ?'
          params.push(filters.offset)
        }
      }

      const sales = db.prepare(sql).all(...params)
      return { success: true, data: sales }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:get-last', async (_event, branchId: number) => {
    try {
      const db = getDatabase()
      const sale = db
        .prepare(
          `SELECT s.*, u.display_name as cashier_name, b.name as branch_name
           FROM sales s
           JOIN users u ON s.user_id = u.id
           JOIN branches b ON s.branch_id = b.id
           WHERE s.branch_id = ? AND s.status = 'completed'
           ORDER BY s.created_at DESC LIMIT 1`
        )
        .get(branchId) as any

      if (!sale) return { success: true, data: null }

      sale.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id)
      sale.payments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(sale.id)

      return { success: true, data: sale }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:void', async (_event, saleId: number, userId: number, reason: string) => {
    try {
      const db = getDatabase()

      const voidSale = db.transaction(() => {
        const sale = db.prepare("SELECT * FROM sales WHERE id = ? AND status = 'completed'").get(saleId) as any
        if (!sale) throw new Error('Sale not found or already voided/returned')

        // Void the sale
        db.prepare("UPDATE sales SET status = 'voided', notes = ?, updated_at = datetime('now') WHERE id = ?")
          .run(reason, saleId)

        // Reverse stock moves
        const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId) as any[]
        const insertMove = db.prepare(
          `INSERT INTO stock_moves (product_id, branch_id, type, quantity, reference_type, reference_id, notes, user_id)
           VALUES (?, ?, 'RETURN', ?, 'void', ?, ?, ?)`
        )
        const updateStock = db.prepare(
          "UPDATE branch_stock SET quantity = quantity + ?, updated_at = datetime('now') WHERE product_id = ? AND branch_id = ?"
        )

        for (const item of items) {
          insertMove.run(item.product_id, sale.branch_id, item.quantity, saleId, 'Void: ' + reason, userId)
          updateStock.run(item.quantity, item.product_id, sale.branch_id)
        }

        // Update shift if applicable
        if (sale.shift_id) {
          db.prepare(
            'UPDATE shifts SET total_sales = total_sales - ?, total_transactions = total_transactions - 1 WHERE id = ?'
          ).run(sale.total, sale.shift_id)
        }

        // Audit log
        db.prepare(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json)
           VALUES (?, 'void_sale', 'sale', ?, ?)`
        ).run(userId, saleId, JSON.stringify({ reason, total: sale.total, invoice: sale.invoice_number }))
      })

      voidSale()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:return', async (_event, data: {
    original_sale_id: number
    branch_id: number
    user_id: number
    shift_id: number | null
    items: {
      product_id: number
      product_name: string
      barcode?: string
      quantity: number
      unit_price: number
      cost_price: number
      tax_rate: number
      tax_amount: number
      total: number
    }[]
    subtotal: number
    tax_amount: number
    total: number
    reason: string
    refund_method: 'cash' | 'card' | 'qr' | 'bank'
  }) => {
    try {
      const db = getDatabase()

      const processReturn = db.transaction(() => {
        const originalSale = db.prepare('SELECT * FROM sales WHERE id = ?').get(data.original_sale_id) as any
        if (!originalSale) throw new Error('Original sale not found')

        // Generate return invoice
        const invoiceNumber = generateInvoiceNumber(db, data.branch_id)

        // Create return sale record
        const returnResult = db
          .prepare(
            `INSERT INTO sales (invoice_number, branch_id, user_id, shift_id,
                                subtotal, discount_amount, tax_amount, total,
                                status, notes, original_sale_id)
             VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'returned', ?, ?)`
          )
          .run(
            invoiceNumber, data.branch_id, data.user_id, data.shift_id,
            -data.subtotal, -data.tax_amount, -data.total,
            data.reason, data.original_sale_id
          )
        const returnSaleId = returnResult.lastInsertRowid as number

        // Insert return items and stock moves
        const insertItem = db.prepare(
          `INSERT INTO sale_items (sale_id, product_id, product_name, barcode, quantity,
                                   unit_price, cost_price, tax_rate, tax_amount, total, discount_amount, discount_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'fixed')`
        )
        const insertMove = db.prepare(
          `INSERT INTO stock_moves (product_id, branch_id, type, quantity, reference_type, reference_id, notes, user_id)
           VALUES (?, ?, 'RETURN', ?, 'return', ?, ?, ?)`
        )
        const updateStock = db.prepare(
          "UPDATE branch_stock SET quantity = quantity + ?, updated_at = datetime('now') WHERE product_id = ? AND branch_id = ?"
        )

        for (const item of data.items) {
          insertItem.run(
            returnSaleId, item.product_id, item.product_name, item.barcode ?? null,
            -item.quantity, item.unit_price, item.cost_price,
            item.tax_rate, -item.tax_amount, -item.total
          )
          insertMove.run(item.product_id, data.branch_id, item.quantity, returnSaleId, 'Return: ' + data.reason, data.user_id)
          updateStock.run(item.quantity, item.product_id, data.branch_id)
        }

        // Insert refund payment
        db.prepare(
          'INSERT INTO payments (sale_id, method, amount) VALUES (?, ?, ?)'
        ).run(returnSaleId, data.refund_method, -data.total)

        // Check if full or partial return
        const returnedItems = db
          .prepare(
            `SELECT si.product_id, SUM(ABS(si.quantity)) as returned_qty
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             WHERE s.original_sale_id = ? AND s.status = 'returned'
             GROUP BY si.product_id`
          )
          .all(data.original_sale_id) as { product_id: number; returned_qty: number }[]

        const originalItems = db
          .prepare('SELECT product_id, quantity FROM sale_items WHERE sale_id = ?')
          .all(data.original_sale_id) as { product_id: number; quantity: number }[]

        const allReturned = originalItems.every((oi) => {
          const returned = returnedItems.find((ri) => ri.product_id === oi.product_id)
          return returned && returned.returned_qty >= oi.quantity
        })

        db.prepare("UPDATE sales SET status = ?, updated_at = datetime('now') WHERE id = ?")
          .run(allReturned ? 'returned' : 'partial_return', data.original_sale_id)

        // Update shift
        if (data.shift_id) {
          db.prepare('UPDATE shifts SET total_refunds = total_refunds + ? WHERE id = ?')
            .run(data.total, data.shift_id)
        }

        // Audit log
        db.prepare(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json)
           VALUES (?, 'return_sale', 'sale', ?, ?)`
        ).run(data.user_id, data.original_sale_id, JSON.stringify({
          reason: data.reason,
          total: data.total,
          items: data.items.length,
          return_invoice: invoiceNumber
        }))

        return { returnSaleId, invoiceNumber }
      })

      const result = processReturn()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // Held sales
  ipcMain.handle('sales:hold', async (_event, data: {
    branch_id: number
    user_id: number
    cart_json: string
    note?: string
    is_autosave?: boolean
  }) => {
    try {
      const db = getDatabase()

      // If autosave, update existing or create
      if (data.is_autosave) {
        const existing = db
          .prepare('SELECT id FROM held_sales WHERE user_id = ? AND branch_id = ? AND is_autosave = 1')
          .get(data.user_id, data.branch_id) as { id: number } | undefined

        if (existing) {
          db.prepare(
            "UPDATE held_sales SET cart_json = ?, updated_at = datetime('now') WHERE id = ?"
          ).run(data.cart_json, existing.id)
          return { success: true, data: { id: existing.id } }
        }
      }

      const result = db
        .prepare(
          'INSERT INTO held_sales (branch_id, user_id, cart_json, note, is_autosave) VALUES (?, ?, ?, ?, ?)'
        )
        .run(data.branch_id, data.user_id, data.cart_json, data.note ?? null, data.is_autosave ? 1 : 0)

      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:get-held', async (_event, branchId: number) => {
    try {
      const db = getDatabase()
      const held = db
        .prepare(
          `SELECT hs.*, u.display_name as user_name
           FROM held_sales hs
           JOIN users u ON hs.user_id = u.id
           WHERE hs.branch_id = ? AND hs.is_autosave = 0
           ORDER BY hs.created_at DESC`
        )
        .all(branchId)
      return { success: true, data: held }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:get-autosave', async (_event, userId: number, branchId: number) => {
    try {
      const db = getDatabase()
      const held = db
        .prepare('SELECT * FROM held_sales WHERE user_id = ? AND branch_id = ? AND is_autosave = 1')
        .get(userId, branchId)
      return { success: true, data: held ?? null }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('sales:delete-held', async (_event, id: number) => {
    try {
      const db = getDatabase()
      db.prepare('DELETE FROM held_sales WHERE id = ?').run(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
