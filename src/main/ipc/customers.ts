import { ipcMain } from 'electron'
import { getDatabase } from '../database'

export function registerCustomerHandlers(): void {
  // ── List customers ──
  ipcMain.handle(
    'customers:list',
    async (_event, filters?: { search?: string; is_active?: number; limit?: number; offset?: number }) => {
      try {
        const db = getDatabase()
        let sql = `SELECT * FROM customers WHERE 1=1`
        const params: any[] = []

        if (filters?.search) {
          sql += ` AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)`
          const s = `%${filters.search}%`
          params.push(s, s, s)
        }

        if (filters?.is_active !== undefined) {
          sql += ` AND is_active = ?`
          params.push(filters.is_active)
        }

        sql += ` ORDER BY name ASC`

        if (filters?.limit) {
          sql += ` LIMIT ?`
          params.push(filters.limit)
          if (filters.offset) {
            sql += ` OFFSET ?`
            params.push(filters.offset)
          }
        }

        const rows = db.prepare(sql).all(...params)
        return { success: true, data: rows }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  // ── Search customers (fast, for autocomplete) ──
  ipcMain.handle('customers:search', async (_event, query: string, limit: number = 10) => {
    try {
      const db = getDatabase()
      const rows = db
        .prepare(
          `SELECT id, name, phone, email, balance
           FROM customers
           WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ?)
           ORDER BY name ASC
           LIMIT ?`
        )
        .all(`%${query}%`, `%${query}%`, limit)
      return { success: true, data: rows }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ── Get single customer ──
  ipcMain.handle('customers:get', async (_event, id: number) => {
    try {
      const db = getDatabase()
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
      if (!customer) return { success: false, error: 'Customer not found' }
      return { success: true, data: customer }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ── Get customer purchase history ──
  ipcMain.handle('customers:history', async (_event, customerId: number, limit: number = 50) => {
    try {
      const db = getDatabase()
      const sales = db
        .prepare(
          `SELECT s.id, s.invoice_number, s.total, s.status, s.created_at,
                  u.display_name as cashier_name
           FROM sales s
           LEFT JOIN users u ON s.user_id = u.id
           WHERE s.customer_id = ?
           ORDER BY s.created_at DESC
           LIMIT ?`
        )
        .all(customerId, limit)

      const stats = db
        .prepare(
          `SELECT
             COUNT(*) as total_purchases,
             COALESCE(SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END), 0) as total_spent,
             MAX(created_at) as last_purchase
           FROM sales
           WHERE customer_id = ? AND status IN ('completed', 'partial_return')`
        )
        .get(customerId) as any

      return { success: true, data: { sales, stats } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ── Create customer ──
  ipcMain.handle(
    'customers:create',
    async (
      _event,
      data: { name: string; phone?: string; email?: string; address?: string; notes?: string }
    ) => {
      try {
        const db = getDatabase()

        // Duplicate phone check
        if (data.phone) {
          const existing = db
            .prepare('SELECT id FROM customers WHERE phone = ?')
            .get(data.phone)
          if (existing) {
            return { success: false, error: 'A customer with this phone number already exists' }
          }
        }

        const result = db
          .prepare(
            `INSERT INTO customers (name, phone, email, address, notes)
             VALUES (?, ?, ?, ?, ?)`
          )
          .run(data.name, data.phone ?? null, data.email ?? null, data.address ?? null, data.notes ?? null)

        return { success: true, data: { id: result.lastInsertRowid } }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  // ── Update customer ──
  ipcMain.handle(
    'customers:update',
    async (
      _event,
      id: number,
      data: { name?: string; phone?: string; email?: string; address?: string; notes?: string; is_active?: number }
    ) => {
      try {
        const db = getDatabase()

        // Duplicate phone check (exclude self)
        if (data.phone) {
          const existing = db
            .prepare('SELECT id FROM customers WHERE phone = ? AND id != ?')
            .get(data.phone, id) as any
          if (existing) {
            return { success: false, error: 'A customer with this phone number already exists' }
          }
        }

        const fields: string[] = []
        const values: any[] = []

        if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name) }
        if (data.phone !== undefined) { fields.push('phone = ?'); values.push(data.phone || null) }
        if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email || null) }
        if (data.address !== undefined) { fields.push('address = ?'); values.push(data.address || null) }
        if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes || null) }
        if (data.is_active !== undefined) { fields.push('is_active = ?'); values.push(data.is_active) }

        if (fields.length === 0) return { success: true }

        fields.push("updated_at = datetime('now')")
        values.push(id)

        db.prepare(`UPDATE customers SET ${fields.join(', ')} WHERE id = ?`).run(...values)
        return { success: true }
      } catch (error) {
        return { success: false, error: (error as Error).message }
      }
    }
  )

  // ── Delete customer (soft) ──
  ipcMain.handle('customers:delete', async (_event, id: number) => {
    try {
      const db = getDatabase()

      // Check if customer has sales
      const salesCount = db
        .prepare('SELECT COUNT(*) as count FROM sales WHERE customer_id = ?')
        .get(id) as { count: number }

      if (salesCount.count > 0) {
        // Soft delete — just deactivate
        db.prepare("UPDATE customers SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id)
      } else {
        db.prepare('DELETE FROM customers WHERE id = ?').run(id)
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
