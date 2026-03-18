import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "react-native-paper";

import { CalculatorField } from "@/src/components/common/CalculatorField";
import { categoryService } from "@/src/services/categoryService";
import { recurringBillService } from "@/src/services/recurringBillService";
import { useSettingsStore } from "@/src/stores/settingsStore";
import type { Category } from "@/src/types/domain";
import { toMonthKey } from "@/src/utils/date";
import { formatMoney } from "@/src/utils/money";
import { confirmAction } from "@/src/utils/confirm";

export default function BillsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const settings = useSettingsStore((state) => state.settings);

  const [bills, setBills] = useState<any[]>([]);
  const [pendingBills, setPendingBills] = useState<any[]>([]);
  const [billInstances, setBillInstances] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(true);

  const locale = settings?.locale ?? "ar";
  const currency = settings?.currencyCode ?? "EGP";
  const monthKey = toMonthKey(new Date());

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [categoryRows, allBills, pending, instances] = await Promise.all([
        categoryService.listCategories("expense"),
        recurringBillService.getAllBills(true),
        recurringBillService.getPendingBills(monthKey),
        recurringBillService.listBillInstancesForMonth(monthKey),
      ]);
      setCategories(categoryRows);
      setBills(allBills);
      setPendingBills(pending);
      setBillInstances(instances);
    } catch {
      setBills([]);
      setPendingBills([]);
      setBillInstances([]);
    } finally {
      setLoading(false);
    }
  }, [monthKey]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  const resetForm = () => {
    setName("");
    setAmount("");
    setDueDay("");
    setCategoryId(null);
    setEditingId(null);
    setIsActive(true);
  };

  const submit = async () => {
    const parsedAmount = Number(amount);
    const parsedDay = Number(dueDay);
    if (
      !name.trim() ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0 ||
      !Number.isFinite(parsedDay) ||
      parsedDay < 1 ||
      parsedDay > 31
    ) {
      Alert.alert(locale === "ar" ? "بيانات غير صحيحة" : "Invalid data");
      return;
    }

    try {
      if (editingId) {
        await recurringBillService.updateBill({
          id: editingId,
          name: name.trim(),
          amount: parsedAmount,
          dueDay: parsedDay,
          categoryId,
          isActive,
        });
      } else {
        await recurringBillService.createBill({
          name: name.trim(),
          amount: parsedAmount,
          dueDay: parsedDay,
          categoryId,
          isActive,
        });
      }
      resetForm();
      await load();
    } catch (error) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed");
    }
  };

  const openEdit = (bill: any) => {
    setEditingId(bill.id);
    setName(bill.name);
    setAmount(String(bill.amount));
    setDueDay(String(bill.due_day));
    setCategoryId(bill.category_id ?? null);
    setIsActive(Boolean(bill.is_active));
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: 16, paddingTop: 16 }}
    >
      <View className="flex-row items-center justify-between mb-4">
        <Text style={{ color: theme.colors.onBackground }} className="text-2xl font-black">
          {locale === "ar" ? "الفواتير الدورية" : "Recurring Bills"}
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>
            {locale === "ar" ? "رجوع" : "Back"}
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.colors.outlineVariant,
          backgroundColor: theme.colors.surface,
          padding: 16,
        }}
      >
        <Text style={{ color: theme.colors.onSurface }} className="text-base font-black">
          {editingId ? (locale === "ar" ? "تعديل فاتورة" : "Edit Bill") : (locale === "ar" ? "إضافة فاتورة" : "Add Bill")}
        </Text>
        <Text style={{ marginTop: 6, color: theme.colors.onSurfaceVariant }}>
          {locale === "ar"
            ? "يتم تكرار الفاتورة تلقائياً كل شهر في يوم الاستحقاق. يمكنك إيقافها في أي وقت."
            : "The bill repeats every month on the due day. You can pause it any time."}
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={locale === "ar" ? "اسم الفاتورة" : "Bill name"}
          placeholderTextColor={theme.colors.onSurfaceVariant}
          style={{
            marginTop: 12,
            borderRadius: 12,
            backgroundColor: theme.colors.surfaceVariant,
            paddingHorizontal: 16,
            paddingVertical: 12,
            color: theme.colors.onSurface,
          }}
        />
        <View style={{ marginTop: 8 }}>
          <CalculatorField
            label={locale === "ar" ? "المبلغ" : "Amount"}
            hint={locale === "ar" ? "مطلوب. يمكنك استخدام الحاسبة." : "Required. Use calculator if needed."}
            value={amount}
            onChange={setAmount}
            required
            locale={locale}
          />
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, fontWeight: "700" }}>
            {locale === "ar" ? "يوم الاستحقاق (يتكرر شهرياً)" : "Due day (repeats monthly)"}
          </Text>
          <TextInput
            value={dueDay}
            onChangeText={setDueDay}
            keyboardType="number-pad"
            placeholder={locale === "ar" ? "مثال: 1 أو 15 أو 28" : "Example: 1 or 15 or 28"}
            placeholderTextColor={theme.colors.onSurfaceVariant}
            style={{
              marginTop: 6,
              borderRadius: 12,
              backgroundColor: theme.colors.surfaceVariant,
              paddingHorizontal: 16,
              paddingVertical: 12,
              color: theme.colors.onSurface,
            }}
          />
        </View>

        <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
          {locale === "ar" ? "اختر الفئة (اختياري)" : "Pick category (optional)"}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <Pressable
            onPress={() => router.push({ pathname: "/(tabs)/categories", params: { tab: "expense" } })}
            style={{
              borderRadius: 100,
              paddingHorizontal: 12,
              paddingVertical: 8,
              backgroundColor: theme.colors.surfaceVariant,
            }}
          >
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              {locale === "ar" ? "+ إضافة فئة" : "+ Add category"}
            </Text>
          </Pressable>
          {categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(category.id)}
              style={{
                borderRadius: 100,
                paddingHorizontal: 12,
                paddingVertical: 8,
                backgroundColor: categoryId === category.id ? theme.colors.primary : theme.colors.surfaceVariant,
              }}
            >
              <Text style={{ color: categoryId === category.id ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}>
                {locale === "ar" ? category.nameAr : category.nameEn}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <Pressable
            onPress={() => setIsActive((prev) => !prev)}
            style={{
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              backgroundColor: isActive ? theme.colors.secondaryContainer : theme.colors.surfaceVariant,
            }}
          >
            <Text style={{ color: isActive ? theme.colors.onSecondaryContainer : theme.colors.onSurfaceVariant }}>
              {isActive ? (locale === "ar" ? "نشطة" : "Active") : (locale === "ar" ? "غير نشطة" : "Inactive")}
            </Text>
          </Pressable>
          <Pressable
            onPress={submit}
            style={{
              flex: 1,
              borderRadius: 12,
              paddingVertical: 10,
              backgroundColor: theme.colors.primary,
            }}
          >
            <Text style={{ textAlign: "center", fontWeight: "700", color: theme.colors.onPrimary }}>
              {editingId ? (locale === "ar" ? "حفظ التعديل" : "Save") : (locale === "ar" ? "إضافة" : "Create")}
            </Text>
          </Pressable>
          {editingId ? (
            <Pressable
              onPress={resetForm}
              style={{
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                backgroundColor: theme.colors.surfaceVariant,
              }}
            >
              <Text style={{ color: theme.colors.onSurfaceVariant }}>
                {locale === "ar" ? "إلغاء" : "Cancel"}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Pending bills */}
      <View style={{ marginTop: 20 }}>
        <Text style={{ color: theme.colors.onSurface }} className="text-lg font-black">
          {locale === "ar" ? `فواتير ${monthKey}` : `Pending ${monthKey}`}
        </Text>
        {loading ? (
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{locale === "ar" ? "تحميل..." : "Loading..."}</Text>
        ) : pendingBills.length === 0 ? (
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{locale === "ar" ? "لا توجد فواتير معلقة" : "No pending bills"}</Text>
        ) : (
          <View style={{ marginTop: 8, gap: 8 }}>
            {pendingBills.map((bill) => {
              const dueDate = recurringBillService.getDueDateForMonth(monthKey, bill.due_day);
              return (
                <View
                  key={bill.id}
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.colors.outlineVariant,
                    backgroundColor: theme.colors.surface,
                    padding: 12,
                  }}
                >
                  <Text style={{ color: theme.colors.onSurface }} className="font-bold">
                    {bill.name}
                  </Text>
                  <Text style={{ color: theme.colors.onSurfaceVariant }} className="text-[11px]">
                    {formatMoney(bill.amount, locale, currency)} • {dueDate}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <Pressable
                      onPress={async () => {
                        await recurringBillService.applyBill(bill.id, dueDate);
                        await load();
                      }}
                      style={{
                        flex: 1,
                        borderRadius: 10,
                        paddingVertical: 8,
                        backgroundColor: theme.colors.primary,
                      }}
                    >
                      <Text style={{ textAlign: "center", color: theme.colors.onPrimary }}>
                        {locale === "ar" ? "دفع" : "Pay"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        const ok = await confirmAction({
                          title: locale === "ar" ? "تخطي الفاتورة؟" : "Skip bill?",
                          message: locale === "ar"
                            ? "سيتم تسجيل الفاتورة كمُتجاوزة ولن يتم خصمها."
                            : "The bill will be marked as skipped and not charged.",
                          confirmText: locale === "ar" ? "تخطي" : "Skip",
                          cancelText: locale === "ar" ? "إلغاء" : "Cancel",
                          destructive: true,
                        });
                        if (!ok) return;
                        await recurringBillService.skipBill(bill.id, dueDate);
                        await load();
                      }}
                      style={{
                        flex: 1,
                        borderRadius: 10,
                        paddingVertical: 8,
                        backgroundColor: theme.colors.surfaceVariant,
                      }}
                    >
                      <Text style={{ textAlign: "center", color: theme.colors.onSurfaceVariant }}>
                        {locale === "ar" ? "تخطي" : "Skip"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Bill instances */}
      <View style={{ marginTop: 20 }}>
        <Text style={{ color: theme.colors.onSurface }} className="text-lg font-black">
          {locale === "ar" ? "سجل الفواتير" : "Bill History"}
        </Text>
        {billInstances.length === 0 ? (
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{locale === "ar" ? "لا يوجد سجل بعد" : "No history yet"}</Text>
        ) : (
          <View style={{ marginTop: 8, gap: 8 }}>
            {billInstances.map((row) => (
              <View
                key={row.id}
                style={{
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: theme.colors.outlineVariant,
                  backgroundColor: theme.colors.surface,
                  padding: 12,
                }}
              >
                <Text style={{ color: theme.colors.onSurface }}>
                  {row.status} • {row.dueDate}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* All bills */}
      <View style={{ marginTop: 20, marginBottom: 40 }}>
        <Text style={{ color: theme.colors.onSurface }} className="text-lg font-black">
          {locale === "ar" ? "كل الفواتير" : "All Bills"}
        </Text>
        {bills.length === 0 ? (
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{locale === "ar" ? "لا توجد فواتير" : "No bills yet"}</Text>
        ) : (
          <View style={{ marginTop: 8, gap: 8 }}>
            {bills.map((bill) => {
              const category = categoryMap.get(bill.category_id ?? 0);
              return (
                <Pressable
                  key={bill.id}
                  onPress={() => openEdit(bill)}
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: theme.colors.outlineVariant,
                    backgroundColor: theme.colors.surface,
                    padding: 12,
                  }}
                >
                  <Text style={{ color: theme.colors.onSurface }} className="font-bold">
                    {bill.name}
                  </Text>
                  <Text style={{ color: theme.colors.onSurfaceVariant }} className="text-[11px]">
                    {formatMoney(bill.amount, locale, currency)} • {locale === "ar" ? "يوم" : "Day"} {bill.due_day}
                  </Text>
                  <Text style={{ color: theme.colors.onSurfaceVariant }} className="text-[11px]">
                    {category ? (locale === "ar" ? category.nameAr : category.nameEn) : (locale === "ar" ? "بدون فئة" : "No category")}
                  </Text>
                  <Text style={{ color: bill.is_active ? theme.colors.primary : theme.colors.onSurfaceVariant }} className="text-[11px]">
                    {bill.is_active ? (locale === "ar" ? "نشطة" : "Active") : (locale === "ar" ? "غير نشطة" : "Inactive")}
                  </Text>
                  <Pressable
                    onPress={async () => {
                      const goingActive = !bill.is_active;
                      const ok = await confirmAction({
                        title: locale === "ar"
                          ? (goingActive ? "تشغيل الفاتورة؟" : "إيقاف الفاتورة؟")
                          : (goingActive ? "Activate bill?" : "Pause bill?"),
                        message: locale === "ar"
                          ? (goingActive ? "ستعود الفاتورة إلى الجدولة." : "سيتم إيقاف الفاتورة مؤقتا.")
                          : (goingActive ? "The bill will be scheduled again." : "The bill will be paused."),
                        confirmText: locale === "ar" ? "تأكيد" : "Confirm",
                        cancelText: locale === "ar" ? "إلغاء" : "Cancel",
                      });
                      if (!ok) return;
                      await recurringBillService.toggleBillStatus(bill.id, !bill.is_active);
                      await load();
                    }}
                    style={{
                      marginTop: 8,
                      borderRadius: 10,
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      backgroundColor: bill.is_active ? theme.colors.surfaceVariant : theme.colors.secondaryContainer,
                      alignSelf: "flex-start",
                    }}
                  >
                    <Text style={{ color: bill.is_active ? theme.colors.onSurfaceVariant : theme.colors.onSecondaryContainer }}>
                      {bill.is_active ? (locale === "ar" ? "إيقاف" : "Pause") : (locale === "ar" ? "تشغيل" : "Resume")}
                    </Text>
                  </Pressable>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
