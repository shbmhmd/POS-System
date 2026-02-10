import { ipcMain } from 'electron'
import { getDatabase } from '../database'

export function registerShiftHandlers(): void {
  ipcMain.handle('shifts:open', async (_event, data: {
    branch_id: number
    user_id: number
    opening_cash?: number
  }) => {
    try {
      const db = getDatabase()

      // Check if user already has an open shift
      const existing = db
        .prepare(`SELECT id FROM shifts WHERE user_id = ? AND branch_id = ? AND status = 'open'`)
        .get(data.user_id, data.branch_id)

      if (existing) {
        return { success: false, error: 'You already have an open shift. Close it first.' }
      }

      // Auto-calculate opening cash from last closed shift's closing cash
      let openingCash = data.opening_cash ?? 0
      if (data.opening_cash === undefined || data.opening_cash === null) {
        const lastShift = db
          .prepare(
            `SELECT closing_cash FROM shifts
             WHERE branch_id = ? AND status = 'closed'
             ORDER BY closed_at DESC LIMIT 1`
          )
          .get(data.branch_id) as { closing_cash: number } | undefined

        openingCash = lastShift?.closing_cash ?? 0
      }

      const result = db
        .prepare(
          'INSERT INTO shifts (branch_id, user_id, opening_cash) VALUES (?, ?, ?)'
        )
        .run(data.branch_id, data.user_id, openingCash)

      return { success: true, data: { id: result.lastInsertRowid, opening_cash: openingCash } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('shifts:close', async (_event, shiftId: number, closingCash?: number, notes?: string) => {
    try {
      const db = getDatabase()

      const shift = db.prepare(`SELECT * FROM shifts WHERE id = ? AND status = 'open'`).get(shiftId) as any
      if (!shift) {
        return { success: false, error: 'Shift not found or already closed' }
      }

      // Calculate expected cash from payments
      const cashPayments = db
        .prepare(
          `SELECT COALESCE(SUM(p.amount), 0) as total
           FROM payments p
           JOIN sales s ON p.sale_id = s.id
           WHERE s.shift_id = ? AND p.method = 'cash' AND s.status != 'voided'`
        )
        .get(shiftId) as { total: number }

      const expectedCash = shift.opening_cash + cashPayments.total - shift.total_refunds

      // Auto-calculate closing cash if not manually provided
      const actualClosingCash = (closingCash !== undefined && closingCash !== null) ? closingCash : expectedCash
      const difference = actualClosingCash - expectedCash

      db.prepare(
        `UPDATE shifts SET
           closing_cash = ?,
           expected_cash = ?,
           difference = ?,
           status = 'closed',
           closed_at = datetime('now'),
           notes = ?
         WHERE id = ?`
      ).run(actualClosingCash, expectedCash, difference, notes ?? null, shiftId)

      return {
        success: true,
        data: {
          opening_cash: shift.opening_cash,
          closing_cash: actualClosingCash,
          expected_cash: expectedCash,
          difference,
          total_sales: shift.total_sales,
          total_refunds: shift.total_refunds,
          total_transactions: shift.total_transactions
        }
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('shifts:get-current', async (_event, userId: number, branchId: number) => {
    try {
      const db = getDatabase()
      const shift = db
        .prepare(
          `SELECT s.*, u.display_name as user_name
           FROM shifts s
           JOIN users u ON s.user_id = u.id
           WHERE s.user_id = ? AND s.branch_id = ? AND s.status = 'open'`
        )
        .get(userId, branchId)
      return { success: true, data: shift ?? null }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('shifts:get-report', async (_event, shiftId: number) => {
    try {
      const db = getDatabase()

      const shift = db
        .prepare(
          `SELECT s.*, u.display_name as user_name, b.name as branch_name
           FROM shifts s
           JOIN users u ON s.user_id = u.id
           JOIN branches b ON s.branch_id = b.id
           WHERE s.id = ?`
        )
        .get(shiftId) as any

      if (!shift) return { success: true, data: null }

      // Payment breakdown
      const paymentBreakdown = db
        .prepare(
          `SELECT p.method, SUM(p.amount) as total, COUNT(*) as count
           FROM payments p
           JOIN sales s ON p.sale_id = s.id
           WHERE s.shift_id = ? AND s.status != 'voided'
           GROUP BY p.method`
        )
        .all(shiftId)

      // Top products sold
      const topProducts = db
        .prepare(
          `SELECT si.product_name, SUM(si.quantity) as qty_sold, SUM(si.total) as revenue
           FROM sale_items si
           JOIN sales s ON si.sale_id = s.id
           WHERE s.shift_id = ? AND s.status = 'completed'
           GROUP BY si.product_id
           ORDER BY qty_sold DESC
           LIMIT 10`
        )
        .all(shiftId)

      return {
        success: true,
        data: {
          ...shift,
          payment_breakdown: paymentBreakdown,
          top_products: topProducts
        }
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('shifts:list', async (_event, filters?: {
    branch_id?: number
    user_id?: number
    status?: string
    date_from?: string
    date_to?: string
    limit?: number
  }) => {
    try {
      const db = getDatabase()
      let sql = `
        SELECT s.*, u.display_name as user_name, b.name as branch_name
        FROM shifts s
        JOIN users u ON s.user_id = u.id
        JOIN branches b ON s.branch_id = b.id
      `
      const conditions: string[] = []
      const params: any[] = []

      if (filters?.branch_id) { conditions.push('s.branch_id = ?'); params.push(filters.branch_id) }
      if (filters?.user_id) { conditions.push('s.user_id = ?'); params.push(filters.user_id) }
      if (filters?.status) { conditions.push('s.status = ?'); params.push(filters.status) }
      if (filters?.date_from) { conditions.push('s.opened_at >= ?'); params.push(filters.date_from) }
      if (filters?.date_to) { conditions.push('s.opened_at <= ?'); params.push(filters.date_to) }

      if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ')
      sql += ' ORDER BY s.opened_at DESC'

      if (filters?.limit) {
        sql += ' LIMIT ?'
        params.push(filters.limit)
      }

      const shifts = db.prepare(sql).all(...params)
      return { success: true, data: shifts }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
