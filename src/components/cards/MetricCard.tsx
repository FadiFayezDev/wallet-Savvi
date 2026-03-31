import { Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';

interface MetricCardProps {
  title: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
}

export function MetricCard({ title, value, tone = 'neutral' }: MetricCardProps) {
  const theme = useTheme();
  const toneColor = tone === 'positive'
    ? theme.colors.success
    : tone === 'negative'
      ? theme.colors.error
      : theme.colors.onSurface;

  return (
    <View
      className="min-w-[150px] flex-1 rounded-2xl p-4 shadow-sm"
      style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant, borderWidth: 1 }}
    >
      <Text className="text-xs" style={{ color: theme.colors.onSurfaceVariant }}>
        {title}
      </Text>
      <Text className="mt-2 text-lg font-bold" style={{ color: toneColor }}>
        {value}
      </Text>
    </View>
  );
}
