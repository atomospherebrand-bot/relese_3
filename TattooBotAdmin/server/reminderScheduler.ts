import type { Booking } from "@shared/schema";
import { getStorage } from "./storage";
import { readNotifications, writeNotifications } from "./notifications";

const BOT_TZ = process.env.TZ || "Europe/Moscow";
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const REMINDER_MAX_HOURS = 4;
const REMINDER_MIN_HOURS = 3;

function parseBookingDateTime(booking: Booking): Date | null {
  const time = booking.time.length > 5 ? booking.time.slice(0, 5) : booking.time;
  const iso = `${booking.date}T${time}:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatWithTz(date: Date): string {
  return date.toLocaleString("ru-RU", {
    timeZone: BOT_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function sendReminder(booking: Booking, chatId: number | string, token: string): Promise<boolean> {
  const start = parseBookingDateTime(booking);
  if (!start) return false;

  const humanTime = formatWithTz(start);
  const keyboard = {
    inline_keyboard: [[{ text: "❌ Отменить запись", callback_data: `cancel:${booking.id}` }]],
  };

  const text =
    `Напоминание о записи!\n\n` +
    `Услуга: ${booking.service}\n` +
    `Мастер: ${booking.masterName || ""}\n` +
    `Время: ${humanTime}\n\n` +
    `Если не получается прийти — нажми кнопку, чтобы отменить.`;

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: keyboard }),
  });

  return response.ok;
}

function resolveChatId(record: Booking, mapEntry: any): number | string | undefined {
  if (mapEntry?.chatId) return mapEntry.chatId;
  if (record.telegramId) return record.telegramId;
  if (record.clientTelegram) return `@${String(record.clientTelegram).replace(/^@/, "")}`;
  if (record.clientUsername) return `@${String(record.clientUsername).replace(/^@/, "")}`;
  return undefined;
}

export function startReminderScheduler() {
  const storage = getStorage();

  const tick = async () => {
    try {
      const settings = await storage.getSettings();
      const token = (settings as any)?.botToken || process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN;
      if (!token) return;

      const bookings = await storage.listBookings();
      const notifMap = readNotifications();
      let changed = false;
      const now = new Date();

      for (const booking of bookings) {
        if (booking.status !== "confirmed") continue;
        const start = parseBookingDateTime(booking);
        if (!start) continue;

        const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (diffHours > REMINDER_MAX_HOURS || diffHours < REMINDER_MIN_HOURS) continue;

        const rec = notifMap[booking.id] || {};
        if (rec.rem3hSent) continue;

        const chatId = resolveChatId(booking, rec);
        if (!chatId) continue;

        const ok = await sendReminder(booking, chatId, token);
        if (ok) {
          notifMap[booking.id] = { ...rec, rem3hSent: true, chatId };
          changed = true;
        }
      }

      if (changed) {
        writeNotifications(notifMap);
      }
    } catch (error) {
      console.warn("[reminder] tick failed", error);
    }
  };

  setInterval(tick, CHECK_INTERVAL_MS);
  tick();
}
