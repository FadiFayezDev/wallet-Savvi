import { Surface, Text, useTheme } from 'react-native-paper';

interface EmptyStateProps {
  title: string;
}

export function EmptyState({ title }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <Surface
      elevation={0}
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: theme.colors.outlineVariant,
        backgroundColor: theme.colors.surfaceVariant,
        padding: 24,
      }}
    >
      <Text variant="bodyMedium" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant }}>
        {title}
      </Text>
    </Surface>
  );
}
