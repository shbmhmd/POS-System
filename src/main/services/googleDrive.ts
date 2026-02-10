/**
 * Google Drive backup service
 * Uploads the SQLite database file to Google Drive
 */

import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { getAuthenticatedClient, getStoredEmail } from './googleAuth'
import { getDatabasePath } from '../database'

const BACKUP_FOLDER_NAME = 'POS System Backups'
const SETTINGS_FILE = 'google-backup-meta.json'

interface BackupMeta {
  last_backup: string | null
  last_backup_file_id: string | null
  folder_id: string | null
  last_export: string | null
  last_export_sheet_id: string | null
}

function getMetaPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE)
}

export function loadBackupMeta(): BackupMeta {
  try {
    const metaPath = getMetaPath()
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    }
  } catch (err) {
    console.error('[Backup] Failed to load meta:', err)
  }
  return {
    last_backup: null,
    last_backup_file_id: null,
    folder_id: null,
    last_export: null,
    last_export_sheet_id: null
  }
}

export function saveBackupMeta(meta: BackupMeta): void {
  try {
    fs.writeFileSync(getMetaPath(), JSON.stringify(meta, null, 2), 'utf-8')
  } catch (err) {
    console.error('[Backup] Failed to save meta:', err)
  }
}

/**
 * Ensure the backup folder exists in Google Drive, or create it
 */
async function ensureBackupFolder(drive: any): Promise<string> {
  const meta = loadBackupMeta()

  // Check if stored folder still exists
  if (meta.folder_id) {
    try {
      const existing = await drive.files.get({
        fileId: meta.folder_id,
        fields: 'id,trashed'
      })
      if (existing.data && !existing.data.trashed) {
        return meta.folder_id
      }
    } catch {
      // Folder was deleted, create new one
    }
  }

  // Search for existing folder
  const search = await drive.files.list({
    q: `name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive'
  })

  if (search.data.files && search.data.files.length > 0) {
    const folderId = search.data.files[0].id!
    meta.folder_id = folderId
    saveBackupMeta(meta)
    return folderId
  }

  // Create new folder
  const folder = await drive.files.create({
    requestBody: {
      name: BACKUP_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    },
    fields: 'id'
  })

  const folderId = folder.data.id!
  meta.folder_id = folderId
  saveBackupMeta(meta)
  return folderId
}

/**
 * Backup the SQLite database to Google Drive
 */
export async function backupDatabase(): Promise<{ success: boolean; error?: string }> {
  const auth = getAuthenticatedClient()
  if (!auth) {
    return { success: false, error: 'Not connected to Google. Please connect first.' }
  }

  try {
    const drive = google.drive({ version: 'v3', auth })
    const dbPath = getDatabasePath()

    if (!fs.existsSync(dbPath)) {
      return { success: false, error: 'Database file not found' }
    }

    const folderId = await ensureBackupFolder(drive)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileName = `pos-backup-${timestamp}.db`

    console.log(`[Backup] Uploading database to Drive: ${fileName}`)

    const fileSize = fs.statSync(dbPath).size
    const media = {
      mimeType: 'application/x-sqlite3',
      body: fs.createReadStream(dbPath)
    }

    const result = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        description: `POS System database backup - ${new Date().toLocaleString()}`
      },
      media,
      fields: 'id,name,size'
    })

    console.log(`[Backup] Uploaded: ${result.data.name} (${result.data.size} bytes)`)

    // Clean up old backups (keep last 10)
    await cleanupOldBackups(drive, folderId, 10)

    // Update meta
    const meta = loadBackupMeta()
    meta.last_backup = new Date().toISOString()
    meta.last_backup_file_id = result.data.id!
    saveBackupMeta(meta)

    return { success: true }
  } catch (err) {
    console.error('[Backup] Failed:', err)
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Keep only the N most recent backups, delete older ones
 */
async function cleanupOldBackups(drive: any, folderId: string, keep: number): Promise<void> {
  try {
    const list = await drive.files.list({
      q: `'${folderId}' in parents and name contains 'pos-backup-' and trashed=false`,
      fields: 'files(id,name,createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 100
    })

    const files = list.data.files || []
    if (files.length > keep) {
      const toDelete = files.slice(keep)
      for (const file of toDelete) {
        console.log(`[Backup] Deleting old backup: ${file.name}`)
        await drive.files.delete({ fileId: file.id })
      }
    }
  } catch (err) {
    console.error('[Backup] Cleanup failed:', err)
    // Non-critical, don't throw
  }
}

/**
 * Get last backup info
 */
export function getLastBackup(): string | null {
  return loadBackupMeta().last_backup
}
