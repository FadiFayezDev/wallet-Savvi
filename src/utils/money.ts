export const clampMoney = (value: number) => Math.round(value * 100) / 100;

export const formatMoney = (
  value: number,
  locale: 'ar' | 'en',
  currencyCode: string,
  withSign = false,
) => {
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatted = formatter.format(Math.abs(value));
  if (!withSign) return `${value < 0 ? '-' : ''}${formatted}`;
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatted}`;
};
