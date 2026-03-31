import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from 'react-native-paper';

import { useAppStore } from '@/src/stores/appStore';
import { useSettingsStore } from '@/src/stores/settingsStore';

export function LockScreen() {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const theme = useTheme();

  const unlockWithPin = useAppStore((state) => state.unlockWithPin);
  const unlockWithBiometric = useAppStore((state) => state.unlockWithBiometric);
  const lockMethod = useSettingsStore((state) => state.settings?.lockMethod ?? 'none');
  const didPromptRef = useRef(false);

  useEffect(() => {
    if (lockMethod !== 'biometric') return;
    if (didPromptRef.current) return;
    didPromptRef.current = true;
    unlockWithBiometric().catch(() => undefined);
  }, [lockMethod, unlockWithBiometric]);

  const onUnlockPin = async () => {
    const ok = await unlockWithPin(pin);
    if (!ok) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= 3) {
        Alert.alert('Locked', 'Too many invalid attempts. Please try again.');
      } else {
        Alert.alert('Wrong PIN', `Attempt ${next} of 3`);
      }
      return;
    }
    setPin('');
    setAttempts(0);
  };

  return (
    <View
      className="absolute inset-0 z-50 items-center justify-center p-6"
      style={{ backgroundColor: theme.colors.backdrop }}
    >
      <View className="w-full max-w-sm rounded-2xl p-5" style={{ backgroundColor: theme.colors.surface }}>
        <Text className="text-xl font-bold" style={{ color: theme.colors.onSurface }}>
          Wallet Locked
        </Text>

        {(lockMethod === 'pin' || lockMethod === 'biometric') && (
          <View className="mt-4 gap-3">
            <TextInput
              value={pin}
              onChangeText={setPin}
              secureTextEntry
              keyboardType="number-pad"
              placeholder="Enter PIN"
              placeholderTextColor={theme.colors.onSurfaceVariant}
              className="rounded-xl px-4 py-3"
              style={{ backgroundColor: theme.colors.surfaceVariant, color: theme.colors.onSurface }}
            />
            <Pressable onPress={onUnlockPin} className="rounded-xl py-3" style={{ backgroundColor: theme.colors.success }}>
              <Text className="text-center font-semibold" style={{ color: theme.colors.onSuccess }}>
                Unlock with PIN
              </Text>
            </Pressable>
          </View>
        )}

        {lockMethod === 'biometric' && (
          <Pressable
            onPress={() => {
              unlockWithBiometric().catch(() => undefined);
            }}
            className="mt-3 rounded-xl py-3"
            style={{ backgroundColor: theme.colors.surfaceVariant }}
          >
            <Text className="text-center font-semibold" style={{ color: theme.colors.onSurface }}>
              Unlock with Biometric
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
