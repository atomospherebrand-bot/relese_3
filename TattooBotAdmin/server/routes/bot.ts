import { Router } from "express";
import { z } from "zod";
import {
  masterSchema,
  serviceSchema,
  insertBookingSchema,
} from "@shared/schema";
import { getStorage } from "../storage";

const router = Router();

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
