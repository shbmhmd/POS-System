import { contextBridge, ipcRenderer } from 'electron'

// Type-safe API bridge between renderer and main process
const api = {
  // ========== Setup ==========
  setup: {
    checkCompleted: () => ipcRenderer.invoke('setup:check-completed'),
    complete: (data: any) => ipcRenderer.invoke('setup:complete', data)
  },

  // ========== Auth ==========
  auth: {
    login: (username: string, password: string) => ipcRenderer.invoke('auth:login', username, password),
    changePassword: (userId: number, oldPassword: string, newPassword: string) =>
      ipcRenderer.invoke('auth:change-password', userId, oldPassword, newPassword),
    getUsers: () => ipcRenderer.invoke('auth:get-users'),
    createUser: (data: any) => ipcRenderer.invoke('auth:create-user', data),
    updateUser: (id: number, data: any) => ipcRenderer.invoke('auth:update-user', id, data),
    resetPassword: (userId: number, newPassword: string) =>
      ipcRenderer.invoke('auth:reset-password', userId, newPassword),
    getRoles: () => ipcRenderer.invoke('auth:get-roles'),
    getPermissions: (roleId: number) => ipcRenderer.invoke('auth:get-permissions', roleId)
  },

  // ========== Settings ==========
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    set: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
    setMany: (entries: Record<string, string>) => ipcRenderer.invoke('settings:set-many', entries),
    getBusiness: () => ipcRenderer.invoke('settings:get-business'),
    getBranches: () => ipcRenderer.invoke('settings:get-branches'),
    getBranch: (id: number) => ipcRenderer.invoke('settings:get-branch', id),
    updateBranch: (id: number, data: any) => ipcRenderer.invoke('settings:update-branch', id, data),
    updateBusiness: (data: any) => ipcRenderer.invoke('settings:update-business', data)
  },

  // ========== Categories ==========
  categories: {
    list: () => ipcRenderer.invoke('categories:list'),
    get: (id: number) => ipcRenderer.invoke('categories:get', id),
    create: (data: any) => ipcRenderer.invoke('categories:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('categories:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('categories:delete', id)
  },

  // ========== Products ==========
  products: {
    list: (filters?: any) => ipcRenderer.invoke('products:list', filters),
    get: (id: number) => ipcRenderer.invoke('products:get', id),
    getByBarcode: (barcode: string) => ipcRenderer.invoke('products:get-by-barcode', barcode),
    search: (query: string, limit?: number) => ipcRenderer.invoke('products:search', query, limit),
    create: (data: any) => ipcRenderer.invoke('products:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('products:update', id, data),
    checkBarcode: (barcode: string, excludeId?: number) =>
      ipcRenderer.invoke('products:check-barcode', barcode, excludeId)
  },

  // ========== Sales ==========
  sales: {
    create: (data: any) => ipcRenderer.invoke('sales:create', data),
    get: (id: number) => ipcRenderer.invoke('sales:get', id),
    getByInvoice: (invoiceNumber: string) => ipcRenderer.invoke('sales:get-by-invoice', invoiceNumber),
    list: (filters?: any) => ipcRenderer.invoke('sales:list', filters),
    getLast: (branchId: number) => ipcRenderer.invoke('sales:get-last', branchId),
    void: (saleId: number, userId: number, reason: string) =>
      ipcRenderer.invoke('sales:void', saleId, userId, reason),
    return: (data: any) => ipcRenderer.invoke('sales:return', data),
    hold: (data: any) => ipcRenderer.invoke('sales:hold', data),
    getHeld: (branchId: number) => ipcRenderer.invoke('sales:get-held', branchId),
    getAutosave: (userId: number, branchId: number) =>
      ipcRenderer.invoke('sales:get-autosave', userId, branchId),
    deleteHeld: (id: number) => ipcRenderer.invoke('sales:delete-held', id)
  },

  // ========== Inventory ==========
  inventory: {
    getStock: (branchId: number, filters?: any) =>
      ipcRenderer.invoke('inventory:get-stock', branchId, filters),
    getStockHistory: (productId: number, branchId: number, limit?: number) =>
      ipcRenderer.invoke('inventory:get-stock-history', productId, branchId, limit),
    adjust: (data: any) => ipcRenderer.invoke('inventory:adjust', data),
    transfer: (data: any) => ipcRenderer.invoke('inventory:transfer', data),
    getLowStock: (branchId: number) => ipcRenderer.invoke('inventory:get-low-stock', branchId),
    reconcile: (branchId: number) => ipcRenderer.invoke('inventory:reconcile', branchId),
    fixCache: (branchId: number) => ipcRenderer.invoke('inventory:fix-cache', branchId)
  },

  // ========== Shifts ==========
  shifts: {
    open: (data: any) => ipcRenderer.invoke('shifts:open', data),
    close: (shiftId: number, closingCash: number, notes?: string) =>
      ipcRenderer.invoke('shifts:close', shiftId, closingCash, notes),
    getCurrent: (userId: number, branchId: number) =>
      ipcRenderer.invoke('shifts:get-current', userId, branchId),
    getReport: (shiftId: number) => ipcRenderer.invoke('shifts:get-report', shiftId),
    list: (filters?: any) => ipcRenderer.invoke('shifts:list', filters)
  },

  // ========== Suppliers ==========
  suppliers: {
    list: () => ipcRenderer.invoke('suppliers:list'),
    get: (id: number) => ipcRenderer.invoke('suppliers:get', id),
    create: (data: any) => ipcRenderer.invoke('suppliers:create', data),
    update: (id: number, data: any) => ipcRenderer.invoke('suppliers:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('suppliers:delete', id)
  },

  // ========== Purchases ==========
  purchases: {
    create: (data: any) => ipcRenderer.invoke('purchases:create', data),
    receive: (purchaseId: number, userId: number) =>
      ipcRenderer.invoke('purchases:receive', purchaseId, userId),
    list: (filters?: any) => ipcRenderer.invoke('purchases:list', filters),
    get: (id: number) => ipcRenderer.invoke('purchases:get', id),
    cancel: (id: number) => ipcRenderer.invoke('purchases:cancel', id)
  },

  // ========== Reports ==========
  reports: {
    dailySales: (branchId: number, dateFrom: string, dateTo: string) =>
      ipcRenderer.invoke('reports:daily-sales', branchId, dateFrom, dateTo),
    salesByProduct: (branchId: number, dateFrom: string, dateTo: string) =>
      ipcRenderer.invoke('reports:sales-by-product', branchId, dateFrom, dateTo),
    salesByCategory: (branchId: number, dateFrom: string, dateTo: string) =>
      ipcRenderer.invoke('reports:sales-by-category', branchId, dateFrom, dateTo),
    paymentBreakdown: (branchId: number, dateFrom: string, dateTo: string) =>
      ipcRenderer.invoke('reports:payment-breakdown', branchId, dateFrom, dateTo),
    profit: (branchId: number, dateFrom: string, dateTo: string) =>
      ipcRenderer.invoke('reports:profit', branchId, dateFrom, dateTo),
    taxSummary: (branchId: number, dateFrom: string, dateTo: string) =>
      ipcRenderer.invoke('reports:tax-summary', branchId, dateFrom, dateTo),
    cashierPerformance: (branchId: number, dateFrom: string, dateTo: string) =>
      ipcRenderer.invoke('reports:cashier-performance', branchId, dateFrom, dateTo),
    dashboard: (branchId: number) => ipcRenderer.invoke('reports:dashboard', branchId)
  },

  // ========== Printer ==========
  printer: {
    getPrinters: () => ipcRenderer.invoke('printer:get-printers'),
    test: (printerName: string) => ipcRenderer.invoke('printer:test', printerName),
    printReceipt: (data: any) => ipcRenderer.invoke('printer:print-receipt', data),
    setDefault: (printerName: string) => ipcRenderer.invoke('printer:set-default', printerName)
  },

  // ========== Google ==========
  google: {
    getStatus: () => ipcRenderer.invoke('google:get-status'),
    connect: () => ipcRenderer.invoke('google:connect'),
    disconnect: () => ipcRenderer.invoke('google:disconnect'),
    backupNow: () => ipcRenderer.invoke('google:backup-now'),
    exportNow: () => ipcRenderer.invoke('google:export-now'),
    getLastBackup: () => ipcRenderer.invoke('google:get-last-backup'),
    getLastExport: () => ipcRenderer.invoke('google:get-last-export')
  },

  // ========== Updater ==========
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    download: (url: string) => ipcRenderer.invoke('updater:download', url)
  }
}

// Expose to renderer
contextBridge.exposeInMainWorld('api', api)

// Export type for renderer
export type ElectronAPI = typeof api
