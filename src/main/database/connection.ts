import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { runMigrations } from './migrate'

let db: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

export function initDatabase(): Database.Database {
  const dbPath = path.join(app.getPath('userData'), 'pos.db')
  console.log(`[DB] Opening database at: ${dbPath}`)

  db = new Database(dbPath)

  // Performance & safety pragmas
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  db.pragma('cache_size = -20000') // 20MB cache

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Run pending migrations
  runMigrations(db)

  console.log('[DB] Database initialized successfully')
  return db
}

export function closeDatabase(): void {
  if (db) {
    console.log('[DB] Closing database')
    db.close()
    db = null
  }
}

export function getDatabasePath(): string {
  return path.join(app.getPath('userData'), 'pos.db')
}
