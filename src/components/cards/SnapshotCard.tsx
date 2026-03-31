import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';

type Tone = 'blue' | 'green' | 'orange' | 'purple';

interface SnapshotCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: Tone;
}

export function SnapshotCard({ title, value, subtitle, icon, tone }: SnapshotCardProps) {
  const theme = useTheme();

  // مابينج الألوان بناءً على الـ Tone والـ Material You Palette
  const getToneStyles = () => {
    switch (tone) {
      case 'green':
        return { 
          bubble: theme.colors.success, // لون حالة النجاح المالي
          onBubble: theme.colors.onSuccess,
          valueColor: theme.colors.success,
        };
      case 'blue':
        return { 
          bubble: theme.colors.info ?? theme.colors.primary, 
          onBubble: theme.colors.onInfo ?? theme.colors.onPrimary,
          valueColor: theme.colors.info ?? theme.colors.primary,
        };
      case 'orange':
        return { 
          bubble: theme.colors.warning, // لون التنبيه للمصروفات
          onBubble: theme.colors.onWarning,
          valueColor: theme.colors.error,
        };
      case 'purple':
        return { 
          bubble: theme.colors.tertiary, 
          onBubble: theme.colors.onTertiary,
          valueColor: theme.colors.tertiary,
        };
      default:
        return { 
          bubble: theme.colors.secondary, 
          onBubble: theme.colors.onSecondary,
          valueColor: theme.colors.onSurface,
        };
    }
  };

  const styles = getToneStyles();

  return (
    <View 
      style={{ 
        // استخدام elevation.level2 عشان يطابق الـ Header والـ Navigation
        backgroundColor: theme.colors.elevation.level2,
        borderRadius: 28, // زوايا M3 القياسية (أعرض وألطف)
        borderColor: theme.colors.outlineVariant,
        minHeight: 160
      }} 
      className="flex-1 border p-4 shadow-sm"
    >
      {/* Icon Bubble */}
      <View 
        style={{ backgroundColor: styles.bubble }} 
        className="h-12 w-12 items-center justify-center rounded-2xl elevation-2 shadow-md"
      >
        <Ionicons name={icon} size={24} color={styles.onBubble} />
      </View>

      {/* Title */}
      <Text 
        style={{ color: theme.colors.onSurfaceVariant }} 
        className="mt-4 text-[13px] font-bold uppercase tracking-tight"
      >
        {title}
      </Text>

      {/* Value */}
      <Text 
        style={{ color: styles.valueColor }} 
        className="mt-1 text-2xl font-black"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>

      {/* Subtitle */}
      <Text 
        style={{ color: theme.colors.onSurfaceVariant }} 
        className="mt-1 text-[11px] font-medium opacity-70 leading-4"
      >
        {subtitle}
      </Text>
    </View>
  );
}
