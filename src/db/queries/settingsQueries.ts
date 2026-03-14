import { runQuery, getFirst } from '../client';
import { AppSettings } from '@/src/types/domain';

export const settingsQueries = {
  get: () => {
    return getFirst<any>(`SELECT * FROM app_settings WHERE id = 1`);
  },

  update: (s: Partial<AppSettings>) => {
    const sql = `
      UPDATE app_settings SET 
        name = COALESCE(?, name),
        balance = COALESCE(?, balance),
        daily_limit = COALESCE(?, daily_limit),
        currency_code = COALESCE(?, currency_code),
        locale = COALESCE(?, locale),
        theme_mode = COALESCE(?, theme_mode),
        theme_source = COALESCE(?, theme_source),
        time_format = COALESCE(?, time_format),
        updated_at = ?
      WHERE id = 1;
    `;
    return runQuery(sql, [
      s.name,
      s.balance,
      s.dailyLimit,
      s.currencyCode,
      s.locale,
      s.themeMode,
      s.themeSource,
      s.timeFormat,
      new Date().toISOString(),
    ]);
  }
};
