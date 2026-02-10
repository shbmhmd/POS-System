import { ipcMain } from 'electron'
import { app } from 'electron'
import { checkForUpdates, openDownloadPage } from '../services/updater'
import * as fs from 'fs'
import * as path from 'path'

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

  ipcMain.handle('updater:get-version', () => {
    return { success: true, data: app.getVersion() }
  })

  ipcMain.handle('updater:get-changelog', () => {
    try {
      // In production, changelog is in resources; in dev, in project root
      const possiblePaths = [
        path.join(process.resourcesPath || '', 'CHANGELOG.md'),
        path.join(app.getAppPath(), 'CHANGELOG.md'),
        path.join(__dirname, '../../CHANGELOG.md'),
        path.join(__dirname, '../../../CHANGELOG.md')
      ]
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          return { success: true, data: fs.readFileSync(p, 'utf-8') }
        }
      }
      return { success: false, error: 'Changelog not found' }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('updater:get-last-shown-version', () => {
    try {
      const configPath = path.join(app.getPath('userData'), 'update-config.json')
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        return { success: true, data: config.lastShownVersion || '0.0.0' }
      }
      return { success: true, data: '0.0.0' }
    } catch {
      return { success: true, data: '0.0.0' }
    }
  })

  ipcMain.handle('updater:set-last-shown-version', (_event, version: string) => {
    try {
      const configPath = path.join(app.getPath('userData'), 'update-config.json')
      fs.writeFileSync(configPath, JSON.stringify({ lastShownVersion: version }))
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  console.log('[IPC] Updater handlers registered')
}
