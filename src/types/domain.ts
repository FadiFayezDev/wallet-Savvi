export type TransactionKind = 'income' | 'expense' | 'goal_transfer' | 'goal_refund' | 'bill_payment' | 'work_expense';
export type CategoryType = 'income' | 'expense' | 'both';
export type GoalStatus = 'active' | 'completed' | 'cancelled';
export type LockMethod = 'none' | 'pin' | 'biometric';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeSource = 'material' | 'fixed' | 'mono' | 'custom' | 'palette';
export type TimeFormat = '12h' | '24h';
export type BillStatus = 'pending' | 'paid' | 'skipped';
export type AccountGroupKey =
  | 'cash'
  | 'account'
  | 'debit_card'
  | 'savings'
  | 'top_up_prepaid'
  | 'investments'
  | 'overdraft'
  | 'loan'
  | 'insurance'
  | 'other';

export interface Category {
  id: number;
  nameAr: string;
  nameEn: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: number;
  name: string;
  targetAmount: number;
  savedAmount: number;
  monthlyContribution: number | null; // الحقل الجديد
  icon: string | null;               // الحقل الجديد
  deadline: string | null;
  note: string | null;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string | null;       // خليه اختياري عشان الـ Error يروح
}

export interface Transaction {
  id: number;
  kind: TransactionKind; // Expanded union
  signedAmount: number;
  amountAbs: number;
  categoryId: number | null;
  accountId: number | null;
  note: string | null;
  occurredAt: string;
  source: 'manual' | 'system' | 'import' | 'transfer';
  isDeleted: boolean;
  cancelReason: string | null; // Added
  cancelledAt: string | null;  // Added
  balanceAfter: number | null; // Added
  createdAt: string;
  updatedAt: string;
}

export interface Account {
  id: number;
  name: string;
  groupKey: AccountGroupKey;
  balance: number;
  description: string | null;
  isDefault: boolean;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoalTransaction {
  id: number;
  goalId: number;
  transactionId: number;
  action: 'transfer' | 'refund';
  amount: number;
  createdAt: string;
}

export interface MonthlyReport {
  id: number;
  monthKey: string;
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  topExpenseCategoryId: number | null;
  topIncomeCategoryId: number | null;
  highestSpendDay: string | null;
  totalGoalSaving: number;
  openingBalance: number | null;      // Added
  closingBalance: number | null;      // Added
  workDaysCount: number;             // Added
  daysOverDailyLimit: number;        // Added
  generatedAt: string;
}

export interface AppSettings {
  name: string;                      // Added
  balance: number;                   // Added
  dailyLimit: number | null;         // Added
  currencyCode: string;
  locale: 'ar' | 'en';
  lockMethod: LockMethod;
  autoLockSeconds: number;
  spendingAlertEnabled: boolean;
  spendingAlertThresholdPct: number;
  notifyBillsEnabled: boolean;
  notifyWorkEnabled: boolean;
  themeMode: ThemeMode;
  themeSource: ThemeSource;
  activeThemeId: number | null;
  activePaletteThemeId: number | null;
  timeFormat: TimeFormat;
  updatedAt: string;
}

export interface CustomTheme {
  id: number;
  name: string;
  primary: string;
  secondary: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaletteThemeColors {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  tertiary: string;
  onTertiary: string;
  tertiaryContainer: string;
  onTertiaryContainer: string;
  background: string;
  onBackground: string;
  surface: string;
  onSurface: string;
  surfaceVariant: string;
  onSurfaceVariant: string;
  outline: string;
  outlineVariant: string;
  error: string;
  onError: string;
  errorContainer: string;
  onErrorContainer: string;
  success: string;
  onSuccess: string;
  successContainer: string;
  onSuccessContainer: string;
  warning: string;
  onWarning: string;
  warningContainer: string;
  onWarningContainer: string;
  info: string;
  onInfo: string;
  infoContainer: string;
  onInfoContainer: string;
  headerGradientStart: string;
  headerGradientMid: string;
  headerGradientEnd: string;
  headerText: string;
  headerIcon: string;
  iconPrimary: string;
  iconSecondary: string;
  iconMuted: string;
}

export interface PaletteTheme {
  id: number;
  name: string;
  light: PaletteThemeColors;
  dark: PaletteThemeColors;
  createdAt: string;
  updatedAt: string;
}

// --- New Interfaces ---

export interface ReportCategoryBreakdown {
  id: number;
  reportId: number;
  categoryId: number;
  totalAmount: number;
  percentage: number;
}

export interface RecurringBill {
  id: number;
  name: string;
  amount: number;
  categoryId: number | null;
  dueDay: number;
  isActive: boolean;
  createdAt: string;
}

export interface BillInstance {
  id: number;
  billId: number;
  transactionId: number | null;
  dueDate: string;
  status: BillStatus;
  paidAt: string | null;
}

export interface WorkSchedule {
  id: number;
  dayOfWeek: number; // 0-6
  isWorkDay: boolean;
  startTime: string | null;
  endTime: string | null;
  updatedAt: string;
}

export interface DailyWorkExpense {
  id: number;
  name: string;
  defaultAmount: number;
  isActive: boolean;
}

export interface WorkDayLog {
  id: number;
  workDate: string;
  shiftStart: string | null;
  shiftEnd: string | null;
  totalWorkExpenses: number;
  note: string | null;
  createdAt: string;
}

export interface DailySpendingSummary {
  id: number;
  summaryDate: string;
  totalSpent: number;
  isOverLimit: boolean;
  remainingFromLimit: number | null;
}

// --- Dashboard & UI Helpers ---

export interface DashboardSummary {
  balance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  todaySpent: number;        // ضيف ده
  isOverLimit: boolean;      // ضيف ده
  remainingLimit: number;    // ضيف ده
}

export interface DayComparisonPoint {
  dayKey: string;   // YYYY-MM-DD
  dayLabel: string; // MM-DD
  income: number;
  expense: number;
}

export interface SavingsComparison {
  currentMonthSaving: number;  // لاحظ مفيش s في الآخر
  previousMonthSaving: number; // لاحظ مفيش s في الآخر
  totalSaving: number;
  percentChange: number;
  nearestGoal?: string; // ضفنا ده عشان الـ UI
}

export interface GoalDetails {
  goal: Goal;
  transfers: (GoalTransaction & { transactionOccurredAt: string; note: string | null })[];
}
