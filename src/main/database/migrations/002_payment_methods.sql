-- Add 'mobile' and 'other' payment methods
-- SQLite doesn't support ALTER TABLE to modify CHECK constraints,
-- so we recreate the payments table

CREATE TABLE IF NOT EXISTS payments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash', 'card', 'qr', 'bank', 'mobile', 'other')),
  amount REAL NOT NULL,
  reference TEXT,
  received_amount REAL,
  change_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

INSERT INTO payments_new SELECT * FROM payments;
DROP TABLE payments;
ALTER TABLE payments_new RENAME TO payments;

CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
