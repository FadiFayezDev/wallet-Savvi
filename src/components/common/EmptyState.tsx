import { Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';

interface EmptyStateProps {
  title: string;
}

export function EmptyState({ title }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={{
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: theme.colors.outlineVariant,
      backgroundColor: theme.colors.surfaceVariant,
      padding: 24,
    }}>
      <Text style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>{title}</Text>
    </View>
  );
}
