import { ipcMain } from 'electron'
import { getDatabase } from '../database'

export function registerInventoryHandlers(): void {
  ipcMain.handle('inventory:get-stock', async (_event, branchId: number, filters?: {
    search?: string
    category_id?: number
    low_stock_only?: boolean
  }) => {
    try {
      const db = getDatabase()
      let sql = `
        SELECT p.id, p.id as product_id, p.barcode, p.name, p.name as product_name,
               p.sku, p.cost_price, p.selling_price,
               p.low_stock_threshold, p.low_stock_threshold as min_stock,
               p.unit, c.name as category_name,
               COALESCE(bs.quantity, 0) as quantity
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN branch_stock bs ON bs.product_id = p.id AND bs.branch_id = ?
        WHERE p.is_active = 1
      `
      const params: any[] = [branchId]

      if (filters?.search) {
        sql += ' AND (p.barcode = ? OR p.name LIKE ? OR p.sku LIKE ?)'
        params.push(filters.search, `%${filters.search}%`, `%${filters.search}%`)
      }
      if (filters?.category_id) {
        sql += ' AND p.category_id = ?'
        params.push(filters.category_id)
      }
      if (filters?.low_stock_only) {
        sql += ' AND COALESCE(bs.quantity, 0) <= p.low_stock_threshold'
      }

      sql += ' ORDER BY p.name'

      const stock = db.prepare(sql).all(...params)
      return { success: true, data: stock }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('inventory:get-stock-history', async (_event, productId: number, branchId: number, limit: number = 50) => {
    try {
      const db = getDatabase()
      const moves = db
        .prepare(
          `SELECT sm.*, u.display_name as user_name
           FROM stock_moves sm
           LEFT JOIN users u ON sm.user_id = u.id
           WHERE sm.product_id = ? AND sm.branch_id = ?
           ORDER BY sm.created_at DESC
           LIMIT ?`
        )
        .all(productId, branchId, limit)
      return { success: true, data: moves }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('inventory:adjust', async (_event, data: {
    product_id: number
    branch_id: number
    quantity: number
    notes: string
    user_id: number
  }) => {
    try {
      const db = getDatabase()

      const adjust = db.transaction(() => {
        // Create stock move
        db.prepare(
          `INSERT INTO stock_moves (product_id, branch_id, type, quantity, reference_type, notes, user_id)
           VALUES (?, ?, 'ADJUSTMENT', ?, 'adjustment', ?, ?)`
        ).run(data.product_id, data.branch_id, data.quantity, data.notes, data.user_id)

        // Update branch_stock cache
        db.prepare(
          'INSERT OR IGNORE INTO branch_stock (product_id, branch_id, quantity) VALUES (?, ?, 0)'
        ).run(data.product_id, data.branch_id)

        db.prepare(
          "UPDATE branch_stock SET quantity = quantity + ?, updated_at = datetime('now') WHERE product_id = ? AND branch_id = ?"
        ).run(data.quantity, data.product_id, data.branch_id)

        // Audit log
        db.prepare(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json)
           VALUES (?, 'stock_adjustment', 'product', ?, ?)`
        ).run(data.user_id, data.product_id, JSON.stringify({
          branch_id: data.branch_id,
          quantity: data.quantity,
          notes: data.notes
        }))
      })

      adjust()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('inventory:transfer', async (_event, data: {
    product_id: number
    from_branch_id: number
    to_branch_id: number
    quantity: number
    notes: string
    user_id: number
  }) => {
    try {
      const db = getDatabase()

      const transfer = db.transaction(() => {
        // Check stock availability
        const stock = db
          .prepare('SELECT quantity FROM branch_stock WHERE product_id = ? AND branch_id = ?')
          .get(data.product_id, data.from_branch_id) as { quantity: number } | undefined

        if (!stock || stock.quantity < data.quantity) {
          throw new Error('Insufficient stock for transfer')
        }

        // TRANSFER_OUT from source
        db.prepare(
          `INSERT INTO stock_moves (product_id, branch_id, type, quantity, reference_type, notes, user_id)
           VALUES (?, ?, 'TRANSFER_OUT', ?, 'transfer', ?, ?)`
        ).run(data.product_id, data.from_branch_id, -data.quantity, data.notes, data.user_id)

        db.prepare(
          "UPDATE branch_stock SET quantity = quantity - ?, updated_at = datetime('now') WHERE product_id = ? AND branch_id = ?"
        ).run(data.quantity, data.product_id, data.from_branch_id)

        // TRANSFER_IN to destination
        db.prepare(
          `INSERT INTO stock_moves (product_id, branch_id, type, quantity, reference_type, notes, user_id)
           VALUES (?, ?, 'TRANSFER_IN', ?, 'transfer', ?, ?)`
        ).run(data.product_id, data.to_branch_id, data.quantity, data.notes, data.user_id)

        db.prepare(
          'INSERT OR IGNORE INTO branch_stock (product_id, branch_id, quantity) VALUES (?, ?, 0)'
        ).run(data.product_id, data.to_branch_id)

        db.prepare(
          "UPDATE branch_stock SET quantity = quantity + ?, updated_at = datetime('now') WHERE product_id = ? AND branch_id = ?"
        ).run(data.quantity, data.product_id, data.to_branch_id)

        // Audit log
        db.prepare(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details_json)
           VALUES (?, 'stock_transfer', 'product', ?, ?)`
        ).run(data.user_id, data.product_id, JSON.stringify({
          from_branch: data.from_branch_id,
          to_branch: data.to_branch_id,
          quantity: data.quantity,
          notes: data.notes
        }))
      })

      transfer()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('inventory:get-low-stock', async (_event, branchId: number) => {
    try {
      const db = getDatabase()
      const items = db
        .prepare(
          `SELECT p.id, p.barcode, p.name, p.low_stock_threshold,
                  COALESCE(bs.quantity, 0) as quantity,
                  c.name as category_name
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           LEFT JOIN branch_stock bs ON bs.product_id = p.id AND bs.branch_id = ?
           WHERE p.is_active = 1 AND COALESCE(bs.quantity, 0) <= p.low_stock_threshold
           ORDER BY COALESCE(bs.quantity, 0) ASC`
        )
        .all(branchId)
      return { success: true, data: items }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('inventory:reconcile', async (_event, branchId: number) => {
    try {
      const db = getDatabase()

      // Compare branch_stock cache with actual stock_moves sum
      const discrepancies = db
        .prepare(
          `SELECT p.id, p.name, p.barcode,
                  COALESCE(bs.quantity, 0) as cached_qty,
                  COALESCE(SUM(sm.quantity), 0) as actual_qty
           FROM products p
           LEFT JOIN branch_stock bs ON bs.product_id = p.id AND bs.branch_id = ?
           LEFT JOIN stock_moves sm ON sm.product_id = p.id AND sm.branch_id = ?
           WHERE p.is_active = 1
           GROUP BY p.id
           HAVING cached_qty != actual_qty`
        )
        .all(branchId, branchId)

      return { success: true, data: discrepancies }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('inventory:fix-cache', async (_event, branchId: number) => {
    try {
      const db = getDatabase()

      const fix = db.transaction(() => {
        // Recalculate all branch_stock from stock_moves
        const products = db.prepare('SELECT id FROM products WHERE is_active = 1').all() as { id: number }[]

        for (const product of products) {
          const sum = db
            .prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM stock_moves WHERE product_id = ? AND branch_id = ?')
            .get(product.id, branchId) as { total: number }

          db.prepare(
            `INSERT INTO branch_stock (product_id, branch_id, quantity, updated_at)
             VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(product_id, branch_id) DO UPDATE SET quantity = ?, updated_at = datetime('now')`
          ).run(product.id, branchId, sum.total, sum.total)
        }
      })

      fix()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
