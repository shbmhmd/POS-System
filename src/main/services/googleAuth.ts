/**
 * Google OAuth 2.0 authentication service for Desktop POS
 * Uses OAuth2 with loopback redirect for desktop apps
 */

import { google } from 'googleapis'
import { app, shell } from 'electron'
import * as http from 'http'
import * as url from 'url'
import * as fs from 'fs'
import * as path from 'path'

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email'
]

const TOKEN_FILE = 'google-tokens.json'

interface StoredTokens {
  access_token: string
  refresh_token: string
  expiry_date: number
  email?: string
}

function getTokenPath(): string {
  return path.join(app.getPath('userData'), TOKEN_FILE)
}

function loadTokens(): StoredTokens | null {
  try {
    const tokenPath = getTokenPath()
    if (fs.existsSync(tokenPath)) {
      const data = fs.readFileSync(tokenPath, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('[Google] Failed to load tokens:', err)
  }
  return null
}

function saveTokens(tokens: StoredTokens): void {
  try {
    const tokenPath = getTokenPath()
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), 'utf-8')
    console.log('[Google] Tokens saved')
  } catch (err) {
    console.error('[Google] Failed to save tokens:', err)
  }
}

function deleteTokens(): void {
  try {
    const tokenPath = getTokenPath()
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath)
    }
  } catch (err) {
    console.error('[Google] Failed to delete tokens:', err)
  }
}

export function createOAuthClient() {
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'http://localhost')
}

export function getAuthenticatedClient() {
  const tokens = loadTokens()
  if (!tokens) return null

  const oauth2 = createOAuthClient()
  oauth2.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date
  })

  // Auto-refresh token when expired
  oauth2.on('tokens', (newTokens) => {
    const existing = loadTokens()
    saveTokens({
      access_token: newTokens.access_token || existing?.access_token || '',
      refresh_token: newTokens.refresh_token || existing?.refresh_token || '',
      expiry_date: newTokens.expiry_date || existing?.expiry_date || 0,
      email: existing?.email
    })
  })

  return oauth2
}

export async function getConnectionStatus(): Promise<{ connected: boolean; email: string | null }> {
  const tokens = loadTokens()
  if (!tokens) return { connected: false, email: null }

  try {
    const oauth2 = getAuthenticatedClient()
    if (!oauth2) return { connected: false, email: null }

    // Verify the token still works
    const tokenInfo = await oauth2.getAccessToken()
    if (!tokenInfo.token) {
      return { connected: false, email: null }
    }

    return { connected: true, email: tokens.email || null }
  } catch (err) {
    console.error('[Google] Token invalid:', err)
    // Token is invalid, clean up
    deleteTokens()
    return { connected: false, email: null }
  }
}

/**
 * Start OAuth2 flow: open browser, listen on localhost for callback
 */
export function startAuthFlow(): Promise<{ success: boolean; email?: string; error?: string }> {
  return new Promise((resolve) => {
    const oauth2 = createOAuthClient()

    // Find a free port by binding to 0
    const server = http.createServer()

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as any).port
      const redirectUri = `http://127.0.0.1:${port}`

      // Update client with actual redirect URI
      const oauth2WithRedirect = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri)

      const authUrl = oauth2WithRedirect.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
      })

      console.log(`[Google] Auth server listening on port ${port}`)

      // Handle the callback
      server.on('request', async (req, res) => {
        try {
          const queryParams = new url.URL(req.url || '', redirectUri).searchParams
          const code = queryParams.get('code')
          const error = queryParams.get('error')

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end('<html><body><h2>Authentication cancelled.</h2><p>You can close this window.</p></body></html>')
            server.close()
            resolve({ success: false, error: `Authentication cancelled: ${error}` })
            return
          }

          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' })
            res.end('<html><body><h2>Missing authorization code.</h2></body></html>')
            return
          }

          // Exchange code for tokens
          const { tokens } = await oauth2WithRedirect.getToken(code)

          // Get user email
          oauth2WithRedirect.setCredentials(tokens)
          const oauth2Service = google.oauth2({ version: 'v2', auth: oauth2WithRedirect })
          const userInfo = await oauth2Service.userinfo.get()
          const email = userInfo.data.email || ''

          // Save tokens
          saveTokens({
            access_token: tokens.access_token || '',
            refresh_token: tokens.refresh_token || '',
            expiry_date: tokens.expiry_date || 0,
            email
          })

          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(`<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>✅ Connected!</h2><p>Signed in as <strong>${email}</strong></p><p>You can close this window and return to POS System.</p></body></html>`)
          server.close()
          resolve({ success: true, email })
        } catch (err) {
          console.error('[Google] Token exchange failed:', err)
          res.writeHead(500, { 'Content-Type': 'text/html' })
          res.end('<html><body><h2>Authentication failed.</h2><p>Please try again.</p></body></html>')
          server.close()
          resolve({ success: false, error: (err as Error).message })
        }
      })

      // Set a 5-minute timeout
      const timeout = setTimeout(() => {
        server.close()
        resolve({ success: false, error: 'Authentication timed out (5 minutes)' })
      }, 5 * 60 * 1000)

      server.on('close', () => clearTimeout(timeout))

      // Open browser
      shell.openExternal(authUrl)
    })
  })
}

export function disconnect(): void {
  deleteTokens()
  console.log('[Google] Disconnected')
}

export function getStoredEmail(): string | null {
  const tokens = loadTokens()
  return tokens?.email || null
}
