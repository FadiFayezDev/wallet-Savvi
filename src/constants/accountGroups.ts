import type { AccountGroupKey } from "@/src/types/domain";

export type AccountGroupType = "asset" | "liability";

export type AccountGroupMeta = {
  key: AccountGroupKey;
  labelEn: string;
  labelAr: string;
  type: AccountGroupType;
  order: number;
};

export const ACCOUNT_GROUPS: AccountGroupMeta[] = [
  { key: "cash",            labelEn: "Cash",            labelAr: "نقدي",            type: "asset",     order: 1 },
  { key: "account",         labelEn: "Account",         labelAr: "حساب",            type: "asset",     order: 2 },
  { key: "debit_card",      labelEn: "Debit card",      labelAr: "بطاقة خصم",       type: "asset",     order: 3 },
  { key: "savings",         labelEn: "Savings",         labelAr: "ادخار",           type: "asset",     order: 4 },
  { key: "top_up_prepaid",  labelEn: "Top up prepaid",  labelAr: "شحن مسبق",        type: "asset",     order: 5 },
  { key: "investments",     labelEn: "Investments",     labelAr: "استثمارات",       type: "asset",     order: 6 },
  { key: "overdraft",       labelEn: "Overdraft",       labelAr: "سحب على المكشوف", type: "liability", order: 7 },
  { key: "loan",            labelEn: "Loan",            labelAr: "قرض",             type: "liability", order: 8 },
  { key: "insurance",       labelEn: "Insurance",       labelAr: "تأمين",           type: "asset",     order: 9 },
  { key: "other",           labelEn: "Other",           labelAr: "أخرى",            type: "asset",     order: 10 },
];

export const ACCOUNT_GROUP_MAP = new Map<AccountGroupKey, AccountGroupMeta>(
  ACCOUNT_GROUPS.map((group) => [group.key, group]),
);

export const DEFAULT_ACCOUNTS: { name: string; groupKey: AccountGroupKey; isDefault?: boolean }[] = [
  { name: "Cash",            groupKey: "cash",        isDefault: true },
  { name: "Account",         groupKey: "account" },
  { name: "Debit card",      groupKey: "debit_card" },
  { name: "Savings",         groupKey: "savings" },
  { name: "Top up prepaid",  groupKey: "top_up_prepaid" },
  { name: "Investments",     groupKey: "investments" },
  { name: "Overdraft",       groupKey: "overdraft" },
  { name: "Loan",            groupKey: "loan" },
  { name: "Insurance",       groupKey: "insurance" },
  { name: "Other",           groupKey: "other" },
];
