import { Stack } from "expo-router";
import { View } from "react-native";
import { useTheme } from "react-native-paper";
import '../global.css'

export default function TransactionsLayout() {
  const theme = useTheme();

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: theme.colors.background // عشان الخلفية تبقى موحدة
    }}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* أسماء الملفات اللي عندك جوا المجلد */}
        <Stack.Screen name="add" />
        <Stack.Screen name="add-expense" />
        <Stack.Screen name="add-income" />
        <Stack.Screen name="[id]" />
      </Stack>
    </View>
  );
}
