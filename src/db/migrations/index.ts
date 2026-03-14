export interface Migration {
  version: number;
  name: string;
  sql: string;
}

const migration001 = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'both')),
  icon TEXT,
  color TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL CHECK (target_amount > 0),
  saved_amount REAL NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  monthly_contribution REAL,
  icon TEXT,
  deadline TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cancelled_at TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('income', 'expense', 'goal_transfer', 'goal_refund', 'bill_payment', 'work_expense')),
  signed_amount REAL NOT NULL,
  amount_abs REAL NOT NULL CHECK (amount_abs > 0),
  category_id INTEGER,
  note TEXT,
  occurred_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  is_deleted INTEGER NOT NULL DEFAULT 0,
  cancel_reason TEXT,
  cancelled_at TEXT,
  balance_after REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS goal_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,
  transaction_id INTEGER NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK (action IN ('transfer', 'refund')),
  amount REAL NOT NULL CHECK (amount > 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (goal_id) REFERENCES goals(id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE TABLE IF NOT EXISTS monthly_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month_key TEXT NOT NULL UNIQUE,
  total_income REAL NOT NULL,
  total_expense REAL NOT NULL,
  net_result REAL NOT NULL,
  top_expense_category_id INTEGER,
  top_income_category_id INTEGER,
  highest_spend_day TEXT,
  total_goal_saving REAL NOT NULL,
  opening_balance REAL,
  closing_balance REAL,
  work_days_count INTEGER NOT NULL DEFAULT 0,
  days_over_daily_limit INTEGER NOT NULL DEFAULT 0,
  generated_at TEXT NOT NULL,
  FOREIGN KEY (top_expense_category_id) REFERENCES categories(id),
  FOREIGN KEY (top_income_category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  currency_code TEXT NOT NULL DEFAULT 'EGP',
  locale TEXT NOT NULL DEFAULT 'ar',
  lock_method TEXT NOT NULL DEFAULT 'none' CHECK (lock_method IN ('none', 'pin', 'biometric')),
  auto_lock_seconds INTEGER NOT NULL DEFAULT 30,
  spending_alert_enabled INTEGER NOT NULL DEFAULT 1,
  spending_alert_threshold_pct REAL NOT NULL DEFAULT 20,
  theme_mode TEXT NOT NULL DEFAULT 'dark' CHECK (theme_mode IN ('light', 'dark', 'system')),
  name TEXT NOT NULL DEFAULT 'المستخدم',
  balance REAL NOT NULL DEFAULT 0,
  daily_limit REAL,
  updated_at TEXT NOT NULL
);

-- New Tables added in Migration 001 for fresh installs
CREATE TABLE IF NOT EXISTS report_category_breakdown (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  percentage REAL NOT NULL,
  FOREIGN KEY (report_id) REFERENCES monthly_reports(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS recurring_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  category_id INTEGER,
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS bill_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER NOT NULL,
  transaction_id INTEGER UNIQUE,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'skipped')),
  paid_at TEXT,
  FOREIGN KEY (bill_id) REFERENCES recurring_bills(id),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id)
);

CREATE TABLE IF NOT EXISTS work_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_work_day INTEGER NOT NULL DEFAULT 1,
  start_time TEXT,
  end_time TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_work_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  default_amount REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS work_days_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  work_date TEXT NOT NULL UNIQUE,
  shift_start TEXT,
  shift_end TEXT,
  total_work_expenses REAL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_spending_summary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  summary_date TEXT NOT NULL UNIQUE,
  total_spent REAL NOT NULL DEFAULT 0,
  is_over_limit INTEGER DEFAULT 0,
  remaining_from_limit REAL
);
`;

const migration002 = `
-- Optimized indexes based on requested fields
CREATE INDEX IF NOT EXISTS idx_transactions_query ON transactions(occurred_at, kind, is_deleted, category_id);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goal_transactions_goal ON goal_transactions(goal_id);
CREATE INDEX IF NOT EXISTS idx_monthly_reports_key ON monthly_reports(month_key);
CREATE INDEX IF NOT EXISTS idx_work_days_date ON work_days_log(work_date);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_spending_summary(summary_date);
`;

const migration003 = `
-- Seed Categories
INSERT INTO categories (name_ar, name_en, type, icon, color, is_default, created_at, updated_at)
SELECT 'طعام', 'Food', 'expense', 'restaurant', '#F97316', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Food');

INSERT INTO categories (name_ar, name_en, type, icon, color, is_default, created_at, updated_at)
SELECT 'مواصلات', 'Transport', 'expense', 'directions-car', '#3B82F6', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Transport');

INSERT INTO categories (name_ar, name_en, type, icon, color, is_default, created_at, updated_at)
SELECT 'إيجار', 'Rent', 'expense', 'home', '#EF4444', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Rent');

INSERT INTO categories (name_ar, name_en, type, icon, color, is_default, created_at, updated_at)
SELECT 'فواتير', 'Bills', 'expense', 'receipt', '#A855F7', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Bills');

INSERT INTO categories (name_ar, name_en, type, icon, color, is_default, created_at, updated_at)
SELECT 'ترفيه', 'Entertainment', 'expense', 'movie', '#14B8A6', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Entertainment');

INSERT INTO categories (name_ar, name_en, type, icon, color, is_default, created_at, updated_at)
SELECT 'استثمار', 'Investment', 'income', 'trending-up', '#10B981', 1, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name_en = 'Investment');

-- Seed App Settings with new fields (name, balance)
INSERT INTO app_settings (id, currency_code, locale, lock_method, auto_lock_seconds, spending_alert_enabled, spending_alert_threshold_pct, theme_mode, name, balance, updated_at)
SELECT 1, 'EGP', 'ar', 'none', 30, 1, 20, 'dark', 'المستخدم', 0, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 1);
`;

const migration004 = `
ALTER TABLE app_settings ADD COLUMN theme_source TEXT NOT NULL DEFAULT 'material';
ALTER TABLE app_settings ADD COLUMN time_format TEXT NOT NULL DEFAULT '24h';
`;

export const migrations: Migration[] = [
  { version: 1, name: '001_init', sql: migration001 },
  { version: 2, name: '002_indexes', sql: migration002 },
  { version: 3, name: '003_seed_categories', sql: migration003 },
  { version: 4, name: '004_app_settings_time_theme', sql: migration004 },
];
