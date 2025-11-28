import { Router } from "express";
import { z } from "zod";
import {
  masterSchema,
  serviceSchema,
  insertBookingSchema,
} from "@shared/schema";
import { getStorage } from "../storage";

const router = Router();

async function notifyMasterOnNewBooking(booking: any) {
  const logPrefix = "[bot-notify-master]";
  try {
    if (!booking) return;
    const storage = getStorage();
    const settings = await storage.getSettings();
    const token = (settings as any)?.botToken || process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN;
    if (!token) {
      console.warn(`${logPrefix} missing botToken`);
      return;
    }

    // Пытаемся достать телеграм мастера из брони, из справочника — и логируем для отладки.
    let masterHandle = (booking.masterTelegram ?? "").trim();
    if (!masterHandle && booking.masterId) {
      try {
        const masters = await storage.listMasters();
        masterHandle = masters.find((m) => m.id === booking.masterId)?.telegram?.trim() ?? "";
      } catch (err) {
        console.warn(`${logPrefix} failed to load master list`, err);
      }
    }

    if (!masterHandle) {
      console.warn(`${logPrefix} master has no telegram`, booking.masterId);
      return;
    }

    let chatId: string | number = masterHandle.startsWith("@") ? masterHandle : `@${masterHandle}`;
    console.log(`${logPrefix} resolving chat`, { masterId: booking.masterId, chatId });
    try {
      const lookup = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId }),
      });
      if (lookup.ok) {
        const payload = await lookup.json();
        const resolved = payload?.result?.id;
        if (resolved) chatId = resolved;
        console.log(`${logPrefix} getChat ok`, { chatId, resolved });
      } else {
        console.warn(`${logPrefix} getChat failed`, lookup.status, await lookup.text());
      }
    } catch (e) {
      console.warn(`${logPrefix} getChat error`, e);
    }
    const when = `${booking.date ?? ""}${booking.time ? ` • ${booking.time}` : ""}`;
    const text =
      `Новая заявка от клиента.\n\n` +
      `Услуга: ${booking.service || ""}\n` +
      `Дата и время: ${when}\n` +
      `Клиент: ${booking.clientName || ""}\n` +
      `Телефон: ${booking.clientPhone || ""}\n` +
      `Telegram: ${booking.clientTelegram ? `@${String(booking.clientTelegram).replace(/^@/, "")}` : "-"}\n` +
      (booking.notes ? `Комментарий: ${booking.notes}\n` : "");

    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!resp.ok) {
      console.warn(`${logPrefix} sendMessage failed`, resp.status, await resp.text());
    } else {
      console.log(`${logPrefix} sent`, { chatId });
    }
  } catch (e) {
    console.warn("[bot-notify-master] failed", e);
  }
}

const mastersQuerySchema = z.object({
  includeInactive: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => {
      if (typeof value === "boolean") return value;
      if (value === undefined) return false;
      return value === "true";
    }),
});

const availabilityCalendarQuery = z.object({
  serviceId: z.string().uuid(),
  days: z.coerce.number().int().min(1).max(60).default(30),
  startDate: z
    .string()
    .regex(/\d{4}-\d{2}-\d{2}/)
    .optional(),
});

const availabilityMastersQuery = z.object({
  serviceId: z.string().uuid(),
  date: z.string().regex(/\d{4}-\d{2}-\d{2}/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

const portfolioQuerySchema = z.object({
  masterId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(6),
});

const botBookingRequestSchema = insertBookingSchema.extend({
  notes: z.string().optional(),
});

const botClientSchema = z.object({
  telegramId: z.union([z.string(), z.number()]).optional(),
  username: z.string().optional(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  phone: z.string().optional(),
});

const botAvailabilityDaySchema = z.object({
  date: z.string(),
  available: z.boolean(),
});

const botMasterSummarySchema = masterSchema.pick({
  id: true,
  name: true,
  nickname: true,
});

const sanitizeError = (error: unknown): { status: number; message: string } => {
  const message = error instanceof Error ? error.message : "Internal server error";
  if (/Service not found/i.test(message) || /Мастер не найден/i.test(message)) {
    return { status: 404, message: "Ресурс не найден" };
  }
  if (/активная запись/i.test(message)) {
    return { status: 409, message };
  }
  if (/занято/i.test(message)) {
    return { status: 409, message };
  }
  if (/validation/i.test(message)) {
    return { status: 400, message };
  }
  return { status: 500, message };
};

router.get("/services", async (_req, res, next) => {
  try {
    const services = await getStorage().listServices();
    res.json({ services: services.map((service) => serviceSchema.parse(service)) });
  } catch (error) {
    next(error);
  }
});

router.get("/masters", async (req, res, next) => {
  try {
    const { includeInactive } = mastersQuerySchema.parse(req.query);
    const storage = getStorage();
    const masters = includeInactive ? await storage.listMasters() : await storage.listActiveMasters();
    res.json({ masters: masters.map((master) => masterSchema.parse(master)) });
  } catch (error) {
    next(error);
  }
});

router.get("/messages", async (_req, res, next) => {
  try {
    const messages = await getStorage().listMessages();
    res.json({ messages });
  } catch (error) {
    next(error);
  }
});

router.get("/settings", async (_req, res, next) => {
  try {
    const settings = await getStorage().getSettings();
    const { botToken: _botToken, ...publicSettings } = settings;
    res.json({ settings: publicSettings });
  } catch (error) {
    next(error);
  }
});

router.get("/availability/calendar", async (req, res, next) => {
  try {
    const params = availabilityCalendarQuery.parse(req.query);
    const storage = getStorage();
    const availability = await storage.getAvailabilityCalendar(
      params.serviceId,
      params.days,
      params.startDate,
    );
    res.json({ availability: availability.map((day) => botAvailabilityDaySchema.parse(day)) });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    if (status === 500) {
      return next(error);
    }
    res.status(status).json({ message });
  }
});

router.get("/availability/masters", async (req, res, next) => {
  try {
    const params = availabilityMastersQuery.parse(req.query);
    const masters = await getStorage().getMastersForSlot(params.serviceId, params.date, params.time);
    res.json({ masters: masters.map((master) => botMasterSummarySchema.parse(master)) });
  } catch (error) {
    const { status, message } = sanitizeError(error);
    if (status === 500) {
      return next(error);
    }
    res.status(status).json({ message });
  }
});

router.post("/bookings", async (req, res, next) => {
  try {
    const payload = botBookingRequestSchema.parse(req.body);
    const booking = await getStorage().createBooking({
      clientName: payload.clientName,
      clientPhone: payload.clientPhone,
      clientTelegram: payload.clientTelegram,
      serviceId: payload.serviceId,
      masterId: payload.masterId,
      date: payload.date,
      time: payload.time,
      notes: payload.notes,
      status: "pending",
    });
    res.status(201).json({ booking });
    notifyMasterOnNewBooking(booking);
  } catch (error) {
    const { status, message } = sanitizeError(error);
    if (status === 500) {
      return next(error);
    }
    res.status(status).json({ message });
  }
});

router.post("/clients", async (req, res, next) => {
  try {
    const payload = botClientSchema.parse(req.body);
    await getStorage().upsertClientProfile(payload);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/portfolio", async (req, res, next) => {
  try {
    const params = portfolioQuerySchema.parse(req.query);
    const result = await getStorage().listPortfolioByMaster(params.masterId, params.page, params.pageSize);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
