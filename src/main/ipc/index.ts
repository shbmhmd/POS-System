import { registerAuthHandlers } from './auth'
import { registerSettingsHandlers } from './settings'
import { registerProductHandlers } from './products'
import { registerCategoryHandlers } from './categories'
import { registerSalesHandlers } from './sales'
import { registerInventoryHandlers } from './inventory'
import { registerShiftHandlers } from './shifts'
import { registerSupplierHandlers } from './suppliers'
import { registerPurchaseHandlers } from './purchases'
import { registerReportHandlers } from './reports'
import { registerPrinterHandlers } from './printer'
import { registerGoogleHandlers } from './google'
import { registerSetupHandlers } from './setup'
import { registerUpdaterHandlers } from './updater'
import { registerCustomerHandlers } from './customers'

export function registerAllIpcHandlers(): void {
  registerAuthHandlers()
  registerSettingsHandlers()
  registerProductHandlers()
  registerCategoryHandlers()
  registerSalesHandlers()
  registerInventoryHandlers()
  registerShiftHandlers()
  registerSupplierHandlers()
  registerPurchaseHandlers()
  registerReportHandlers()
  registerPrinterHandlers()
  registerGoogleHandlers()
  registerSetupHandlers()
  registerUpdaterHandlers()
  registerCustomerHandlers()
  console.log('[IPC] All handlers registered')
}
