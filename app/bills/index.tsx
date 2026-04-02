import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { useFocusEffect, useRouter } from "expo-router";
import { IconButton, Text as PaperText, useTheme } from "react-native-paper";

import { MaterialScreen } from "@/src/components/layout/MaterialScreen";

import { CalculatorField } from "@/src/components/common/CalculatorField";
import { DatePickerField } from "@/src/components/common/DatePickerField";
import { ComboSelect } from "@/src/components/forms/ComboSelect";
import { accountService } from "@/src/services/accountService";
import { categoryService } from "@/src/services/categoryService";
import { notificationService } from "@/src/services/notificationService";
import { recurringBillService } from "@/src/services/recurringBillService";
import { useSettingsStore } from "@/src/stores/settingsStore";
import type { Account, Category } from "@/src/types/domain";
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [billPayAccounts, setBillPayAccounts] = useState<Record<number, number | null>>({});
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isActive, setIsActive] = useState(true);

  const locale = settings?.locale ?? "ar";
  const currency = settings?.currencyCode ?? "EGP";
  const monthKey = toMonthKey(new Date());

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const defaultAccountId = useMemo(() => {
    const preferred = accounts.find((acc) => acc.isDefault)?.id;
    return preferred ?? accounts[0]?.id ?? null;
  }, [accounts]);
  const accountOptions = useMemo(
    () =>
      accounts.map((acc) => ({
        value: acc.id,
        label: acc.name,
      })),
    [accounts],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [categoryRows, allBills, pending, instances, accountRows] = await Promise.all([
        categoryService.listCategories("expense"),
        recurringBillService.getAllBills(true),
        recurringBillService.getPendingBills(monthKey),
        recurringBillService.listBillInstancesForMonth(monthKey),
        accountService.listAccounts(),
      ]);
      setCategories(categoryRows);
      setBills(allBills);
      setPendingBills(pending);
      setBillInstances(instances);
      setAccounts(accountRows);
    } catch {
      setBills([]);
      setPendingBills([]);
      setBillInstances([]);
      setAccounts([]);
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
    setDueDate(null);
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
      notificationService.rescheduleAll().catch(() => undefined);
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
    if (bill.due_day) {
      const day = String(bill.due_day).padStart(2, "0");
      setDueDate(`${monthKey}-${day}`);
    } else {
      setDueDate(null);
    }
    setCategoryId(bill.category_id ?? null);
    setIsActive(Boolean(bill.is_active));
  };

  return (
    <MaterialScreen
      layout="stack"
      header={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 }}>
          <IconButton
            icon="arrow-left"
            iconColor={theme.colors.onSurface}
            onPress={() => router.back()}
            style={{ margin: 0 }}
          />
          <PaperText variant="headlineSmall" style={{ color: theme.colors.onSurface, flex: 1 }}>
            {locale === "ar" ? "الفواتير الدورية" : "Recurring Bills"}
          </PaperText>
        </View>
      }
    >
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
          <DatePickerField
            label={locale === "ar" ? "يوم الاستحقاق (يتكرر شهرياً)" : "Due day (repeats monthly)"}
            hint={locale === "ar" ? "اختر اليوم من التقويم" : "Pick a day from the calendar"}
            value={dueDate}
            onChange={(value) => {
              setDueDate(value);
              if (!value) {
                setDueDay("");
                return;
              }
              const parts = value.split("-");
              const day = Number(parts[2]);
              setDueDay(String(day));
            }}
            required
            locale={locale}
          />
        </View>

        <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
          {locale === "ar" ? "اختر الفئة (اختياري)" : "Pick category (optional)"}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          <Pressable
            onPress={() => router.push({ pathname: "/categories/manage", params: { tab: "expense" } })}
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
              const selectedAccountId = billPayAccounts[bill.id] ?? defaultAccountId;
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
                  {accountOptions.length > 0 ? (
                    <View style={{ marginTop: 10 }}>
                      <ComboSelect
                        label={locale === "ar" ? "الحساب" : "Account"}
                        placeholder={locale === "ar" ? "اختر" : "Select"}
                        value={selectedAccountId}
                        options={accountOptions}
                        onChange={(value) =>
                          setBillPayAccounts((prev) => ({ ...prev, [bill.id]: value }))
                        }
                      />
                    </View>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                    <Pressable
                      onPress={async () => {
                        await recurringBillService.applyBill(bill.id, dueDate, selectedAccountId);
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
                      notificationService.rescheduleAll().catch(() => undefined);
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
    </MaterialScreen>
  );
}
