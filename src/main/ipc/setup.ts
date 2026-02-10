import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import bcrypt from 'bcryptjs'

export function registerSetupHandlers(): void {
  ipcMain.handle('setup:check-completed', async () => {
    try {
      const db = getDatabase()
      const business = db.prepare('SELECT id FROM businesses LIMIT 1').get()
      return { success: true, data: { completed: !!business } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('setup:complete', async (_event, data: {
    business: {
      name: string
      currency: string
      tax_mode: 'inclusive' | 'exclusive'
    }
    branches: {
      name: string
      code: string
      invoice_prefix: string
      address?: string
      phone?: string
    }[]
    admin: {
      username: string
      display_name: string
      password: string
    }
    printer_name?: string
  }) => {
    try {
      const db = getDatabase()

      const setup = db.transaction(() => {
        // Create business
        const bizResult = db
          .prepare('INSERT INTO businesses (name, currency, tax_mode) VALUES (?, ?, ?)')
          .run(data.business.name, data.business.currency, data.business.tax_mode)
        const businessId = bizResult.lastInsertRowid

        // Create branches
        const branchIds: number[] = []
        const insertBranch = db.prepare(
          'INSERT INTO branches (business_id, name, code, invoice_prefix, address, phone) VALUES (?, ?, ?, ?, ?, ?)'
        )
        for (const branch of data.branches) {
          const result = insertBranch.run(
            businessId, branch.name, branch.code, branch.invoice_prefix,
            branch.address ?? null, branch.phone ?? null
          )
          branchIds.push(result.lastInsertRowid as number)
        }

        // Create admin user (assigned to first branch)
        const hash = bcrypt.hashSync(data.admin.password, 10)
        db.prepare(
          'INSERT INTO users (branch_id, username, display_name, password_hash, role_id) VALUES (?, ?, ?, ?, 1)'
        ).run(branchIds[0], data.admin.username, data.admin.display_name, hash)

        // Store printer setting if provided
        if (data.printer_name) {
          db.prepare(
            `INSERT INTO settings (key, value) VALUES ('default_printer', ?)`
          ).run(data.printer_name)
        }

        // Mark setup complete
        db.prepare(
          `INSERT INTO settings (key, value) VALUES ('setup_completed', '1')`
        ).run()

        return { businessId, branchIds }
      })

      const result = setup()
      return { success: true, data: result }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
