import { ipcMain } from 'electron'
import { getDatabase } from '../database'
import bcrypt from 'bcryptjs'

interface LoginResult {
  success: boolean
  user?: {
    id: number
    username: string
    display_name: string
    role_id: number
    role_name: string
    branch_id: number
    branch_name: string
    permissions: Record<string, string>
  }
  error?: string
}

export function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', async (_event, username: string, password: string): Promise<LoginResult> => {
    try {
      const db = getDatabase()

      const user = db
        .prepare(
          `SELECT u.*, r.name as role_name, b.name as branch_name
           FROM users u
           JOIN roles r ON u.role_id = r.id
           JOIN branches b ON u.branch_id = b.id
           WHERE u.username = ? AND u.is_active = 1`
        )
        .get(username) as any

      if (!user) {
        return { success: false, error: 'Invalid username or password' }
      }

      const validPassword = bcrypt.compareSync(password, user.password_hash)
      if (!validPassword) {
        return { success: false, error: 'Invalid username or password' }
      }

      // Get permissions
      const perms = db
        .prepare('SELECT permission_key, value FROM permissions WHERE role_id = ?')
        .all(user.role_id) as { permission_key: string; value: string }[]

      const permissions: Record<string, string> = {}
      for (const p of perms) {
        permissions[p.permission_key] = p.value
      }

      // Update last login
      db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id)

      return {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          role_id: user.role_id,
          role_name: user.role_name,
          branch_id: user.branch_id,
          branch_name: user.branch_name,
          permissions
        }
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:change-password', async (_event, userId: number, oldPassword: string, newPassword: string) => {
    try {
      const db = getDatabase()
      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as any

      if (!user || !bcrypt.compareSync(oldPassword, user.password_hash)) {
        return { success: false, error: 'Current password is incorrect' }
      }

      const hash = bcrypt.hashSync(newPassword, 10)
      db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, userId)

      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:get-users', async () => {
    try {
      const db = getDatabase()
      const users = db
        .prepare(
          `SELECT u.id, u.username, u.display_name, u.role_id, u.branch_id,
                  u.is_active, u.last_login_at, u.created_at,
                  r.name as role_name, b.name as branch_name
           FROM users u
           JOIN roles r ON u.role_id = r.id
           JOIN branches b ON u.branch_id = b.id
           ORDER BY u.display_name`
        )
        .all()

      return { success: true, data: users }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:create-user', async (_event, data: {
    username: string
    display_name: string
    password: string
    role_id: number
    branch_id: number
  }) => {
    try {
      const db = getDatabase()

      // Check uniqueness
      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(data.username)
      if (existing) {
        return { success: false, error: 'Username already exists' }
      }

      const hash = bcrypt.hashSync(data.password, 10)

      const result = db
        .prepare(
          `INSERT INTO users (username, display_name, password_hash, role_id, branch_id)
           VALUES (?, ?, ?, ?, ?)`
        )
        .run(data.username, data.display_name, hash, data.role_id, data.branch_id)

      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:update-user', async (_event, id: number, data: {
    display_name?: string
    role_id?: number
    branch_id?: number
    is_active?: number
  }) => {
    try {
      const db = getDatabase()
      const sets: string[] = []
      const values: any[] = []

      if (data.display_name !== undefined) { sets.push('display_name = ?'); values.push(data.display_name) }
      if (data.role_id !== undefined) { sets.push('role_id = ?'); values.push(data.role_id) }
      if (data.branch_id !== undefined) { sets.push('branch_id = ?'); values.push(data.branch_id) }
      if (data.is_active !== undefined) { sets.push('is_active = ?'); values.push(data.is_active) }

      if (sets.length === 0) return { success: true }

      sets.push("updated_at = datetime('now')")
      values.push(id)

      db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:reset-password', async (_event, userId: number, newPassword: string) => {
    try {
      const db = getDatabase()
      const hash = bcrypt.hashSync(newPassword, 10)
      db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, userId)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:get-roles', async () => {
    try {
      const db = getDatabase()
      const roles = db.prepare('SELECT * FROM roles ORDER BY id').all()
      return { success: true, data: roles }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('auth:get-permissions', async (_event, roleId: number) => {
    try {
      const db = getDatabase()
      const perms = db.prepare('SELECT permission_key, value FROM permissions WHERE role_id = ?').all(roleId)
      return { success: true, data: perms }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
