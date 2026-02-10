import { ipcMain } from 'electron'
import { getDatabase } from '../database'

export function registerPurchaseHandlers(): void {
  ipcMain.handle('purchases:create', async (_event, data: {
    supplier_id: number
    branch_id: number
    user_id: number
    invoice_number?: string
    items: {
      product_id: number
      quantity: number
      unit_cost: number
    }[]
    notes?: string
  }) => {
    try {
      const db = getDatabase()

      const createPurchase = db.transaction(() => {
        const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0)

        const result = db
          .prepare(
            `INSERT INTO purchase_invoices (supplier_id, branch_id, invoice_number, subtotal, total, notes, user_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(data.supplier_id, data.branch_id, data.invoice_number ?? null, subtotal, subtotal, data.notes ?? null, data.user_id)

        const purchaseId = result.lastInsertRowid as number

        const insertItem = db.prepare(
          'INSERT INTO purchase_items (purchase_invoice_id, product_id, quantity, unit_cost, total) VALUES (?, ?, ?, ?, ?)'
        )

        for (const item of data.items) {
          insertItem.run(purchaseId, item.product_id, item.quantity, item.unit_cost, item.quantity * item.unit_cost)
        }

        return purchaseId
      })

      const purchaseId = createPurchase()
      return { success: true, data: { id: purchaseId } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('purchases:receive', async (_event, purchaseId: number, userId: number) => {
    try {
      const db = getDatabase()

      const receive = db.transaction(() => {
        const purchase = db
          .prepare('SELECT * FROM purchase_invoices WHERE id = ? AND status = "draft"')
          .get(purchaseId) as any

        if (!purchase) throw new Error('Purchase not found or already received')

        const items = db
          .prepare('SELECT * FROM purchase_items WHERE purchase_invoice_id = ?')
          .all(purchaseId) as any[]

        // Create stock moves
        const insertMove = db.prepare(
          `INSERT INTO stock_moves (product_id, branch_id, type, quantity, reference_type, reference_id, user_id)
           VALUES (?, ?, 'PURCHASE', ?, 'purchase', ?, ?)`
        )
        const updateStock = db.prepare(
          `UPDATE branch_stock SET quantity = quantity + ?, updated_at = datetime('now')
           WHERE product_id = ? AND branch_id = ?`
        )
        const insertStockIfMissing = db.prepare(
          'INSERT OR IGNORE INTO branch_stock (product_id, branch_id, quantity) VALUES (?, ?, 0)'
        )

        for (const item of items) {
          insertMove.run(item.product_id, purchase.branch_id, item.quantity, purchaseId, userId)
          insertStockIfMissing.run(item.product_id, purchase.branch_id)
          updateStock.run(item.quantity, item.product_id, purchase.branch_id)
        }

        // Update purchase status
        db.prepare(
          "UPDATE purchase_invoices SET status = 'received', received_at = datetime('now'), updated_at = datetime('now') WHERE id = ?"
        ).run(purchaseId)

        // Audit log
        db.prepare(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json)
           VALUES (?, 'receive_purchase', 'purchase', ?, ?)`
        ).run(userId, purchaseId, JSON.stringify({
          supplier_id: purchase.supplier_id,
          total: purchase.total,
          items: items.length
        }))
      })

      receive()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('purchases:list', async (_event, filters?: {
    supplier_id?: number
    branch_id?: number
    status?: string
    date_from?: string
    date_to?: string
  }) => {
    try {
      const db = getDatabase()
      let sql = `
        SELECT pi.*, s.name as supplier_name, b.name as branch_name, u.display_name as user_name
        FROM purchase_invoices pi
        JOIN suppliers s ON pi.supplier_id = s.id
        JOIN branches b ON pi.branch_id = b.id
        LEFT JOIN users u ON pi.user_id = u.id
      `
      const conditions: string[] = []
      const params: any[] = []

      if (filters?.supplier_id) { conditions.push('pi.supplier_id = ?'); params.push(filters.supplier_id) }
      if (filters?.branch_id) { conditions.push('pi.branch_id = ?'); params.push(filters.branch_id) }
      if (filters?.status) { conditions.push('pi.status = ?'); params.push(filters.status) }
      if (filters?.date_from) { conditions.push('pi.created_at >= ?'); params.push(filters.date_from) }
      if (filters?.date_to) { conditions.push('pi.created_at <= ?'); params.push(filters.date_to) }

      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
      sql += ' ORDER BY pi.created_at DESC'

      const purchases = db.prepare(sql).all(...params)
      return { success: true, data: purchases }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('purchases:get', async (_event, id: number) => {
    try {
      const db = getDatabase()
      const purchase = db
        .prepare(
          `SELECT pi.*, s.name as supplier_name, b.name as branch_name
           FROM purchase_invoices pi
           JOIN suppliers s ON pi.supplier_id = s.id
           JOIN branches b ON pi.branch_id = b.id
           WHERE pi.id = ?`
        )
        .get(id) as any

      if (!purchase) return { success: true, data: null }

      purchase.items = db
        .prepare(
          `SELECT pit.*, p.name as product_name, p.barcode
           FROM purchase_items pit
           JOIN products p ON pit.product_id = p.id
           WHERE pit.purchase_invoice_id = ?`
        )
        .all(id)

      return { success: true, data: purchase }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('purchases:cancel', async (_event, id: number) => {
    try {
      const db = getDatabase()
      const purchase = db
        .prepare('SELECT status FROM purchase_invoices WHERE id = ?')
        .get(id) as { status: string } | undefined

      if (!purchase) return { success: false, error: 'Purchase not found' }
      if (purchase.status !== 'draft') return { success: false, error: 'Only draft purchases can be cancelled' }

      db.prepare("UPDATE purchase_invoices SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
