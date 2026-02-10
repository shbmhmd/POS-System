# Changelog

All notable changes to POS System will be documented in this file.

## [1.0.2] - 2026-02-11

### Added
- **Return / Refund** – New return dialog in POS (F5 shortcut) to look up sales by invoice, select items to return, and process refunds. Inventory is automatically restocked on return.
- **Code Obfuscation** – Source code is now obfuscated in production builds for intellectual property protection
- **Proprietary License** – Added proprietary LICENSE file

### Changed
- **Shift Opening** – No longer asks for manual cash amount. Opening cash is automatically calculated from the last closed shift's closing cash.
- **Shift Closing** – No longer asks for manual cash counting. Closing cash is automatically calculated from opening cash + cash sales − refunds.
- **Payment Dialog UI** – Payment method buttons and amount input are now properly stacked to prevent layout overflow

### Fixed
- Shift history showing 0 for revenue (was referencing non-existent `total_revenue` field instead of `total_sales`)
- Active shift card showing wrong sales count (was using revenue field as count)

## [1.0.1] - 2026-02-11

### Added
- **Check for Updates** – New "Updates" tab in Settings to check for new versions from GitHub
- **Google Drive Backup** – Full integration with Google Drive for database backups
- **Google Sheets Export** – Export sales data to Google Sheets with 3 tabs (Daily Sales, Products, Payments)
- **Changelog Dialog** – App now shows what's new after an update

### Fixed
- Dashboard showing 0 for sales count and revenue
- Stock quantities not displaying correctly on POS and Products pages
- Product delete not working (now uses soft-delete)
- Product search passing wrong argument format
- Inventory stock/history lookups using wrong parameter format
- Held sales using wrong field names (cart_data → cart_json, label → note)
- All 7 report endpoints fixed (object → positional args, field name mismatches)
- Purchase receive missing userId parameter
- Shift reports not reading payment_breakdown correctly
- Payment methods not accepting mobile/other types
- Sale completion errors
- User creation errors
- Product creation and listing pagination bugs
- Shift open bug
- SQLite binding errors on startup

### Changed
- Secrets moved to .env file for security (no longer hardcoded)
- App name set to "POS System" by author "Suhaib"
- Custom app icon added

## [1.0.0] - 2026-02-10

### Added
- Initial release of Desktop POS System
- Electron + React + TypeScript + SQLite architecture
- Point of Sale with barcode search, cart, hold/resume sales
- Product management with categories
- Inventory tracking with stock adjustments and transfers
- Purchase order management with suppliers
- Shift management with open/close and cash counting
- 7 report types: Daily Sales, By Product, By Category, Profit, Tax, Cashier, Dashboard
- User management with role-based permissions
- Multi-branch support
- Thermal printer support
- NSIS installer and portable ZIP builds
