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

INSERT INTO app_settings (id, currency_code, locale, lock_method, auto_lock_seconds, spending_alert_enabled, spending_alert_threshold_pct, theme_mode, updated_at)
SELECT 1, 'EGP', 'ar', 'none', 30, 1, 20, 'dark', datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE id = 1);
