import { ipcMain } from 'electron'
import { checkForUpdates, openDownloadPage } from '../services/updater'

export function registerUpdaterHandlers(): void {
  ipcMain.handle('updater:check', async () => {
    try {
      const info = await checkForUpdates()
      return { success: true, data: info }
    } catch (err: any) {
      console.error('[Updater] Check failed:', err.message)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('updater:download', async (_event, url: string) => {
    try {
      openDownloadPage(url)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  console.log('[IPC] Updater handlers registered')
}
