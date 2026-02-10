import { ipcMain } from 'electron'
import { getDatabase } from '../database'

export function registerProductHandlers(): void {
  ipcMain.handle('products:list', async (_event, filters?: {
    search?: string
    category_id?: number | string
    is_active?: number
    show_inactive?: boolean
    branch_id?: number
    limit?: number
    offset?: number
    page?: number
    per_page?: number
  }) => {
    try {
      const db = getDatabase()
      let sql = `
        SELECT p.*, c.name as category_name,
               COALESCE(bs.quantity, 0) as stock_on_hand
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN branch_stock bs ON bs.product_id = p.id
      `
      const conditions: string[] = []
      const params: any[] = []

      if (filters?.branch_id) {
        conditions.push('(bs.branch_id = ? OR bs.branch_id IS NULL)')
        params.push(filters.branch_id)
      }

      if (filters?.search) {
        conditions.push('(p.barcode = ? OR p.name LIKE ? OR p.sku LIKE ?)')
        params.push(filters.search, `%${filters.search}%`, `%${filters.search}%`)
      }
      if (filters?.category_id) {
        conditions.push('p.category_id = ?')
        params.push(Number(filters.category_id))
      }
      if (!filters?.show_inactive) {
        if (filters?.is_active !== undefined) {
          conditions.push('p.is_active = ?')
          params.push(filters.is_active)
        }
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ')
      }

      sql += ' GROUP BY p.id ORDER BY p.name'

      // Count total for pagination
      const countSql = `SELECT COUNT(DISTINCT p.id) as total FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN branch_stock bs ON bs.product_id = p.id
        ${conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''}`
      const countResult = db.prepare(countSql).get(...params) as { total: number }
      const total = countResult?.total || 0

      const perPage = filters?.per_page || filters?.limit || 50
      const currentPage = filters?.page || 1
      const offset = filters?.offset ?? ((currentPage - 1) * perPage)
      const totalPages = Math.max(1, Math.ceil(total / perPage))

      sql += ' LIMIT ? OFFSET ?'
      params.push(perPage, offset)

      const products = db.prepare(sql).all(...params)
      return { success: true, data: { items: products, total, total_pages: totalPages, page: currentPage } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('products:get', async (_event, id: number) => {
    try {
      const db = getDatabase()
      const product = db
        .prepare(
          `SELECT p.*, c.name as category_name
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           WHERE p.id = ?`
        )
        .get(id)
      return { success: true, data: product ?? null }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('products:get-by-barcode', async (_event, barcode: string) => {
    try {
      const db = getDatabase()
      const product = db
        .prepare(
          `SELECT p.*, c.name as category_name,
                  COALESCE(bs.quantity, 0) as stock_on_hand
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           LEFT JOIN branch_stock bs ON bs.product_id = p.id
           WHERE p.barcode = ? AND p.is_active = 1`
        )
        .get(barcode)
      return { success: true, data: product ?? null }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('products:search', async (_event, query: string, limit: number = 20) => {
    try {
      const db = getDatabase()
      const products = db
        .prepare(
          `SELECT p.*, c.name as category_name,
                  COALESCE(bs.quantity, 0) as stock_on_hand
           FROM products p
           LEFT JOIN categories c ON p.category_id = c.id
           LEFT JOIN branch_stock bs ON bs.product_id = p.id
           WHERE p.is_active = 1 AND (p.barcode = ? OR p.name LIKE ? OR p.sku LIKE ?)
           GROUP BY p.id
           ORDER BY
             CASE WHEN p.barcode = ? THEN 0 ELSE 1 END,
             p.name
           LIMIT ?`
        )
        .all(query, `%${query}%`, `%${query}%`, query, limit)
      return { success: true, data: products }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('products:create', async (_event, data: {
    barcode?: string
    sku?: string
    name: string
    category_id?: number
    cost_price: number
    selling_price: number
    tax_rate: number
    unit?: string
    low_stock_threshold?: number
  }) => {
    try {
      const db = getDatabase()

      // Check barcode uniqueness
      if (data.barcode) {
        const existing = db.prepare('SELECT id FROM products WHERE barcode = ?').get(data.barcode)
        if (existing) {
          return { success: false, error: 'A product with this barcode already exists' }
        }
      }

      const result = db
        .prepare(
          `INSERT INTO products (barcode, sku, name, category_id, cost_price, selling_price, tax_rate, unit, low_stock_threshold)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          data.barcode ?? null,
          data.sku ?? null,
          data.name,
          data.category_id ? Number(data.category_id) : null,
          data.cost_price,
          data.selling_price,
          data.tax_rate ?? 0,
          data.unit ?? 'pcs',
          data.low_stock_threshold ?? 10
        )

      // Initialize branch_stock for all branches
      const branches = db.prepare('SELECT id FROM branches').all() as { id: number }[]
      const insertStock = db.prepare('INSERT OR IGNORE INTO branch_stock (product_id, branch_id, quantity) VALUES (?, ?, 0)')
      for (const branch of branches) {
        insertStock.run(result.lastInsertRowid, branch.id)
      }

      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('products:update', async (_event, id: number, data: {
    barcode?: string
    sku?: string
    name?: string
    category_id?: number | null
    cost_price?: number
    selling_price?: number
    tax_rate?: number
    unit?: string
    low_stock_threshold?: number
    is_active?: number
  }) => {
    try {
      const db = getDatabase()

      // Check barcode uniqueness if changing
      if (data.barcode !== undefined) {
        const existing = db.prepare('SELECT id FROM products WHERE barcode = ? AND id != ?').get(data.barcode, id)
        if (existing) {
          return { success: false, error: 'A product with this barcode already exists' }
        }
      }

      const sets: string[] = []
      const values: any[] = []

      if (data.barcode !== undefined) { sets.push('barcode = ?'); values.push(data.barcode || null) }
      if (data.sku !== undefined) { sets.push('sku = ?'); values.push(data.sku || null) }
      if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
      if (data.category_id !== undefined) { sets.push('category_id = ?'); values.push(data.category_id !== null ? Number(data.category_id) : null) }
      if (data.cost_price !== undefined) { sets.push('cost_price = ?'); values.push(data.cost_price) }
      if (data.selling_price !== undefined) { sets.push('selling_price = ?'); values.push(data.selling_price) }
      if (data.tax_rate !== undefined) { sets.push('tax_rate = ?'); values.push(data.tax_rate) }
      if (data.unit !== undefined) { sets.push('unit = ?'); values.push(data.unit) }
      if (data.low_stock_threshold !== undefined) { sets.push('low_stock_threshold = ?'); values.push(data.low_stock_threshold) }
      if (data.is_active !== undefined) { sets.push('is_active = ?'); values.push(typeof data.is_active === 'boolean' ? (data.is_active ? 1 : 0) : data.is_active) }

      if (sets.length === 0) return { success: true }

      sets.push("updated_at = datetime('now')")
      values.push(id)

      db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...values)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('products:check-barcode', async (_event, barcode: string, excludeId?: number) => {
    try {
      const db = getDatabase()
      let query = 'SELECT id FROM products WHERE barcode = ?'
      const params: any[] = [barcode]

      if (excludeId) {
        query += ' AND id != ?'
        params.push(excludeId)
      }

      const existing = db.prepare(query).get(...params)
      return { success: true, data: { exists: !!existing } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
