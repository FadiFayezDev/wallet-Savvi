import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import type { DayComparisonPoint } from '@/src/types/domain';

interface FourteenDayChartProps {
  data: DayComparisonPoint[];
  locale?: 'ar' | 'en';
}

export function FourteenDayChart({ data, locale = 'en' }: FourteenDayChartProps) {
  const theme = useTheme();

  // 1. توليد الـ 14 يوم الحقيقيين بناءً على تاريخ اللحظة الحالية
  const last14Days = useMemo(() => {
    const days = [];
    // بنستخدم تاريخ اللحظة الحالية (النهاردة)
    const today = new Date();

    for (let i = 13; i >= 0; i--) {
      const date = new Date(today);
      // بنطرح i من الأيام عشان نرجع لورا لحد 13 يوم فاتوا
      date.setDate(today.getDate() - i);
      
      // تنسيق التاريخ ليكون YYYY-MM-DD عشان يطابق اللي في الداتا بيز
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const formattedKey = `${y}-${m}-${d}`;

      // البحث عن اليوم في الداتا اللي جاية فعلياً من الـ Store
      const dbDay = data.find((item: DayComparisonPoint) => item.dayKey === formattedKey);

      days.push({
        dayKey: formattedKey,
        dayLabel: String(date.getDate()), // رقم اليوم الحقيقي في الشهر
        income: dbDay?.income ?? 0,
        expense: dbDay?.expense ?? 0,
      });
    }
    return days;
  }, [data]);

  const maxValue = useMemo(() => {
    const max = last14Days.reduce((acc: number, item: any) => 
      Math.max(acc, item.income, item.expense), 0
    );
    return max === 0 ? 1 : max;
  }, [last14Days]);

  return (
    <View 
      style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 28 }} 
      className="px-3 py-5"
    >
      <View className="mb-6 flex-row items-center justify-between px-1">
        <Text style={{ color: theme.colors.onSurfaceVariant }} className="text-base font-black italic">
          {locale === 'ar' ? 'تحليل الـ ١٤ يوم' : '14-Day Analysis'}
        </Text>
        
        <View className="flex-row items-center gap-3">
          <Legend label={locale === 'ar' ? 'دخل' : 'In'} color={theme.colors.primary} />
          <Legend label={locale === 'ar' ? 'صرف' : 'Out'} color={theme.colors.error} />
        </View>
      </View>

      <View 
        style={{ borderBottomColor: theme.colors.outlineVariant }} 
        className="h-[160px] flex-row items-end justify-between border-b pb-1"
      >
        {last14Days.map((item, index) => {
          const incomeHeight = (item.income / maxValue) * 130;
          const expenseHeight = (item.expense / maxValue) ? (item.expense / maxValue) * 130 : 0;

          // تمييز اليوم الأخير (النهاردة)
          const isToday = index === 13;

          return (
            <View key={item.dayKey} className="flex-1 items-center">
              <View className="h-[130px] w-full flex-row items-end justify-center gap-[1px]">
                {/* Income Bar */}
                <View 
                  style={{ 
                    height: Math.max(incomeHeight, item.income > 0 ? 4 : 0), 
                    backgroundColor: theme.colors.primary,
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                    width: 5,
                    opacity: isToday ? 1 : 0.8
                  }} 
                />
                {/* Expense Bar */}
                <View 
                  style={{ 
                    height: Math.max(expenseHeight, item.expense > 0 ? 4 : 0), 
                    backgroundColor: theme.colors.error,
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                    width: 5,
                    opacity: isToday ? 1 : 0.8
                  }} 
                />
              </View>
              
              <Text 
                style={{ 
                  color: isToday ? theme.colors.primary : theme.colors.onSurfaceVariant, 
                  fontSize: 9,
                  fontWeight: isToday ? '900' : '600',
                  opacity: isToday ? 1 : 0.5
                }} 
                className="mt-2"
              >
                {item.dayLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Legend({ label, color }: { label: string; color: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <View style={{ backgroundColor: color }} className="h-1.5 w-1.5 rounded-full" />
      <Text style={{ color: color, fontSize: 9, fontWeight: '900' }}>{label}</Text>
    </View>
  );
} 