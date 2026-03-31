import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import dayjs from 'dayjs';

import { settingsService } from '@/src/services/settingsService';
import { recurringBillService } from '@/src/services/recurringBillService';
import { workService } from '@/src/services/workService';

type NotificationTarget = { type: 'bill' | 'work' } & Record<string, unknown>;

const ensureChannel = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
};

const ensurePermissions = async () => {
  const perms = await Notifications.getPermissionsAsync();
  if (perms.status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    return req.status === 'granted';
  }
  return true;
};

const parseTime = (value?: string | null) => {
  if (!value) return null;
  const [h, m] = value.split(':').map((part) => Number(part));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return { hour: Math.max(0, Math.min(23, h)), minute: Math.max(0, Math.min(59, m)) };
};

const buildBillsBody = (names: string[], locale: 'ar' | 'en') => {
  if (names.length === 0) return locale === 'ar' ? 'لديك فواتير مستحقة اليوم.' : 'You have bills due today.';
  if (names.length <= 3) return names.join(' • ');
  const extra = names.length - 3;
  const head = names.slice(0, 3).join(' • ');
  return locale === 'ar' ? `${head} • +${extra} أخرى` : `${head} • +${extra} more`;
};

const nextDueDate = (monthKey: string, dueDay: number) => {
  const today = dayjs().startOf('day');
  const currentDueStr = recurringBillService.getDueDateForMonth(monthKey, dueDay);
  const currentDue = dayjs(currentDueStr);
  if (currentDue.isBefore(today)) {
    const nextMonthKey = dayjs(`${monthKey}-01`).add(1, 'month').format('YYYY-MM');
    const nextDueStr = recurringBillService.getDueDateForMonth(nextMonthKey, dueDay);
    return dayjs(nextDueStr);
  }
  return currentDue;
};

export const notificationService = {
  async init() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    await ensureChannel();
    await ensurePermissions();
  },

  async rescheduleAll() {
    const granted = await ensurePermissions();
    if (!granted) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const settings = await settingsService.getSettings();
    if (settings.notifyBillsEnabled) await this.scheduleBills(settings.locale);
    if (settings.notifyWorkEnabled) await this.scheduleWork(settings.locale);
  },

  async scheduleBills(locale: 'ar' | 'en') {
    const bills = await recurringBillService.getAllBills(false);
    if (bills.length === 0) return;

    const monthKey = dayjs().format('YYYY-MM');
    const groups = new Map<string, { ids: number[]; names: string[] }>();

    for (const bill of bills) {
      const due = nextDueDate(monthKey, bill.due_day);
      const dueKey = due.format('YYYY-MM-DD');
      const label = bill.name ?? (locale === 'ar' ? 'فاتورة' : 'Bill');
      const group = groups.get(dueKey) ?? { ids: [], names: [] };
      group.ids.push(bill.id);
      group.names.push(label);
      groups.set(dueKey, group);
    }

    for (const [dueDate, info] of groups) {
      const fireAt = dayjs(dueDate).hour(9).minute(0).second(0).toDate();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: locale === 'ar' ? 'فواتير مستحقة اليوم' : 'Bills due today',
          body: buildBillsBody(info.names, locale),
          data: { type: 'bill', dueDate, billIds: info.ids } as NotificationTarget,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: 'default',
        },
      });
    }
  },

  async scheduleWork(locale: 'ar' | 'en') {
    const schedule = await workService.listSchedule();
    for (const day of schedule) {
      if (!day.isWorkDay) continue;
      const weekday = day.dayOfWeek + 1; // Expo: 1=Sunday ... 7=Saturday

      const start = parseTime(day.startTime);
      if (start) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: locale === 'ar' ? 'بداية يوم العمل' : 'Work day starts',
            body: locale === 'ar' ? 'استعد لمصاريف العمل اليوم.' : 'Prepare for today’s work expenses.',
            data: { type: 'work', kind: 'start', dayOfWeek: day.dayOfWeek } as NotificationTarget,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour: start.hour,
            minute: start.minute,
            repeats: true,
            channelId: 'default',
          },
        });
      }

      const end = parseTime(day.endTime);
      if (end) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: locale === 'ar' ? 'نهاية يوم العمل' : 'Work day ends',
            body: locale === 'ar' ? 'تأكد من تسجيل مصاريفك.' : 'Make sure your expenses are logged.',
            data: { type: 'work', kind: 'end', dayOfWeek: day.dayOfWeek } as NotificationTarget,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday,
            hour: end.hour,
            minute: end.minute,
            repeats: true,
            channelId: 'default',
          },
        });
      }
    }
  },

  async scheduleTestNotification(delaySeconds = 5) {
    const granted = await ensurePermissions();
    if (!granted) return;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Test Notification',
        body: `Test after ${delaySeconds}s`,
        data: { type: 'test' } as NotificationTarget,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(delaySeconds)),
        repeats: false,
        channelId: 'default',
      },
    });
  },

  async cancelAllTestNotifications() {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const testIds = all
      .filter((n) => (n.content?.data as any)?.type === 'test')
      .map((n) => n.identifier);
    await Promise.all(testIds.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  },
};
