import { Text, View } from 'react-native';

interface MetricCardProps {
  title: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
}

const toneMap: Record<NonNullable<MetricCardProps['tone']>, string> = {
  neutral: 'text-slate-100',
  positive: 'text-emerald-400',
  negative: 'text-rose-400',
};

export function MetricCard({ title, value, tone = 'neutral' }: MetricCardProps) {
  return (
    <View className="min-w-[150px] flex-1 rounded-2xl bg-slate-900/90 p-4 shadow-sm shadow-black">
      <Text className="text-xs text-slate-400">{title}</Text>
      <Text className={`mt-2 text-lg font-bold ${toneMap[tone]}`}>{value}</Text>
    </View>
  );
}
