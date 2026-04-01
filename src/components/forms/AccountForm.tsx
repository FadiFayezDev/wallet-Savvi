import { useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "react-native-paper";

import type { AccountGroupKey } from "@/src/types/domain";
import { ACCOUNT_GROUPS, ACCOUNT_GROUP_MAP } from "@/src/constants/accountGroups";
import { ComboSelect } from "@/src/components/forms/ComboSelect";

interface AccountFormProps {
  initial?: {
    name: string;
    groupKey: AccountGroupKey;
    balance: number;
    description: string | null;
  };
  submitLabel: string;
  requireAmount?: boolean;
  onSubmit: (input: {
    name: string;
    groupKey: AccountGroupKey;
    balance: number;
    description: string | null;
  }) => Promise<void>;
}

export function AccountForm({ initial, submitLabel, requireAmount = true, onSubmit }: AccountFormProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const locale = i18n.language.startsWith("ar") ? "ar" : "en";

  const [groupKey, setGroupKey] = useState<AccountGroupKey>(initial?.groupKey ?? "cash");
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(
    initial ? String(Math.abs(initial.balance ?? 0)) : "",
  );
  const [description, setDescription] = useState(initial?.description ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const groupMeta = ACCOUNT_GROUP_MAP.get(groupKey);
  const isLiability = groupMeta?.type === "liability";

  const parsedAmount = useMemo(() => Number(amount), [amount]);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert(locale === "ar" ? "أدخل الاسم" : "Please enter a name");
      return;
    }
    if (requireAmount && (amount.trim() === "" || !Number.isFinite(parsedAmount) || parsedAmount < 0)) {
      Alert.alert(locale === "ar" ? "أدخل المبلغ" : "Please enter a valid amount");
      return;
    }
    const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
    const balance = isLiability ? -Math.abs(safeAmount) : Math.abs(safeAmount);

    setIsSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        groupKey,
        balance,
        description: description.trim() ? description.trim() : null,
      });
      setName("");
      setAmount("");
      setDescription("");
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : t("errors.generic"));
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = {
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceVariant,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: theme.colors.onSurface,
  } as const;


  return (
    <View style={{ gap: 16, borderRadius: 16, backgroundColor: theme.colors.background, padding: 16 }}>
      {/* Group */}
      <ComboSelect
        label={t("tools.group")}
        placeholder={t("tools.selectGroup")}
        value={groupKey}
        options={ACCOUNT_GROUPS.map((group) => ({
          value: group.key,
          label: locale === "ar" ? group.labelAr : group.labelEn,
        }))}
        onChange={(value) => setGroupKey(value)}
      />

      {/* Name */}
      <View>
        <Text style={{ marginBottom: 6, fontSize: 13, color: theme.colors.onSurfaceVariant }}>
          {t("tools.name")}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t("tools.name")}
          style={inputStyle}
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />
      </View>

      {/* Amount */}
      <View>
        <Text style={{ marginBottom: 6, fontSize: 13, color: theme.colors.onSurfaceVariant }}>
          {t("tools.amount")}
        </Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0"
          keyboardType="decimal-pad"
          style={inputStyle}
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />
        {isLiability ? (
          <Text style={{ marginTop: 6, fontSize: 11, color: theme.colors.error }}>
            {locale === "ar" ? "سيتم حفظ الرصيد كالتزام (قيمة سالبة)." : "Saved as a liability (negative balance)."}
          </Text>
        ) : null}
      </View>

      {/* Description */}
      <View>
        <Text style={{ marginBottom: 6, fontSize: 13, color: theme.colors.onSurfaceVariant }}>
          {t("tools.description")}
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder={t("tools.notes")}
          style={inputStyle}
          placeholderTextColor={theme.colors.onSurfaceVariant}
        />
      </View>

      {/* Submit */}
      <Pressable
        onPress={submit}
        disabled={isSaving}
        style={{
          borderRadius: 12,
          paddingVertical: 12,
          backgroundColor: theme.colors.primary,
          opacity: isSaving ? 0.6 : 1,
        }}
      >
        <Text style={{ textAlign: "center", fontWeight: "bold", color: theme.colors.onPrimary }}>
          {submitLabel}
        </Text>
      </Pressable>

    </View>
  );
}
