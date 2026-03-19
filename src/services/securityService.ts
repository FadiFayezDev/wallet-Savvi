import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const PIN_KEY = 'wallet_pin_hash_v1';

interface PinPayload {
  salt: string;
  hash: string;
}

const hashPin = async (pin: string, salt: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

const makeSalt = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const securityService = {
  async canUseBiometric() {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  },

  async authenticateBiometric() {
    const available = await securityService.canUseBiometric();
    if (!available) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Wallet',
      fallbackLabel: 'Use PIN',
      disableDeviceFallback: false,
    });
    return result.success;
  },

  async setPin(pin: string) {
    if (!/^\d{4,8}$/.test(pin)) {
      throw new Error('PIN must be 4 to 8 digits');
    }
    const salt = makeSalt();
    const hash = await hashPin(pin, salt);
    const payload: PinPayload = { salt, hash };
    await SecureStore.setItemAsync(PIN_KEY, JSON.stringify(payload));
  },

  async hasPin() {
    const payload = await SecureStore.getItemAsync(PIN_KEY);
    return Boolean(payload);
  },

  async verifyPin(pin: string) {
    const raw = await SecureStore.getItemAsync(PIN_KEY);
    if (!raw) return false;
    const payload = JSON.parse(raw) as PinPayload;
    const hash = await hashPin(pin, payload.salt);
    return hash === payload.hash;
  },

  async clearPin() {
    await SecureStore.deleteItemAsync(PIN_KEY);
  },
};
