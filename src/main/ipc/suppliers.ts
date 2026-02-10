import { ipcMain } from 'electron'
import { getDatabase } from '../database'

export function registerSupplierHandlers(): void {
  ipcMain.handle('suppliers:list', async () => {
    try {
      const db = getDatabase()
      const suppliers = db
        .prepare('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name')
        .all()
      return { success: true, data: suppliers }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('suppliers:get', async (_event, id: number) => {
    try {
      const db = getDatabase()
      const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id)
      return { success: true, data: supplier ?? null }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('suppliers:create', async (_event, data: {
    name: string
    contact_person?: string
    phone?: string
    email?: string
    address?: string
    notes?: string
  }) => {
    try {
      const db = getDatabase()
      const result = db
        .prepare(
          `INSERT INTO suppliers (name, contact_person, phone, email, address, notes)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(data.name, data.contact_person ?? null, data.phone ?? null, data.email ?? null, data.address ?? null, data.notes ?? null)
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('suppliers:update', async (_event, id: number, data: {
    name?: string
    contact_person?: string
    phone?: string
    email?: string
    address?: string
    notes?: string
    is_active?: number
  }) => {
    try {
      const db = getDatabase()
      const sets: string[] = []
      const values: any[] = []

      if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
      if (data.contact_person !== undefined) { sets.push('contact_person = ?'); values.push(data.contact_person) }
      if (data.phone !== undefined) { sets.push('phone = ?'); values.push(data.phone) }
      if (data.email !== undefined) { sets.push('email = ?'); values.push(data.email) }
      if (data.address !== undefined) { sets.push('address = ?'); values.push(data.address) }
      if (data.notes !== undefined) { sets.push('notes = ?'); values.push(data.notes) }
      if (data.is_active !== undefined) { sets.push('is_active = ?'); values.push(data.is_active) }

      if (sets.length === 0) return { success: true }

      sets.push("updated_at = datetime('now')")
      values.push(id)

      db.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`).run(...values)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('suppliers:delete', async (_event, id: number) => {
    try {
      const db = getDatabase()
      const count = db
        .prepare('SELECT COUNT(*) as cnt FROM purchase_invoices WHERE supplier_id = ?')
        .get(id) as { cnt: number }

      if (count.cnt > 0) {
        return { success: false, error: `Cannot delete: ${count.cnt} purchase(s) exist for this supplier` }
      }

      db.prepare('DELETE FROM suppliers WHERE id = ?').run(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
