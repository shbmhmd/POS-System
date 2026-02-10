/**
 * Google Sheets export service
 * Exports daily sales summary to a Google Sheet
 */

import { google } from 'googleapis'
import { getAuthenticatedClient } from './googleAuth'
import { getDatabase } from '../database'
import { loadBackupMeta, saveBackupMeta } from './googleDrive'

const SHEET_TITLE = 'POS System - Sales Report'

/**
 * Export daily sales data to Google Sheets
 */
export async function exportToSheets(): Promise<{ success: boolean; url?: string; error?: string }> {
  const auth = getAuthenticatedClient()
  if (!auth) {
    return { success: false, error: 'Not connected to Google. Please connect first.' }
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth })
    const db = getDatabase()
    const meta = loadBackupMeta()

    let spreadsheetId = meta.last_export_sheet_id

    // Try to access existing sheet, create new if not found
    if (spreadsheetId) {
      try {
        await sheets.spreadsheets.get({ spreadsheetId })
      } catch {
        spreadsheetId = null // Sheet was deleted, create new
      }
    }

    if (!spreadsheetId) {
      // Create new spreadsheet
      const newSheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title: SHEET_TITLE },
          sheets: [
            { properties: { title: 'Daily Sales', index: 0 } },
            { properties: { title: 'Products', index: 1 } },
            { properties: { title: 'Payments', index: 2 } }
          ]
        }
      })
      spreadsheetId = newSheet.data.spreadsheetId!
      console.log(`[Sheets] Created new spreadsheet: ${spreadsheetId}`)
    }

    // ───── Sheet 1: Daily Sales ─────
    const dailySales = db.prepare(`
      SELECT 
        DATE(s.created_at) as date,
        b.name as branch,
        COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as transactions,
        COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.subtotal ELSE 0 END), 0) as subtotal,
        COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.discount_amount ELSE 0 END), 0) as discounts,
        COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.tax_amount ELSE 0 END), 0) as tax,
        COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.total ELSE 0 END), 0) as total,
        COUNT(CASE WHEN s.status IN ('returned', 'partial_return') THEN 1 END) as returns,
        COALESCE(SUM(CASE WHEN s.status IN ('returned', 'partial_return') THEN ABS(s.total) ELSE 0 END), 0) as return_amount
      FROM sales s
      JOIN branches b ON s.branch_id = b.id
      WHERE s.status != 'voided'
      GROUP BY DATE(s.created_at), s.branch_id
      ORDER BY date DESC
    `).all() as any[]

    const dailyRows: any[][] = [
      ['Date', 'Branch', 'Transactions', 'Subtotal', 'Discounts', 'Tax', 'Total', 'Returns', 'Return Amount']
    ]
    for (const row of dailySales) {
      dailyRows.push([
        row.date,
        row.branch,
        row.transactions,
        Number(row.subtotal).toFixed(2),
        Number(row.discounts).toFixed(2),
        Number(row.tax).toFixed(2),
        Number(row.total).toFixed(2),
        row.returns,
        Number(row.return_amount).toFixed(2)
      ])
    }

    // ───── Sheet 2: Product Performance ─────
    const productData = db.prepare(`
      SELECT
        p.name as product_name,
        p.barcode,
        p.sku,
        COALESCE(c.name, 'Uncategorized') as category,
        p.cost_price,
        p.selling_price,
        COALESCE(SUM(si.quantity), 0) as total_qty_sold,
        COALESCE(SUM(si.total), 0) as total_revenue,
        COALESCE(SUM(si.quantity * si.cost_price), 0) as total_cost,
        COALESCE(SUM(si.total) - SUM(si.quantity * si.cost_price), 0) as profit
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN sale_items si ON si.product_id = p.id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.status = 'completed'
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY total_revenue DESC
    `).all() as any[]

    const productRows: any[][] = [
      ['Product', 'Barcode', 'SKU', 'Category', 'Cost Price', 'Selling Price', 'Qty Sold', 'Revenue', 'Cost', 'Profit']
    ]
    for (const row of productData) {
      productRows.push([
        row.product_name,
        row.barcode || '',
        row.sku || '',
        row.category,
        Number(row.cost_price).toFixed(2),
        Number(row.selling_price).toFixed(2),
        row.total_qty_sold,
        Number(row.total_revenue).toFixed(2),
        Number(row.total_cost).toFixed(2),
        Number(row.profit).toFixed(2)
      ])
    }

    // ───── Sheet 3: Payment Breakdown ─────
    const paymentData = db.prepare(`
      SELECT
        DATE(s.created_at) as date,
        p.method,
        COUNT(*) as count,
        SUM(p.amount) as total
      FROM payments p
      JOIN sales s ON p.sale_id = s.id
      WHERE s.status != 'voided'
      GROUP BY DATE(s.created_at), p.method
      ORDER BY date DESC, total DESC
    `).all() as any[]

    const paymentRows: any[][] = [
      ['Date', 'Method', 'Count', 'Amount']
    ]
    for (const row of paymentData) {
      paymentRows.push([
        row.date,
        String(row.method).toUpperCase(),
        row.count,
        Number(row.total).toFixed(2)
      ])
    }

    // Write all sheets
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: 'Daily Sales!A1', values: dailyRows },
          { range: 'Products!A1', values: productRows },
          { range: 'Payments!A1', values: paymentRows }
        ]
      }
    })

    // Format header rows bold
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties.sheetId' })
    const sheetIds = (spreadsheet.data.sheets || []).map(s => s.properties?.sheetId || 0)

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: sheetIds.map(sheetId => ({
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
              }
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)'
          }
        }))
      }
    })

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    console.log(`[Sheets] Export complete: ${sheetUrl}`)

    // Update meta
    meta.last_export = new Date().toISOString()
    meta.last_export_sheet_id = spreadsheetId
    saveBackupMeta(meta)

    return { success: true, url: sheetUrl }
  } catch (err) {
    console.error('[Sheets] Export failed:', err)
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Get last export info
 */
export function getLastExport(): { date: string | null; sheet_id: string | null } {
  const meta = loadBackupMeta()
  return { date: meta.last_export, sheet_id: meta.last_export_sheet_id }
}
