import { ipcMain } from 'electron'
import { getDatabase } from '../database'

export function registerCategoryHandlers(): void {
  ipcMain.handle('categories:list', async () => {
    try {
      const db = getDatabase()
      const categories = db
        .prepare(
          `SELECT c.*, COUNT(p.id) as product_count
           FROM categories c
           LEFT JOIN products p ON p.category_id = c.id
           GROUP BY c.id
           ORDER BY c.sort_order, c.name`
        )
        .all()
      return { success: true, data: categories }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('categories:get', async (_event, id: number) => {
    try {
      const db = getDatabase()
      const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
      return { success: true, data: category ?? null }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('categories:create', async (_event, data: {
    name: string
    description?: string
    parent_id?: number
    sort_order?: number
  }) => {
    try {
      const db = getDatabase()
      const result = db
        .prepare(
          `INSERT INTO categories (name, description, parent_id, sort_order)
           VALUES (?, ?, ?, ?)`
        )
        .run(data.name, data.description ?? null, data.parent_id ?? null, data.sort_order ?? 0)

      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('categories:update', async (_event, id: number, data: {
    name?: string
    description?: string
    parent_id?: number
    sort_order?: number
    is_active?: number
  }) => {
    try {
      const db = getDatabase()
      const sets: string[] = []
      const values: any[] = []

      if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
      if (data.description !== undefined) { sets.push('description = ?'); values.push(data.description) }
      if (data.parent_id !== undefined) { sets.push('parent_id = ?'); values.push(data.parent_id) }
      if (data.sort_order !== undefined) { sets.push('sort_order = ?'); values.push(data.sort_order) }
      if (data.is_active !== undefined) { sets.push('is_active = ?'); values.push(data.is_active) }

      if (sets.length === 0) return { success: true }

      sets.push("updated_at = datetime('now')")
      values.push(id)

      db.prepare(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`).run(...values)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('categories:delete', async (_event, id: number) => {
    try {
      const db = getDatabase()

      // Check if products exist in this category
      const count = db.prepare('SELECT COUNT(*) as cnt FROM products WHERE category_id = ?').get(id) as { cnt: number }
      if (count.cnt > 0) {
        return { success: false, error: `Cannot delete category: ${count.cnt} product(s) belong to it` }
      }

      db.prepare('DELETE FROM categories WHERE id = ?').run(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
