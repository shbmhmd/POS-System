import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'

// Inline migration registry — each migration is a [name, sql] tuple.
// We import the SQL files as raw strings at build time via Vite's ?raw suffix.
import migration001 from './migrations/001_init.sql?raw'
import migration002 from './migrations/002_payment_methods.sql?raw'
import migration003 from './migrations/003_customers.sql?raw'

const MIGRATIONS: [string, string][] = [
  ['001_init.sql', migration001],
  ['002_payment_methods.sql', migration002],
  ['003_customers.sql', migration003]
]

export function runMigrations(db: Database.Database): void {
  if (MIGRATIONS.length === 0) {
    console.log('[DB] No migrations defined, skipping')
    return
  }

  // Get already-applied migrations
  const applied = new Set(
    db
      .prepare('SELECT name FROM _migrations')
      .all()
      .map((row: any) => row.name)
  )

  // Run pending migrations
  const pending = MIGRATIONS.filter(([name]) => !applied.has(name))

  if (pending.length === 0) {
    console.log('[DB] All migrations already applied')
    return
  }

  console.log(`[DB] Running ${pending.length} pending migration(s)...`)

  const insertMigration = db.prepare('INSERT INTO _migrations (name) VALUES (?)')

  for (const [name, sql] of pending) {
    console.log(`[DB] Applying migration: ${name}`)

    const runMigration = db.transaction(() => {
      db.exec(sql)
      insertMigration.run(name)
    })

    runMigration()
    console.log(`[DB] Migration applied: ${name}`)
  }

  console.log('[DB] All migrations applied successfully')
}
