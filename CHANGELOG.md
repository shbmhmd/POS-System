# Changelog

All notable changes to POS System will be documented in this file.

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
