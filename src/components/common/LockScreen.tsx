import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { useAppStore } from '@/src/stores/appStore';
import { useSettingsStore } from '@/src/stores/settingsStore';

export function LockScreen() {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);

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
    <View className="absolute inset-0 z-50 items-center justify-center bg-slate-950/95 p-6">
      <View className="w-full max-w-sm rounded-2xl bg-slate-900 p-5">
        <Text className="text-xl font-bold text-white">Savvi Locked</Text>

        {(lockMethod === 'pin' || lockMethod === 'biometric') && (
          <View className="mt-4 gap-3">
            <TextInput
              value={pin}
              onChangeText={setPin}
              secureTextEntry
              keyboardType="number-pad"
              placeholder="Enter PIN"
              placeholderTextColor="#64748b"
              className="rounded-xl bg-slate-800 px-4 py-3 text-white"
            />
            <Pressable onPress={onUnlockPin} className="rounded-xl bg-emerald-500 py-3">
              <Text className="text-center font-semibold text-white">Unlock with PIN</Text>
            </Pressable>
          </View>
        )}

        {lockMethod === 'biometric' && (
          <Pressable
            onPress={() => {
              unlockWithBiometric().catch(() => undefined);
            }}
            className="mt-3 rounded-xl bg-slate-700 py-3">
            <Text className="text-center font-semibold text-white">Unlock with Biometric</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
