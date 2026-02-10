import { ipcMain } from 'electron'
import { getConnectionStatus, startAuthFlow, disconnect } from '../services/googleAuth'
import { backupDatabase, getLastBackup } from '../services/googleDrive'
import { exportToSheets, getLastExport } from '../services/googleSheets'

export function registerGoogleHandlers(): void {
  ipcMain.handle('google:get-status', async () => {
    try {
      const status = await getConnectionStatus()
      const lastBackup = getLastBackup()
      const lastExport = getLastExport()
      return {
        success: true,
        data: {
          connected: status.connected,
          email: status.email,
          last_backup: lastBackup,
          last_export: lastExport.date,
          last_export_sheet_id: lastExport.sheet_id
        }
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('google:connect', async () => {
    try {
      const result = await startAuthFlow()
      if (result.success) {
        return { success: true, data: { email: result.email } }
      }
      return { success: false, error: result.error || 'Connection failed' }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('google:disconnect', async () => {
    try {
      disconnect()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('google:backup-now', async () => {
    try {
      const result = await backupDatabase()
      return result
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('google:export-now', async () => {
    try {
      const result = await exportToSheets()
      return result
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('google:get-last-backup', async () => {
    try {
      return { success: true, data: getLastBackup() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('google:get-last-export', async () => {
    try {
      return { success: true, data: getLastExport() }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
