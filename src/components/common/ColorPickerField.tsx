/**
 * ColorPickerField
 * ─────────────────────────────────────────────────────────────────
 * Row component: label + color preview swatch + HEX input + "Pick" button.
 * Tapping the swatch or Pick button opens a full ColorWheelPicker modal.
 */

import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';

import { ColorWheelPicker } from '@/src/components/common/ColorWheelPicker';
import { normalizeHex, withAlpha } from '@/src/utils/colors';

interface ColorPickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ColorPickerField({
  label,
  value,
  onChange,
  placeholder = '#FFFFFF',
  disabled = false,
}: ColorPickerFieldProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  // tempColor mirrors live picker state so we can "cancel" without committing
  const [tempColor, setTempColor] = useState(value);

  const preview = useMemo(() => normalizeHex(value) ?? '#888888', [value]);

  const openPicker = () => {
    if (disabled) return;
    setTempColor(normalizeHex(value) ?? '#FF0000');
    setIsOpen(true);
  };

  const confirmPicker = () => {
    const normalized = normalizeHex(tempColor);
    if (normalized) onChange(normalized);
    setIsOpen(false);
  };

  const cancelPicker = () => {
    setIsOpen(false);
  };

  return (
    <>
      <View style={styles.row}>
        <View style={styles.labelWrap}>
          <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {label}
          </Text>
        </View>

        {/* Color preview swatch — tap to open picker */}
        <Pressable
          onPress={openPicker}
          style={[
            styles.preview,
            { backgroundColor: preview, borderColor: theme.colors.outlineVariant },
          ]}
        />

        {/* HEX text input — direct editing */}
        <TextInput
          value={value}
          onChangeText={onChange}
          autoCapitalize="characters"
          maxLength={7}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          editable={!disabled}
          style={[
            styles.input,
            {
              color: theme.colors.onSurface,
              backgroundColor: theme.colors.surfaceVariant,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        />

        {/* Pick button */}
        <Pressable
          onPress={openPicker}
          disabled={disabled}
          style={[
            styles.pickBtn,
            {
              backgroundColor: withAlpha(theme.colors.primary, 0.12),
              opacity: disabled ? 0.4 : 1,
            },
          ]}
        >
          <IconButton
            icon="palette-outline"
            iconColor={theme.colors.primary}
            size={16}
            style={styles.noMargin}
          />
          <Text style={[styles.pickText, { color: theme.colors.primary }]}>Pick</Text>
        </Pressable>
      </View>

      {/* ── Color Picker Modal ── */}
      <Modal
        visible={isOpen}
        animationType="slide"
        transparent
        onRequestClose={cancelPicker}
      >
        <View
          style={[
            styles.modalBackdrop,
            {
              backgroundColor: withAlpha(
                theme.colors.scrim ?? theme.colors.onBackground,
                0.55,
              ),
            },
          ]}
        >
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.headerSwatch, { backgroundColor: normalizeHex(tempColor) ?? '#FF0000' }]} />
              <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
                {label}
              </Text>
              <Pressable onPress={cancelPicker} hitSlop={8}>
                <IconButton
                  icon="close"
                  iconColor={theme.colors.onSurfaceVariant}
                  size={20}
                  style={styles.noMargin}
                />
              </Pressable>
            </View>

            {/* Color wheel (live update to tempColor only) */}
            <ColorWheelPicker
              color={tempColor}
              onChange={(hex) => setTempColor(hex)}
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <Pressable
                onPress={cancelPicker}
                style={[styles.cancelBtn, { backgroundColor: theme.colors.surfaceVariant }]}
              >
                <Text style={[styles.cancelText, { color: theme.colors.onSurfaceVariant }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={confirmPicker}
                style={[styles.confirmBtn, { backgroundColor: theme.colors.primary }]}
              >
                <Text style={[styles.confirmText, { color: theme.colors.onPrimary }]}>
                  Select
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  labelWrap: { minWidth: 120, flex: 1 },
  label: { fontSize: 12, fontWeight: '700' },
  preview: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
  },
  input: {
    width: 100,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pickText: { fontSize: 12, fontWeight: '700' },
  noMargin: { margin: 0 },

  // Modal
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
  },
  modalCard: {
    borderRadius: 28,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerSwatch: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00000015',
  },
  modalTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: 10 },
  confirmBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmText: { fontSize: 14, fontWeight: '700' },
  cancelBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '700' },
});
