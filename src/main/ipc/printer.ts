import { ipcMain, BrowserWindow } from 'electron'
import { mainWindow } from '../index'

const VIRTUAL_PRINTER_KEYWORDS = ['pdf', 'xps', 'onenote', 'fax', 'send to', 'microsoft print']

function isRealPrinter(name: string): boolean {
  const lower = name.toLowerCase()
  return !VIRTUAL_PRINTER_KEYWORDS.some((kw) => lower.includes(kw))
}

async function resolvePhysicalPrinter(preferredName?: string): Promise<string | null> {
  // 1. If a specific printer was passed, use it
  if (preferredName) return preferredName

  // 2. Check saved default in DB
  try {
    const { getDatabase } = await import('../database/index')
    const db = getDatabase()
    const row = db.prepare(`SELECT value FROM settings WHERE key = 'default_printer'`).get() as
      | { value: string }
      | undefined
    if (row?.value) return row.value
  } catch { /* ignore */ }

  // 3. Auto-detect first real (non-PDF/XPS) printer from the system
  if (!mainWindow) return null
  try {
    const printers = mainWindow.webContents.getPrintersAsync
      ? await mainWindow.webContents.getPrintersAsync()
      : []
    const real = printers.find((p) => isRealPrinter(p.name))
    return real?.name || null
  } catch {
    return null
  }
}

interface ReceiptData {
  business_name: string
  branch_name: string
  branch_address?: string
  branch_phone?: string
  invoice_number: string
  date: string
  cashier: string
  customer_name?: string
  items: {
    name: string
    qty: number
    price: number
    total: number
  }[]
  subtotal: number
  discount: number
  tax: number
  total: number
  payments: {
    method: string
    amount: number
  }[]
  change?: number
  footer_message?: string
}

function buildReceiptHtml(data: ReceiptData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
    <tr>
      <td style="text-align:left">${item.name}</td>
      <td style="text-align:center">${item.qty}</td>
      <td style="text-align:right">${item.price.toFixed(2)}</td>
      <td style="text-align:right">${item.total.toFixed(2)}</td>
    </tr>`
    )
    .join('')

  const paymentsHtml = data.payments
    .map(
      (p) =>
        `<div style="display:flex;justify-content:space-between"><span>${p.method.toUpperCase()}</span><span>${p.amount.toFixed(2)}</span></div>`
    )
    .join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { margin: 0; size: 80mm auto; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; padding: 4mm; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 2px 0; font-size: 11px; }
  th { border-bottom: 1px solid #000; }
  .summary { display: flex; justify-content: space-between; }
  .big { font-size: 16px; font-weight: bold; }
</style>
</head><body>
  <div class="center bold" style="font-size:14px">${data.business_name}</div>
  <div class="center">${data.branch_name}</div>
  ${data.branch_address ? `<div class="center" style="font-size:10px">${data.branch_address}</div>` : ''}
  ${data.branch_phone ? `<div class="center" style="font-size:10px">Tel: ${data.branch_phone}</div>` : ''}
  <div class="line"></div>
  <div class="summary"><span>Invoice:</span><span class="bold">${data.invoice_number}</span></div>
  <div class="summary"><span>Date:</span><span>${data.date}</span></div>
  <div class="summary"><span>Cashier:</span><span>${data.cashier}</span></div>
  ${data.customer_name ? `<div class="summary"><span>Customer:</span><span>${data.customer_name}</span></div>` : ''}
  <div class="line"></div>
  <table>
    <thead><tr>
      <th style="text-align:left">Item</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:right">Price</th>
      <th style="text-align:right">Total</th>
    </tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="line"></div>
  <div class="summary"><span>Subtotal</span><span>${data.subtotal.toFixed(2)}</span></div>
  ${data.discount > 0 ? `<div class="summary"><span>Discount</span><span>-${data.discount.toFixed(2)}</span></div>` : ''}
  ${data.tax > 0 ? `<div class="summary"><span>Tax</span><span>${data.tax.toFixed(2)}</span></div>` : ''}
  <div class="line"></div>
  <div class="summary big"><span>TOTAL</span><span>${data.total.toFixed(2)}</span></div>
  <div class="line"></div>
  <div class="bold" style="margin-top:4px">Payment:</div>
  ${paymentsHtml}
  ${data.change && data.change > 0 ? `<div class="summary bold"><span>Change</span><span>${data.change.toFixed(2)}</span></div>` : ''}
  <div class="line"></div>
  <div class="center" style="margin-top:6px;font-size:10px">${data.footer_message || 'Thank you for your purchase!'}</div>
  <div class="center" style="margin-top:8px;font-size:8px;color:#888">Powered by Unixora Point | A product of Unixora</div>
</body></html>`
}

export function registerPrinterHandlers(): void {
  ipcMain.handle('printer:get-printers', async () => {
    try {
      if (!mainWindow) return { success: true, data: [] }
      const printers = mainWindow.webContents.getPrintersAsync
        ? await mainWindow.webContents.getPrintersAsync()
        : []
      return {
        success: true,
        data: printers.map((p) => ({
          name: p.name,
          displayName: p.displayName || p.name,
          isDefault: p.isDefault,
          status: p.status
        }))
      }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('printer:test', async (_event, printerName: string) => {
    try {
      const testHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <style>@page{margin:0;size:80mm auto}body{font-family:'Courier New',monospace;width:80mm;padding:4mm;text-align:center}</style>
        </head><body><h2>Printer Test</h2><p>If you can read this, your printer is working!</p><p>${new Date().toLocaleString()}</p></body></html>`

      const printWin = new BrowserWindow({ show: false, width: 302, height: 600 })
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(testHtml)}`)

      return new Promise((resolve) => {
        printWin.webContents.print(
          {
            silent: true,
            deviceName: printerName,
            printBackground: true
          },
          (success, failureReason) => {
            printWin.close()
            if (success) {
              resolve({ success: true, data: { message: 'Test print sent' } })
            } else {
              resolve({ success: false, error: failureReason || 'Print failed' })
            }
          }
        )
      })
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('printer:print-receipt', async (_event, receiptData: ReceiptData, printerName?: string) => {
    try {
      const deviceName = await resolvePhysicalPrinter(printerName)
      if (!deviceName) {
        return { success: false, error: 'No physical printer found. Please configure a printer in Settings.' }
      }

      const html = buildReceiptHtml(receiptData)
      const printWin = new BrowserWindow({ show: false, width: 302, height: 800 })
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

      return new Promise((resolve) => {
        printWin.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName
          },
          (success, failureReason) => {
            printWin.close()
            if (success) {
              resolve({ success: true })
            } else {
              resolve({ success: false, error: failureReason || 'Print failed' })
            }
          }
        )
      })
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('printer:set-default', async (_event, printerName: string) => {
    try {
      // Store default printer name in app settings (using the DB)
      const { getDatabase } = await import('../database/index')
      const db = getDatabase()
      db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('default_printer', ?)`).run(printerName)
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle('printer:get-default', async () => {
    try {
      const { getDatabase } = await import('../database/index')
      const db = getDatabase()
      const row = db.prepare(`SELECT value FROM settings WHERE key = 'default_printer'`).get() as
        | { value: string }
        | undefined
      return { success: true, data: row?.value || null }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
