import dayjs from 'dayjs';

export const nowIso = () => new Date().toISOString();

export const toMonthKey = (value: string | Date) => dayjs(value).format('YYYY-MM');

export const monthStartIso = (monthKey?: string) => {
  const base = monthKey ? dayjs(`${monthKey}-01`) : dayjs();
  return base.startOf('month').toISOString();
};

export const monthEndIso = (monthKey?: string) => {
  const base = monthKey ? dayjs(`${monthKey}-01`) : dayjs();
  return base.endOf('month').toISOString();
};

export const startOfDayIso = (value: string | Date) => dayjs(value).startOf('day').toISOString();

export const endOfDayIso = (value: string | Date) => dayjs(value).endOf('day').toISOString();

export const lastNDays = (days: number) => {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    result.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'));
  }
  return result;
};

export const normalizeLocale = (locale: string | null | undefined): 'ar' | 'en' => {
  if (!locale) return 'ar';
  return locale.toLowerCase().startsWith('ar') ? 'ar' : 'en';
};
