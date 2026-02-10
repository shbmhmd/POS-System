import { ipcMain } from 'electron'
import { getDatabase } from '../database'

export function registerReportHandlers(): void {
  ipcMain.handle('reports:daily-sales', async (_event, branchId: number, dateFrom: string, dateTo: string) => {
    try {
      const db = getDatabase()
      const data = db
        .prepare(
          `SELECT
             DATE(s.created_at) as date,
             COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as total_transactions,
             COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total ELSE 0 END), 0) as total_sales,
             COALESCE(SUM(CASE WHEN s.status IN ('returned', 'partial_return') THEN ABS(s.total) ELSE 0 END), 0) as total_refunds,
             COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.discount_amount ELSE 0 END), 0) as total_discounts,
             COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.tax_amount ELSE 0 END), 0) as total_tax
           FROM sales s
           WHERE s.branch_id = ? AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
             AND s.status != 'voided'
           GROUP BY DATE(s.created_at)
           ORDER BY date DESC`
        )
        .all(branchId, dateFrom, dateTo)
      return { success: true, data }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('reports:sales-by-product', async (_event, branchId: number, dateFrom: string, dateTo: string) => {
    try {
      const db = getDatabase()
      const data = db
        .prepare(
          `SELECT
             si.product_id,
             si.product_name,
             COALESCE(c.name, 'Uncategorized') as category_name,
             SUM(si.quantity) as qty_sold,
             SUM(si.total) as revenue,
             SUM(si.quantity * si.cost_price) as cost,
             SUM(si.total) - SUM(si.quantity * si.cost_price) as profit
           FROM sale_items si
           JOIN sales s ON si.sale_id = s.id
           LEFT JOIN products p ON si.product_id = p.id
           LEFT JOIN categories c ON p.category_id = c.id
           WHERE s.branch_id = ? AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
             AND s.status = 'completed'
           GROUP BY si.product_id
           ORDER BY revenue DESC`
        )
        .all(branchId, dateFrom, dateTo)
      return { success: true, data }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('reports:sales-by-category', async (_event, branchId: number, dateFrom: string, dateTo: string) => {
    try {
      const db = getDatabase()
      const data = db
        .prepare(
          `SELECT
             COALESCE(c.name, 'Uncategorized') as category_name,
             COUNT(DISTINCT s.id) as transaction_count,
             SUM(si.quantity) as qty_sold,
             SUM(si.total) as revenue
           FROM sale_items si
           JOIN sales s ON si.sale_id = s.id
           LEFT JOIN products p ON si.product_id = p.id
           LEFT JOIN categories c ON p.category_id = c.id
           WHERE s.branch_id = ? AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
             AND s.status = 'completed'
           GROUP BY c.id
           ORDER BY revenue DESC`
        )
        .all(branchId, dateFrom, dateTo)
      return { success: true, data }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('reports:payment-breakdown', async (_event, branchId: number, dateFrom: string, dateTo: string) => {
    try {
      const db = getDatabase()
      const data = db
        .prepare(
          `SELECT
             p.method,
             COUNT(*) as count,
             SUM(p.amount) as total
           FROM payments p
           JOIN sales s ON p.sale_id = s.id
           WHERE s.branch_id = ? AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
             AND s.status != 'voided'
           GROUP BY p.method
           ORDER BY total DESC`
        )
        .all(branchId, dateFrom, dateTo)
      return { success: true, data }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('reports:profit', async (_event, branchId: number, dateFrom: string, dateTo: string) => {
    try {
      const db = getDatabase()
      const data = db
        .prepare(
          `SELECT
             DATE(s.created_at) as date,
             SUM(si.total) as revenue,
             SUM(si.quantity * si.cost_price) as cost,
             SUM(si.total) - SUM(si.quantity * si.cost_price) as profit,
             CASE WHEN SUM(si.total) > 0
               THEN ROUND((SUM(si.total) - SUM(si.quantity * si.cost_price)) * 100.0 / SUM(si.total), 2)
               ELSE 0
             END as margin_pct
           FROM sale_items si
           JOIN sales s ON si.sale_id = s.id
           WHERE s.branch_id = ? AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
             AND s.status = 'completed'
           GROUP BY DATE(s.created_at)
           ORDER BY date DESC`
        )
        .all(branchId, dateFrom, dateTo)
      return { success: true, data }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('reports:tax-summary', async (_event, branchId: number, dateFrom: string, dateTo: string) => {
    try {
      const db = getDatabase()
      const data = db
        .prepare(
          `SELECT
             DATE(s.created_at) as date,
             SUM(s.subtotal) as taxable_amount,
             SUM(s.tax_amount) as tax_collected,
             SUM(s.total) as total_with_tax
           FROM sales s
           WHERE s.branch_id = ? AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
             AND s.status = 'completed'
           GROUP BY DATE(s.created_at)
           ORDER BY date DESC`
        )
        .all(branchId, dateFrom, dateTo)
      return { success: true, data }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('reports:cashier-performance', async (_event, branchId: number, dateFrom: string, dateTo: string) => {
    try {
      const db = getDatabase()
      const data = db
        .prepare(
          `SELECT
             u.id as user_id,
             u.display_name as cashier_name,
             COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as sales_count,
             COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total ELSE 0 END), 0) as total_sales,
             COALESCE(SUM(CASE WHEN s.status IN ('returned') THEN ABS(s.total) ELSE 0 END), 0) as total_refunds,
             COALESCE(AVG(CASE WHEN s.status = 'completed' THEN s.total END), 0) as avg_sale_value
           FROM sales s
           JOIN users u ON s.user_id = u.id
           WHERE s.branch_id = ? AND DATE(s.created_at) >= ? AND DATE(s.created_at) <= ?
             AND s.status != 'voided'
           GROUP BY u.id
           ORDER BY total_sales DESC`
        )
        .all(branchId, dateFrom, dateTo)
      return { success: true, data }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('reports:dashboard', async (_event, branchId: number) => {
    try {
      const db = getDatabase()
      const today = new Date().toISOString().split('T')[0]

      const todaySales = db
        .prepare(
          `SELECT
             COUNT(*) as count,
             COALESCE(SUM(total), 0) as total
           FROM sales
           WHERE branch_id = ? AND DATE(created_at) = ? AND status = 'completed'`
        )
        .get(branchId, today) as { count: number; total: number }

      const lowStockCount = db
        .prepare(
          `SELECT COUNT(*) as count
           FROM products p
           LEFT JOIN branch_stock bs ON bs.product_id = p.id AND bs.branch_id = ?
           WHERE p.is_active = 1 AND COALESCE(bs.quantity, 0) <= p.low_stock_threshold`
        )
        .get(branchId) as { count: number }

      const totalProducts = db
        .prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1')
        .get() as { count: number }

      const recentSales = db
        .prepare(
          `SELECT s.id, s.invoice_number, s.total, s.status, s.created_at,
                  u.display_name as cashier_name
           FROM sales s
           JOIN users u ON s.user_id = u.id
           WHERE s.branch_id = ? AND s.status != 'voided'
           ORDER BY s.created_at DESC LIMIT 10`
        )
        .all(branchId)

      return {
        success: true,
        data: {
          today_sales: todaySales,
          low_stock_count: lowStockCount.count,
          total_products: totalProducts.count,
          recent_sales: recentSales
        }
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
