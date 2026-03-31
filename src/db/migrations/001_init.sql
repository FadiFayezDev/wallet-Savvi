-- 1. Categories Table (No changes requested, kept as is)
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

-- 2. Goals Table (Added monthly_contribution and icon)
CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL CHECK (target_amount > 0),
  saved_amount REAL NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  monthly_contribution REAL, -- Added after saved_amount
  icon TEXT,                -- Added after monthly_contribution
  deadline TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cancelled_at TEXT
);

-- 3. Transactions Table (Updated kind check and added new fields)
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
  cancel_reason TEXT,      -- Added after is_deleted
  cancelled_at TEXT,      -- Added after cancel_reason
  balance_after REAL,     -- Added after cancelled_at
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 4. Goal Transactions Table (Kept as is)
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

-- 5. Monthly Reports Table (Added balances and work tracking fields)
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
  opening_balance REAL,              -- Added after total_goal_saving
  closing_balance REAL,              -- Added after opening_balance
  work_days_count INTEGER NOT NULL DEFAULT 0,      -- Added after closing_balance
  days_over_daily_limit INTEGER NOT NULL DEFAULT 0, -- Added after work_days_count
  generated_at TEXT NOT NULL,
  FOREIGN KEY (top_expense_category_id) REFERENCES categories(id),
  FOREIGN KEY (top_income_category_id) REFERENCES categories(id)
);

-- 6. App Settings Table (Added user details, balance, and daily limit)
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  currency_code TEXT NOT NULL DEFAULT 'EGP',
  locale TEXT NOT NULL DEFAULT 'en',
  lock_method TEXT NOT NULL DEFAULT 'none' CHECK (lock_method IN ('none', 'pin', 'biometric')),
  auto_lock_seconds INTEGER NOT NULL DEFAULT 30,
  spending_alert_enabled INTEGER NOT NULL DEFAULT 1,
  spending_alert_threshold_pct REAL NOT NULL DEFAULT 20,
  notify_bills_enabled INTEGER NOT NULL DEFAULT 1,
  notify_work_enabled INTEGER NOT NULL DEFAULT 1,
  theme_mode TEXT NOT NULL DEFAULT 'dark' CHECK (theme_mode IN ('light', 'dark', 'system')),
  theme_source TEXT NOT NULL DEFAULT 'material',
  active_theme_id INTEGER,
  active_palette_theme_id INTEGER,
  time_format TEXT NOT NULL DEFAULT '24h',
  name TEXT NOT NULL DEFAULT 'المستخدم', -- Added before updated_at
  balance REAL NOT NULL DEFAULT 0,      -- Added before updated_at
  daily_limit REAL,                    -- Added before updated_at
  updated_at TEXT NOT NULL
);

-- 7. New Tables

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

CREATE TABLE IF NOT EXISTS custom_themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS palette_themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  light_primary TEXT NOT NULL,
  light_on_primary TEXT NOT NULL,
  light_primary_container TEXT NOT NULL,
  light_on_primary_container TEXT NOT NULL,
  light_secondary TEXT NOT NULL,
  light_on_secondary TEXT NOT NULL,
  light_secondary_container TEXT NOT NULL,
  light_on_secondary_container TEXT NOT NULL,
  light_tertiary TEXT NOT NULL,
  light_on_tertiary TEXT NOT NULL,
  light_tertiary_container TEXT NOT NULL,
  light_on_tertiary_container TEXT NOT NULL,
  light_background TEXT NOT NULL,
  light_on_background TEXT NOT NULL,
  light_surface TEXT NOT NULL,
  light_on_surface TEXT NOT NULL,
  light_surface_variant TEXT NOT NULL,
  light_on_surface_variant TEXT NOT NULL,
  light_outline TEXT NOT NULL,
  light_outline_variant TEXT NOT NULL,
  light_error TEXT NOT NULL,
  light_on_error TEXT NOT NULL,
  light_error_container TEXT NOT NULL,
  light_on_error_container TEXT NOT NULL,
  light_success TEXT NOT NULL,
  light_on_success TEXT NOT NULL,
  light_success_container TEXT NOT NULL,
  light_on_success_container TEXT NOT NULL,
  light_warning TEXT NOT NULL,
  light_on_warning TEXT NOT NULL,
  light_warning_container TEXT NOT NULL,
  light_on_warning_container TEXT NOT NULL,
  light_info TEXT NOT NULL,
  light_on_info TEXT NOT NULL,
  light_info_container TEXT NOT NULL,
  light_on_info_container TEXT NOT NULL,
  light_header_gradient_start TEXT NOT NULL,
  light_header_gradient_mid TEXT NOT NULL,
  light_header_gradient_end TEXT NOT NULL,
  light_header_text TEXT NOT NULL,
  light_header_icon TEXT NOT NULL,
  light_icon_primary TEXT NOT NULL,
  light_icon_secondary TEXT NOT NULL,
  light_icon_muted TEXT NOT NULL,
  dark_primary TEXT NOT NULL,
  dark_on_primary TEXT NOT NULL,
  dark_primary_container TEXT NOT NULL,
  dark_on_primary_container TEXT NOT NULL,
  dark_secondary TEXT NOT NULL,
  dark_on_secondary TEXT NOT NULL,
  dark_secondary_container TEXT NOT NULL,
  dark_on_secondary_container TEXT NOT NULL,
  dark_tertiary TEXT NOT NULL,
  dark_on_tertiary TEXT NOT NULL,
  dark_tertiary_container TEXT NOT NULL,
  dark_on_tertiary_container TEXT NOT NULL,
  dark_background TEXT NOT NULL,
  dark_on_background TEXT NOT NULL,
  dark_surface TEXT NOT NULL,
  dark_on_surface TEXT NOT NULL,
  dark_surface_variant TEXT NOT NULL,
  dark_on_surface_variant TEXT NOT NULL,
  dark_outline TEXT NOT NULL,
  dark_outline_variant TEXT NOT NULL,
  dark_error TEXT NOT NULL,
  dark_on_error TEXT NOT NULL,
  dark_error_container TEXT NOT NULL,
  dark_on_error_container TEXT NOT NULL,
  dark_success TEXT NOT NULL,
  dark_on_success TEXT NOT NULL,
  dark_success_container TEXT NOT NULL,
  dark_on_success_container TEXT NOT NULL,
  dark_warning TEXT NOT NULL,
  dark_on_warning TEXT NOT NULL,
  dark_warning_container TEXT NOT NULL,
  dark_on_warning_container TEXT NOT NULL,
  dark_info TEXT NOT NULL,
  dark_on_info TEXT NOT NULL,
  dark_info_container TEXT NOT NULL,
  dark_on_info_container TEXT NOT NULL,
  dark_header_gradient_start TEXT NOT NULL,
  dark_header_gradient_mid TEXT NOT NULL,
  dark_header_gradient_end TEXT NOT NULL,
  dark_header_text TEXT NOT NULL,
  dark_header_icon TEXT NOT NULL,
  dark_icon_primary TEXT NOT NULL,
  dark_icon_secondary TEXT NOT NULL,
  dark_icon_muted TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_query ON transactions(occurred_at, kind, is_deleted, category_id);
CREATE INDEX IF NOT EXISTS idx_work_days_date ON work_days_log(work_date);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_spending_summary(summary_date);
