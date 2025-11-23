import fs from "fs";
import path from "path";

export type NotificationFlags = {
  confirmationSent?: boolean;
  rem24hSent?: boolean;
  rem2hSent?: boolean;
  rem3hSent?: boolean;
  chatId?: number | string;
};

const notifFile = path.join(process.cwd(), "data", "notifications.json");

export function readNotifications(): Record<string, NotificationFlags> {
  try {
    const content = fs.readFileSync(notifFile, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function writeNotifications(map: Record<string, NotificationFlags>) {
  fs.mkdirSync(path.dirname(notifFile), { recursive: true });
  fs.writeFileSync(notifFile, JSON.stringify(map, null, 2), "utf-8");
}

export function registerChat(bookingId: string, chatId: number | string) {
  const map = readNotifications();
  map[bookingId] = { ...(map[bookingId] || {}), chatId };
  writeNotifications(map);
  return map;
}

export function markNotification(
  bookingId: string,
  type: "confirm" | "rem24" | "rem2" | "rem3",
) {
  const map = readNotifications();
  const rec = map[bookingId] || {};
  if (type === "confirm") rec.confirmationSent = true;
  if (type === "rem24") rec.rem24hSent = true;
  if (type === "rem2") rec.rem2hSent = true;
  if (type === "rem3") rec.rem3hSent = true;
  map[bookingId] = rec;
  writeNotifications(map);
  return map;
}
