import { app, shell } from 'electron'
import https from 'https'

const GITHUB_OWNER = 'shbmhmd'
const GITHUB_REPO = 'POS-System'

export interface UpdateInfo {
  updateAvailable: boolean
  currentVersion: string
  latestVersion: string
  releaseNotes: string
  releaseDate: string
  downloadUrl: string
  htmlUrl: string
}

function compareVersions(current: string, latest: string): number {
  const a = current.replace(/^v/, '').split('.').map(Number)
  const b = latest.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] || 0
    const bv = b[i] || 0
    if (av < bv) return -1
    if (av > bv) return 1
  }
  return 0
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  const currentVersion = app.getVersion()

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      method: 'GET',
      headers: {
        'User-Agent': `POS-System/${currentVersion}`,
        Accept: 'application/vnd.github.v3+json'
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          if (res.statusCode === 404) {
            resolve({
              updateAvailable: false,
              currentVersion,
              latestVersion: currentVersion,
              releaseNotes: '',
              releaseDate: '',
              downloadUrl: '',
              htmlUrl: ''
            })
            return
          }

          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API returned status ${res.statusCode}`))
            return
          }

          const release = JSON.parse(data)
          const latestVersion = (release.tag_name || '').replace(/^v/, '')

          // Find the .exe asset
          const exeAsset = (release.assets || []).find(
            (a: any) => a.name.endsWith('.exe') || a.name.endsWith('-setup.exe')
          )

          const updateAvailable = compareVersions(currentVersion, latestVersion) < 0

          resolve({
            updateAvailable,
            currentVersion,
            latestVersion,
            releaseNotes: release.body || '',
            releaseDate: release.published_at || release.created_at || '',
            downloadUrl: exeAsset?.browser_download_url || '',
            htmlUrl: release.html_url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
          })
        } catch (err) {
          reject(new Error('Failed to parse update response'))
        }
      })
    })

    req.on('error', (err) => reject(err))
    req.setTimeout(15000, () => {
      req.destroy()
      reject(new Error('Update check timed out'))
    })
    req.end()
  })
}

export function openDownloadPage(url: string): void {
  shell.openExternal(url || `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`)
}
