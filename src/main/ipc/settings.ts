import { ipcMain } from 'electron'
import { getDatabase } from '../database'

export function registerSettingsHandlers(): void {
  ipcMain.handle('settings:get', async (_event, key: string) => {
    try {
      const db = getDatabase()
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined
      return { success: true, data: row?.value ?? null }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('settings:get-all', async () => {
    try {
      const db = getDatabase()
      const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
      const settings: Record<string, string> = {}
      for (const row of rows) {
        settings[row.key] = row.value
      }
      return { success: true, data: settings }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    try {
      const db = getDatabase()
      db.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      ).run(key, value)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('settings:set-many', async (_event, entries: Record<string, string>) => {
    try {
      const db = getDatabase()
      const upsert = db.prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
      )

      const batchUpsert = db.transaction((items: Record<string, string>) => {
        for (const [key, value] of Object.entries(items)) {
          upsert.run(key, value)
        }
      })

      batchUpsert(entries)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('settings:get-business', async () => {
    try {
      const db = getDatabase()
      const business = db.prepare('SELECT * FROM businesses LIMIT 1').get()
      return { success: true, data: business ?? null }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('settings:get-branches', async () => {
    try {
      const db = getDatabase()
      const branches = db.prepare('SELECT * FROM branches WHERE is_active = 1 ORDER BY name').all()
      return { success: true, data: branches }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('settings:get-branch', async (_event, branchId: number) => {
    try {
      const db = getDatabase()
      const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(branchId)
      return { success: true, data: branch ?? null }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('settings:update-branch', async (_event, id: number, data: {
    name?: string
    code?: string
    invoice_prefix?: string
    address?: string
    phone?: string
  }) => {
    try {
      const db = getDatabase()
      const sets: string[] = []
      const values: any[] = []

      if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
      if (data.code !== undefined) { sets.push('code = ?'); values.push(data.code) }
      if (data.invoice_prefix !== undefined) { sets.push('invoice_prefix = ?'); values.push(data.invoice_prefix) }
      if (data.address !== undefined) { sets.push('address = ?'); values.push(data.address) }
      if (data.phone !== undefined) { sets.push('phone = ?'); values.push(data.phone) }

      if (sets.length === 0) return { success: true }

      sets.push("updated_at = datetime('now')")
      values.push(id)

      db.prepare(`UPDATE branches SET ${sets.join(', ')} WHERE id = ?`).run(...values)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('settings:update-business', async (_event, data: {
    name?: string
    currency?: string
    tax_mode?: string
  }) => {
    try {
      const db = getDatabase()
      const sets: string[] = []
      const values: any[] = []

      if (data.name !== undefined) { sets.push('name = ?'); values.push(data.name) }
      if (data.currency !== undefined) { sets.push('currency = ?'); values.push(data.currency) }
      if (data.tax_mode !== undefined) { sets.push('tax_mode = ?'); values.push(data.tax_mode) }

      if (sets.length === 0) return { success: true }

      sets.push("updated_at = datetime('now')")

      db.prepare(`UPDATE businesses SET ${sets.join(', ')} WHERE id = 1`).run(...values)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
