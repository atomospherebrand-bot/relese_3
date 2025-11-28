import fs from "fs";
import path from "path";
import { createHash, randomUUID } from "crypto";
import { and, asc, desc, eq, gte, ne, or, sql } from "drizzle-orm";
import {
  bookingSchema,
  bookingStatusSchema,
  bookingsTable,
  botMessageSchema,
  botMessagesTable,
  certificateSchema,
  clientSummarySchema,
  insertBookingSchema,
  insertCertificateSchema,
  insertMasterSchema,
  insertServiceSchema,
  masterSchema,
  mastersTable,
  portfolioItemSchema,
  portfolioTable,
  serviceSchema,
  servicesTable,
  settingsSchema,
  settingsTable,
  type Booking,
  type BotMessage,
  type Certificate,
  type ClientSummary,
  type InsertBooking,
  type InsertMaster,
  type InsertService,
  type Master,
  type PortfolioItem,
  type Service,
  type Settings,
} from "@shared/schema";
import { db } from "./db";
import { z } from "zod";

function normalizeUploadUrl(u: string | null | undefined): string {
  if (!u) return "";
  let url = String(u).trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (/^\/uploads\//.test(url)) return url;
  url = url.replace(/^\.\/?uploads\//, "").replace(/^uploads\//, "");
  if (url && !/^\/uploads\//.test(url)) {
    url = "/uploads/" + url;
  }
  return url;
}

function optional<T>(value: T | null): T | undefined {
  return value === null ? undefined : value;
}

const DATA_DIR = path.join(process.cwd(), "data");
const CERTS_FILE = path.join(DATA_DIR, "certs.json");
const CLIENTS_FILE = path.join(DATA_DIR, "clients.json");
const CLIENT_PROFILES_FILE = path.join(DATA_DIR, "client_profiles.json");
const AVAILABILITY_FILE = path.join(DATA_DIR, "availability.json");

type DaySchedule = {
  isWorking: boolean;
  start?: string;
  end?: string;
  note?: string | null;
};

const DAY_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_REGEX = /^\d{4}-\d{2}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_DAY_START = "10:00";
const DEFAULT_DAY_END = "20:00";

const rawDayConfigSchema = z.object({
  isWorking: z.boolean(),
  start: z.string().optional(),
  end: z.string().optional(),
  note: z.string().optional().nullable(),
});
type RawDayConfig = z.infer<typeof rawDayConfigSchema>;

const dayDefaultsSchema = z
  .object({
    start: z.string().regex(TIME_REGEX).optional(),
    end: z.string().regex(TIME_REGEX).optional(),
  })
  .partial()
  .optional();

const availabilityRecordSchema = z.union([
  z.object({
    defaults: dayDefaultsSchema,
    days: z.record(z.string().regex(DAY_KEY_REGEX), rawDayConfigSchema).default({}),
  }),
  z.record(z.string().regex(DAY_KEY_REGEX), rawDayConfigSchema),
]);

const availabilitySchema = z.record(z.string(), availabilityRecordSchema);

function compareTimes(left: string, right: string): number {
  return left.localeCompare(right, "en");
}

function normalizeDayConfig(config: RawDayConfig): DaySchedule {
  const note = config.note !== undefined && config.note !== null ? String(config.note).trim() : undefined;
  if (!config.isWorking) {
    return note ? { isWorking: false, note } : { isWorking: false };
  }

  const rawStart = (config.start ?? "").trim();
  const rawEnd = (config.end ?? "").trim();
  const safeStart = TIME_REGEX.test(rawStart) ? rawStart : DEFAULT_DAY_START;
  let safeEnd = TIME_REGEX.test(rawEnd) ? rawEnd : DEFAULT_DAY_END;

  if (compareTimes(safeEnd, safeStart) <= 0) {
    safeEnd = compareTimes(DEFAULT_DAY_END, safeStart) > 0 ? DEFAULT_DAY_END : safeStart;
  }

  const normalized: DaySchedule = { isWorking: true, start: safeStart, end: safeEnd };
  if (note) {
    normalized.note = note;
  }
  return normalized;
}

function createDefaultMasters(): Master[] {
  return [];
}

function createDefaultServices(): Service[] {
  return [
    {
      id: randomUUID(),
      name: "Сеанс 2ч",
      duration: 120,
      price: 12000,
      description: "Стандартный сеанс тату",
    },
    {
      id: randomUUID(),
      name: "Сеанс 4ч",
      duration: 240,
      price: 22000,
      description: "Расширенный сеанс для крупных работ",
    },
    {
      id: randomUUID(),
      name: "Консультация",
      duration: 30,
      price: 0,
      description: "Бесплатная консультация и разработка эскиза",
    },
  ];
}

function createDefaultMessages(): BotMessage[] {
  return [
    {
      id: randomUUID(),
      key: "welcome",
      label: "Приветствие",
      value:
        "👋 Привет! Я бот тату-мастера.\n• Запись в пару кликов\n• Напомню о визите\n• Покажу маршрут до студии\n\nРаботаю 24/7 и экономлю до 8 часов в неделю.",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "route",
      label: "Как добраться",
      value: "📍 *{studio}*\n{address}\n\n{links}\n\nНапиши, если нужна помощь с маршрутом.",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "about",
      label: "О мастерах",
      value: "Это наши мастера 👆",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "pay",
      label: "Оплата",
      value:
        "💳 *Оплата*\n\n{methods}\n\n_Депозит фиксирует слот и вычитается из стоимости сеанса._",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "certs",
      label: "Акции",
      value: "🎉 Актуальные акции и спецпредложения студии.",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "certs_empty",
      label: "Акции — пусто",
      value: "Акции пока не опубликованы.",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "booking_start",
      label: "Начало записи",
      value:
        "Услуга: {service}\nДлительность: {duration} мин\nЦена: {price} ₽\n\nВыберите дату:",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "choose_service",
      label: "Выбор услуги",
      value: "Выбери услугу:",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "choose_master",
      label: "Выбор мастера",
      value:
        "Услуга: {service}\nДлительность: {duration} мин\nЦена: {price} ₽\n\nВыберите мастера:",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "choose_date",
      label: "Выбор даты",
      value:
        "Услуга: {service}\nДлительность: {duration} мин\nЦена: {price} ₽\n\nВыберите дату:",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "choose_time",
      label: "Выбор времени",
      value: "Выбери время:",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "booking_confirmed",
      label: "Подтверждение записи",
      value:
        "✅ Запись подтверждена!\n\nУслуга: {service}\nМастер: {master}\nДата и время: {date} • {time}\nАдрес: {address}\n\n✅ Не забудь добавить в контакты. Напиши, если нужна помощь с маршрутом.\n{master_contact}",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "booking_pending",
      label: "Заявка отправлена",
      value:
        "🕓 Заявка отправлена. Как только мастер подтвердит время, я пришлю сообщение и напоминание заранее.",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "booking_slot_taken",
      label: "Слот занят",
      value: "Не удалось подтвердить запись (возможно, слот успели занять). Попробуй другое время.",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "booking_failed",
      label: "Ошибка бронирования",
      value: "Не удалось создать запись. Попробуйте ещё раз или выберите другое время.",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "no_services",
      label: "Нет услуг",
      value: "Нет доступных услуг. Попробуй позже.",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "no_active_masters",
      label: "Нет мастеров",
      value: "Пока нет активных мастеров.",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "no_slots_for_day",
      label: "Нет слотов на дату",
      value: "Свободных слотов нет. Выберите другую дату.",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "no_slots_any",
      label: "Нет слотов в период",
      value: "Свободных слотов нет в ближайшее время.",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "active_booking_exists",
      label: "Уже есть запись",
      value: "У тебя уже есть активная запись. Если нужно изменить время — напиши администратору или дождись завершения визита.",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "ask_name",
      label: "Запрос имени",
      value: "Как к тебе обращаться? Напиши имя (можно просто как тебя обычно называют).",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "invalid_name",
      label: "Некорректное имя",
      value: "Имя слишком короткое. Пришли нормальное имя 🙂",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "ask_phone",
      label: "Запрос телефона",
      value: "Огонь! А теперь номер телефона для связи (в любом формате, можно +7... или 8...).",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "invalid_phone",
      label: "Некорректный телефон",
      value: "Не похоже на номер телефона. Пришли в формате +7... или 8...",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "button_booking",
      label: "Кнопка записи",
      value: "📅 Записаться",
      type: "text",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "button_portfolio",
      label: "Кнопка портфолио",
      value: "🖼️ Портфолио",
      type: "text",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "button_location",
      label: "Кнопка локации",
      value: "📍 Как добраться",
      type: "text",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "button_start",
      label: "Кнопка старт",
      value: "▶️ Старт",
      type: "text",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "start_intro",
      label: "Приветствие при старте",
      value: "",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "terms",
      label: "Условия использования",
      value:
        "Продолжая, вы подтверждаете, что ознакомились и согласны с\n" +
        "[Условия использования](https://telegra.ph/Terms-of-Use-11-29-2) и " +
        "[Политика конфиденциальности](https://telegra.ph/Privacy-Policy-11-29-122).",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "captcha_prompt",
      label: "Капча",
      value:
        "Вводя код с картинки, вы подтверждаете, что согласны с условиями использования и политикой конфиденциальности, указанными выше.",
      type: "textarea",
      imageUrl: null,
    },
    {
      id: randomUUID(),
      key: "captcha_wrong",
      label: "Неправильная капча",
      value: "Попробуйте пожалуйста снова ввести капчу",
      type: "textarea",
      imageUrl: null,
    },
  ];
}

function createDefaultPortfolio(): PortfolioItem[] {
  return [
  ];
}

const DEFAULT_SETTINGS: Settings = {
  botToken: "",
  studioName: "Тату-студия INKMAN",
  address: "Москва, ул. Примера, 1",
  yandexMapUrl: "https://yandex.ru/maps/?ll=37.617700,55.755800&z=16",
  latitude: "55.755800",
  longitude: "37.617700",
  paymentMethods: "Наличные, СБП, Карта, Криптовалюта",
  workingHours: "Ежедневно с 10:00 до 22:00",
};

function formatSlot(date: string, time: string, duration: number) {
  const [hours, minutes] = time.split(":").map((v) => parseInt(v, 10));
  const start = new Date(`${date}T${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  return { start, end };
}

interface BookingRow {
  id: string;
  clientName: string;
  clientPhone: string;
  clientTelegram: string | null;
  clientUsername: string | null;
  telegramId: string | null;
  masterId: string;
  serviceId: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  notes: string | null;
  masterName: string | null;
  masterNickname: string | null;
  masterTelegram: string | null;
  serviceName: string | null;
}

export class DatabaseStorage {
  private ready: Promise<void>;

  constructor(private readonly database = db) {
    this.ready = this.initialize();
  }

  private async initialize() {
    await this.seedDefaults();
  }

  private async seedDefaults() {
    const masters = await this.database.select().from(mastersTable).limit(1);
    if (masters.length === 0) {
      const defaults = createDefaultMasters();
      if (defaults.length > 0) {
        await this.database.insert(mastersTable).values(
          defaults.map((m) => ({
            id: m.id,
            name: m.name,
            nickname: m.nickname,
            telegram: m.telegram ?? null,
            specialization: m.specialization,
            avatar: m.avatar ?? null,
            teletypeUrl: m.teletypeUrl ?? null,
            isActive: m.isActive,
          })),
        );
      }
    }

    const services = await this.database.select().from(servicesTable).limit(1);
    if (services.length === 0) {
      const defaults = createDefaultServices();
      if (defaults.length > 0) {
        await this.database.insert(servicesTable).values(defaults);
      }
    }

    const messages = await this.database.select().from(botMessagesTable);
    const defaults = createDefaultMessages();

    if (messages.length === 0) {
      if (defaults.length > 0) {
        await this.database.insert(botMessagesTable).values(defaults);
      }
    } else {
      const existingKeys = messages.map((m) => m.key);
      const missing = defaults.filter((msg) => !existingKeys.includes(msg.key));
      if (missing.length > 0) {
        await this.database
          .insert(botMessagesTable)
          .values(missing)
          .onConflictDoNothing({ target: botMessagesTable.key });
      }
    }

    const portfolio = await this.database.select().from(portfolioTable).limit(1);
    if (portfolio.length === 0) {
      const defaults = createDefaultPortfolio();
      if (defaults.length > 0) {
        await this.database.insert(portfolioTable).values(defaults);
      }
    }

    const settings = await this.database
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, "default"))
      .limit(1);

    if (settings.length === 0) {
      await this.database.insert(settingsTable).values({
        id: "default",
        botToken: DEFAULT_SETTINGS.botToken,
        studioName: DEFAULT_SETTINGS.studioName,
        address: DEFAULT_SETTINGS.address,
        yandexMapUrl: DEFAULT_SETTINGS.yandexMapUrl ?? null,
        latitude: DEFAULT_SETTINGS.latitude ?? null,
        longitude: DEFAULT_SETTINGS.longitude ?? null,
        paymentMethods: DEFAULT_SETTINGS.paymentMethods,
        workingHours: DEFAULT_SETTINGS.workingHours,
      });
    }
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private readDataFile<T>(file: string, fallback: T): T {
    this.ensureDataDir();
    try {
      const raw = fs.readFileSync(file, "utf-8");
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private writeDataFile(file: string, data: unknown) {
    this.ensureDataDir();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
  }

  private readClientProfiles(): Record<string, any> {
    return this.readDataFile<Record<string, any>>(CLIENT_PROFILES_FILE, {});
  }

  private writeClientProfiles(profiles: Record<string, any>): void {
    this.writeDataFile(CLIENT_PROFILES_FILE, profiles);
  }

  private readAvailabilityMap(): Record<string, { defaults?: { start?: string; end?: string }; days: Record<string, DaySchedule> }> {
    const stored = this.readDataFile<unknown>(AVAILABILITY_FILE, {});
    const parsed = availabilitySchema.safeParse(stored);
    if (!parsed.success) {
      return {};
    }

    const result: Record<string, { defaults?: { start?: string; end?: string }; days: Record<string, DaySchedule> }> = {};
    for (const [masterId, value] of Object.entries(parsed.data)) {
      const defaults = (value as any)?.defaults as { start?: string; end?: string } | undefined;
      const dayEntries: Record<string, RawDayConfig> = "days" in (value as any) ? (value as any).days : (value as any);
      const normalizedDays: Record<string, DaySchedule> = {};
      for (const [date, cfg] of Object.entries(dayEntries)) {
        normalizedDays[date] = normalizeDayConfig(cfg as RawDayConfig);
      }
      result[masterId] = { defaults, days: normalizedDays };
    }
    return result;
  }

  async getMasterAvailability(masterId: string, ym?: string): Promise<{ days: Record<string, DaySchedule>; defaults?: { start?: string; end?: string } }> {
    await this.ensureReady();
    const availability = this.readAvailabilityMap();
    const record = availability[masterId] ?? { days: {} };
    const days = record.days ?? {};
    if (!ym || !MONTH_KEY_REGEX.test(ym)) {
      return { days, defaults: record.defaults };
    }
    const prefix = `${ym}-`;
    return {
      days: Object.fromEntries(Object.entries(days).filter(([date]) => date.startsWith(prefix))),
      defaults: record.defaults,
    };
  }

  async updateMasterAvailability(
    masterId: string,
    updates: Record<string, DaySchedule>,
    ym?: string,
    defaults?: { start?: string; end?: string },
  ): Promise<{ days: Record<string, DaySchedule>; defaults?: { start?: string; end?: string } }> {
    await this.ensureReady();
    const availability = this.readAvailabilityMap();
    const current = availability[masterId]?.days ?? {};
    const defaultHours = availability[masterId]?.defaults ?? {};

    for (const [dateKey, value] of Object.entries(updates)) {
      if (!DAY_KEY_REGEX.test(dateKey)) continue;
      try {
        const parsed = rawDayConfigSchema.parse(value);
        current[dateKey] = normalizeDayConfig(parsed);
      } catch {
        continue;
      }
    }

    if (defaults) {
      if (defaults.start && TIME_REGEX.test(defaults.start)) defaultHours.start = defaults.start;
      if (defaults.end && TIME_REGEX.test(defaults.end)) defaultHours.end = defaults.end;
    }

    availability[masterId] = { days: current, defaults: defaultHours };
    this.writeDataFile(AVAILABILITY_FILE, availability);

    if (ym && MONTH_KEY_REGEX.test(ym)) {
      const prefix = `${ym}-`;
      return {
        days: Object.fromEntries(Object.entries(current).filter(([date]) => date.startsWith(prefix))),
        defaults: defaultHours,
      };
    }
    return { days: current, defaults: defaultHours };
  }

  private deleteUploadIfLocal(url?: string | null) {
    if (!url || !url.startsWith("/uploads/")) return;
    const fullPath = path.join(process.cwd(), url);
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch {
      // ignore errors removing assets
    }
  }

  private async ensureReady() { await this.ready; }

  private mapMaster(row: typeof mastersTable.$inferSelect): Master {
    return masterSchema.parse({
      id: row.id,
      name: row.name,
      nickname: row.nickname,
      telegram: optional(row.telegram),
      specialization: row.specialization,
      avatar: optional(row.avatar),
      teletypeUrl: optional(row.teletypeUrl),
      isActive: row.isActive,
    });
  }

  private mapService(row: typeof servicesTable.$inferSelect): Service {
    return serviceSchema.parse({
      id: row.id,
      name: row.name,
      duration: row.duration,
      price: row.price,
      description: row.description ?? "",
    });
  }

  private mapMessage(row: typeof botMessagesTable.$inferSelect): BotMessage {
    return botMessageSchema.parse({
      id: row.id,
      key: row.key,
      label: row.label,
      value: row.value,
      type: row.type as BotMessage["type"],
      imageUrl: row.imageUrl,
    });
  }

  private mapPortfolio(row: typeof portfolioTable.$inferSelect): PortfolioItem {
    const attachments = (() => {
      const raw = (row as any)?.attachments;
      if (!raw) return [];
      try {
        if (Array.isArray(raw)) return raw as any[];
        if (typeof raw === "string") return JSON.parse(raw);
        return [];
      } catch {
        return [];
      }
    })();
    return portfolioItemSchema.parse({
      id: row.id,
      url: row.url,
      title: row.title,
      description: row.description ?? "",
      masterId: optional(row.masterId),
      style: optional(row.style),
      mediaType: (row.mediaType as PortfolioItem["mediaType"]) ?? "image",
      thumbnail: optional(row.thumbnail),
      attachments,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : (row.createdAt as string | undefined),
    });
  }

  private normalizeBooking(row: BookingRow): Booking {
    const timeValue = row.time.length > 5 ? row.time.slice(0, 5) : row.time;
    return bookingSchema.parse({
      id: row.id,
      clientName: row.clientName,
      clientPhone: row.clientPhone,
      clientTelegram: optional(row.clientTelegram),
      clientUsername: optional(row.clientUsername),
      telegramId: optional(row.telegramId),
      masterId: row.masterId,
      masterName: row.masterNickname ?? row.masterName ?? "",
      masterTelegram: optional(row.masterTelegram),
      serviceId: row.serviceId,
      service: row.serviceName ?? "",
      date: row.date,
      time: timeValue,
      duration: row.duration,
      status: row.status as Booking["status"],
      notes: optional(row.notes),
    });
  }

  private async getBookingById(id: string): Promise<Booking | undefined> {
    const rows = await this.database
      .select({
        id: bookingsTable.id,
        clientName: bookingsTable.clientName,
        clientPhone: bookingsTable.clientPhone,
        clientTelegram: bookingsTable.clientTelegram,
        clientUsername: bookingsTable.clientUsername,
        telegramId: bookingsTable.telegramId,
        masterId: bookingsTable.masterId,
        serviceId: bookingsTable.serviceId,
        date: bookingsTable.date,
        time: bookingsTable.time,
        duration: bookingsTable.duration,
        status: bookingsTable.status,
        notes: bookingsTable.notes,
        masterName: mastersTable.name,
        masterNickname: mastersTable.nickname,
        masterTelegram: mastersTable.telegram,
        serviceName: servicesTable.name,
      })
      .from(bookingsTable)
      .leftJoin(mastersTable, eq(bookingsTable.masterId, mastersTable.id))
      .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .where(eq(bookingsTable.id, id))
      .limit(1);

    if (rows.length === 0) return undefined;
    return this.normalizeBooking(rows[0]);
  }

  private async isSlotAvailable(
    masterId: string,
    date: string,
    time: string,
    duration: number,
    ignoreBookingId?: string,
  ): Promise<boolean> {
    const normalizedTime = time.length > 5 ? time.slice(0, 5) : time;
    const available = await this.getAvailableSlots(masterId, date, duration, ignoreBookingId);
    return available.includes(normalizedTime);
  }

  async listMasters(): Promise<Master[]> {
    await this.ensureReady();
    const rows = await this.database.select().from(mastersTable).orderBy(asc(mastersTable.name));
    return rows.map((row) => this.mapMaster(row));
  }

  async upsertClientProfile(profile: {
    telegramId?: string | number | null;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  }): Promise<void> {
    await this.ensureReady();
    const cleanedUsername = profile.username ? String(profile.username).replace(/^@/, "").trim() : undefined;
    const cleanedTelegramId =
      profile.telegramId !== undefined && profile.telegramId !== null ? String(profile.telegramId) : undefined;

    const key = cleanedTelegramId ? `id:${cleanedTelegramId}` : cleanedUsername ? `u:${cleanedUsername.toLowerCase()}` : null;
    if (!key) return;

    const profiles = this.readClientProfiles();
    const existing = profiles[key] ?? {};

    profiles[key] = {
      ...existing,
      telegramId: cleanedTelegramId ?? existing.telegramId ?? null,
      username: cleanedUsername ?? existing.username ?? null,
      firstName: profile.firstName ?? existing.firstName ?? null,
      lastName: profile.lastName ?? existing.lastName ?? null,
      phone: profile.phone ?? existing.phone ?? null,
      updatedAt: new Date().toISOString(),
      createdAt: existing.createdAt ?? new Date().toISOString(),
    };

    this.writeClientProfiles(profiles);
  }

  async listActiveMasters(): Promise<Master[]> {
    await this.ensureReady();
    const rows = await this.database
      .select()
      .from(mastersTable)
      .where(eq(mastersTable.isActive, true))
      .orderBy(asc(mastersTable.name));
    return rows.map((row) => this.mapMaster(row));
  }

  async createMaster(input: InsertMaster): Promise<Master> {
    await this.ensureReady();
    const data = insertMasterSchema.parse(input);
    const master = masterSchema.parse({ id: randomUUID(), ...data });
    await this.database.insert(mastersTable).values({
      id: master.id,
      name: master.name,
      nickname: master.nickname,
      telegram: master.telegram ?? null,
      specialization: master.specialization,
      avatar: master.avatar ?? null,
      teletypeUrl: master.teletypeUrl ?? null,
      isActive: master.isActive,
    });
    return master;
  }

  async updateMaster(id: string, input: Partial<InsertMaster>): Promise<Master | undefined> {
    await this.ensureReady();
    const existing = await this.database
      .select()
      .from(mastersTable)
      .where(eq(mastersTable.id, id))
      .limit(1);

    if (existing.length === 0) return undefined;

    const merged = {
      id,
      name: input.name ?? existing[0].name,
      nickname: input.nickname ?? existing[0].nickname,
      telegram:
        input.telegram !== undefined ? (input.telegram ?? undefined) : optional(existing[0].telegram),
      specialization: input.specialization ?? existing[0].specialization,
      avatar: input.avatar !== undefined ? (input.avatar ?? undefined) : optional(existing[0].avatar),
      teletypeUrl:
        input.teletypeUrl !== undefined ? (input.teletypeUrl ?? undefined) : optional(existing[0].teletypeUrl),
      isActive: input.isActive ?? existing[0].isActive,
    } satisfies Master;

    const validated = masterSchema.parse(merged);

    await this.database
      .update(mastersTable)
      .set({
        name: validated.name,
        nickname: validated.nickname,
        telegram: validated.telegram ?? null,
        specialization: validated.specialization,
        avatar: validated.avatar ?? null,
        teletypeUrl: validated.teletypeUrl ?? null,
        isActive: validated.isActive,
      })
      .where(eq(mastersTable.id, id));

    return validated;
  }

  async deleteMaster(id: string): Promise<boolean> {
    await this.ensureReady();
    const result = await this.database.delete(mastersTable).where(eq(mastersTable.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async listServices(): Promise<Service[]> {
    await this.ensureReady();
    const rows = await this.database.select().from(servicesTable).orderBy(asc(servicesTable.name));
    return rows.map((row) => this.mapService(row));
  }

  async createService(input: InsertService): Promise<Service> {
    await this.ensureReady();
    const data = insertServiceSchema.parse(input);
    const service = serviceSchema.parse({ id: randomUUID(), ...data });
    await this.database.insert(servicesTable).values(service);
    return service;
  }

  async updateService(id: string, input: Partial<InsertService>): Promise<Service | undefined> {
    await this.ensureReady();
    const existing = await this.database
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.id, id))
      .limit(1);

    if (existing.length === 0) return undefined;

    const merged = {
      id,
      name: input.name ?? existing[0].name,
      duration: input.duration ?? existing[0].duration,
      price: input.price ?? existing[0].price,
      description: input.description ?? existing[0].description,
    } satisfies Service;

    const validated = serviceSchema.parse(merged);

    await this.database
      .update(servicesTable)
      .set({
        name: validated.name,
        duration: validated.duration,
        price: validated.price,
        description: validated.description,
      })
      .where(eq(servicesTable.id, id));

    return validated;
  }

  async deleteService(id: string): Promise<boolean> {
    await this.ensureReady();
    const result = await this.database.delete(servicesTable).where(eq(servicesTable.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async listBookings(): Promise<Booking[]> {
    await this.ensureReady();
    const rows = await this.database
      .select({
        id: bookingsTable.id,
        clientName: bookingsTable.clientName,
        clientPhone: bookingsTable.clientPhone,
        clientTelegram: bookingsTable.clientTelegram,
        clientUsername: bookingsTable.clientUsername,
        telegramId: bookingsTable.telegramId,
        masterId: bookingsTable.masterId,
        serviceId: bookingsTable.serviceId,
        date: bookingsTable.date,
        time: bookingsTable.time,
        duration: bookingsTable.duration,
        status: bookingsTable.status,
        notes: bookingsTable.notes,
        masterName: mastersTable.name,
        masterNickname: mastersTable.nickname,
        masterTelegram: mastersTable.telegram,
        serviceName: servicesTable.name,
      })
      .from(bookingsTable)
      .leftJoin(mastersTable, eq(bookingsTable.masterId, mastersTable.id))
      .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .orderBy(desc(bookingsTable.date), desc(bookingsTable.time), desc(bookingsTable.createdAt));

    return rows.map((row) => this.normalizeBooking(row));
  }

  async createBooking(input: InsertBooking): Promise<Booking> {
    await this.ensureReady();
    const payload = insertBookingSchema.parse({ ...input, status: input.status ?? "pending" });

    const cleanedUsername = (payload.clientUsername ?? payload.clientTelegram ?? "").replace(/^@/, "");
    const cleanedTelegramId = payload.telegramId ? String(payload.telegramId) : undefined;

// Prevent multiple active future bookings by the same user (by telegram or phone)
try {
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const hh = String(now.getHours()).padStart(2,"0");
  const mm = String(now.getMinutes()).padStart(2,"0");
  const nowTime = hh + ":" + mm;

      const byClient = await this.database
        .select()
        .from(bookingsTable)
        .where(and(
          or(
            cleanedTelegramId ? eq(bookingsTable.telegramId, cleanedTelegramId) : sql`1=0`,
            cleanedUsername ? eq(bookingsTable.clientUsername, cleanedUsername) : sql`1=0`,
            payload.clientTelegram ? eq(bookingsTable.clientTelegram, payload.clientTelegram) : sql`1=0`,
            payload.clientPhone ? eq(bookingsTable.clientPhone, payload.clientPhone) : sql`1=0`
          ),
          ne(bookingsTable.status, "cancelled")
        ));

  const hasActive = byClient.some((b: any) => {
    const d = String(b.date);
    const t = typeof b.time === "string" ? b.time.slice(0,5) : String(b.time);
    return (d > today) || (d === today && t >= nowTime);
  });

  if (hasActive) {
    throw new Error("У вас уже есть активная запись. Сначала завершите/отмените текущую.");
  }
} catch (e) {
  // if anything goes wrong, do not block creating; but above throws explicit error
}


    const serviceRows = await this.database
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.id, payload.serviceId))
      .limit(1);
    if (serviceRows.length === 0) throw new Error("Service not found");
    const duration = serviceRows[0].duration;

    if (!(await this.isSlotAvailable(payload.masterId, payload.date, payload.time, duration))) {
      throw new Error("Выбранное время занято. Пожалуйста, выберите другое время.");
    }

    await this.upsertClientProfile({
      telegramId: cleanedTelegramId,
      username: cleanedUsername || payload.clientTelegram,
      firstName: payload.clientName,
      phone: payload.clientPhone,
    });

    const bookingId = randomUUID();

    await this.database.insert(bookingsTable).values({
      id: bookingId,
      clientName: payload.clientName,
      clientPhone: payload.clientPhone,
      clientTelegram: payload.clientTelegram ? payload.clientTelegram.replace(/^@/, "") : null,
      clientUsername: cleanedUsername || null,
      telegramId: cleanedTelegramId ?? null,
      masterId: payload.masterId,
      serviceId: payload.serviceId,
      date: payload.date,
      time: payload.time,
      duration,
      status: (payload.status ?? "pending") as Booking["status"],
      notes: payload.notes ?? null,
    });

    const booking = await this.getBookingById(bookingId);
    if (!booking) throw new Error("Failed to create booking");
    return booking;
  }

  async updateBooking(id: string, input: Partial<InsertBooking>): Promise<Booking | undefined> {
    await this.ensureReady();
    const existing = await this.database
      .select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, id))
      .limit(1);

    if (existing.length === 0) return undefined;

    const current = existing[0];

    const cleanedTelegram =
      input.clientTelegram !== undefined
        ? input.clientTelegram
          ? input.clientTelegram.replace(/^@/, "")
          : null
        : current.clientTelegram;
    const cleanedUsername =
      input.clientUsername !== undefined
        ? (input.clientUsername ?? input.clientTelegram ?? "").replace(/^@/, "") || null
        : current.clientUsername;
    const cleanedTelegramId =
      input.telegramId !== undefined
        ? input.telegramId !== null && input.telegramId !== undefined
          ? String(input.telegramId)
          : null
        : current.telegramId;

    const masterId = input.masterId ?? current.masterId;
    const serviceId = input.serviceId ?? current.serviceId;
    const date = input.date ?? current.date;
    const time = input.time ?? (typeof current.time === "string" ? current.time.slice(0, 5) : current.time);

    const serviceRows = await this.database
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .limit(1);
    if (serviceRows.length === 0) throw new Error("Service not found");
    const duration = serviceRows[0].duration;

    if (!(await this.isSlotAvailable(masterId, date, time, duration, id))) {
      throw new Error("Выбранное время занято. Пожалуйста, выберите другое время.");
    }

    await this.upsertClientProfile({
      telegramId: cleanedTelegramId,
      username: cleanedUsername ?? cleanedTelegram ?? undefined,
      firstName: input.clientName ?? current.clientName,
      phone: input.clientPhone ?? current.clientPhone,
    });

    const status = input.status ? bookingStatusSchema.parse(input.status) : (current.status as Booking["status"]);

    await this.database
      .update(bookingsTable)
      .set({
        clientName: input.clientName ?? current.clientName,
        clientPhone: input.clientPhone ?? current.clientPhone,
        clientTelegram: cleanedTelegram,
        clientUsername: cleanedUsername,
        telegramId: cleanedTelegramId,
        masterId,
        serviceId,
        date,
        time,
        duration,
        status,
        notes: input.notes !== undefined ? input.notes ?? null : current.notes,
      })
      .where(eq(bookingsTable.id, id));

    return this.getBookingById(id);
  }

  async deleteBooking(id: string): Promise<boolean> {
    await this.ensureReady();
    const result = await this.database.delete(bookingsTable).where(eq(bookingsTable.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async updateBookingStatus(
    id: string,
    status: "pending" | "confirmed" | "cancelled",
  ): Promise<Booking | undefined> {
    await this.ensureReady();
    const normalized = bookingStatusSchema.parse(status);
    const result = await this.database
      .update(bookingsTable)
      .set({ status: normalized })
      .where(eq(bookingsTable.id, id))
      .returning({ id: bookingsTable.id });

    if (result.length === 0) return undefined;
    return this.getBookingById(id);
  }

  async listMessages(): Promise<BotMessage[]> {
    await this.ensureReady();
    const rows = await this.database.select().from(botMessagesTable).orderBy(asc(botMessagesTable.label));
    return rows.map((row) => this.mapMessage(row));
  }

  async saveMessages(messages: BotMessage[]): Promise<BotMessage[]> {
    await this.ensureReady();
    const validated = z.array(botMessageSchema).parse(messages);

    await this.database.transaction(async (tx) => {
      for (const message of validated) {
        await tx
          .insert(botMessagesTable)
          .values({
            id: message.id,
            key: message.key,
            label: message.label,
            value: message.value,
            type: message.type,
            imageUrl: message.imageUrl ?? null,
          })
          .onConflictDoUpdate({
            target: botMessagesTable.id,
            set: {
              key: message.key,
              label: message.label,
              value: message.value,
              type: message.type,
              imageUrl: message.imageUrl ?? null,
            },
          });
      }
    });

    return this.listMessages();
  }

  async listClientSummaries(): Promise<ClientSummary[]> {
    await this.ensureReady();
    const rows = await this.database
      .select({
        clientName: bookingsTable.clientName,
        clientPhone: bookingsTable.clientPhone,
        clientTelegram: bookingsTable.clientTelegram,
        clientUsername: bookingsTable.clientUsername,
        telegramId: bookingsTable.telegramId,
        firstDate: sql<string>`min(${bookingsTable.date})`,
        lastDate: sql<string>`max(${bookingsTable.date})`,
        firstCreated: sql<string>`min(${bookingsTable.createdAt})`,
        lastCreated: sql<string>`max(${bookingsTable.createdAt})`,
        bookingsCount: sql<number>`count(*)`,
      })
      .from(bookingsTable)
      .groupBy(
        bookingsTable.clientName,
        bookingsTable.clientPhone,
        bookingsTable.clientTelegram,
        bookingsTable.clientUsername,
        bookingsTable.telegramId,
      )
      .orderBy(sql`max(${bookingsTable.createdAt}) DESC`);

    const toIso = (value: unknown, fallback?: string): string | undefined => {
      if (!value) return fallback;
      if (value instanceof Date) return value.toISOString();
      const str = String(value);
      if (!str) return fallback;
      const date = new Date(str);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        return new Date(`${str}T00:00:00Z`).toISOString();
      }
      return fallback;
    };

    const summaries = rows.map((row) => {
      const usernameField = optional(row.clientUsername)?.toString().trim();
      const rawTelegram = optional(row.clientTelegram)?.toString().trim();
      const username = (usernameField || rawTelegram)?.replace(/^@/, "") || undefined;
      const telegramId = optional(row.telegramId)?.toString().trim();
      const phone = row.clientPhone ? String(row.clientPhone).trim() : undefined;
      const name = row.clientName ? String(row.clientName).trim() : "Гость";

      const keySource =
        (telegramId ? `tgid:${telegramId}` : null) ||
        (username ? `tg:${username.toLowerCase()}` : null) ||
        (phone ? `ph:${phone.replace(/\D/g, "")}` : null) ||
        `name:${name.toLowerCase()}`;

      const id = createHash("sha1").update(keySource).digest("hex");

      const createdAt =
        toIso((row as any).firstCreated) ||
        toIso((row as any).firstDate) ||
        new Date().toISOString();
      const lastVisitAt =
        toIso((row as any).lastCreated) ||
        toIso((row as any).lastDate) ||
        undefined;

      return clientSummarySchema.parse({
        id,
        fullName: name,
        phone: phone ?? null,
        telegramId: telegramId ?? null,
        username: username ?? null,
        consentMarketing: false,
        tags: [],
        createdAt,
        lastVisitAt: lastVisitAt ?? null,
        bookingsCount: Number((row as any).bookingsCount ?? 0),
      });
    });

    const profiles = Object.values(this.readClientProfiles() ?? {});
    for (const profile of profiles) {
      const username = (profile as any)?.username ? String((profile as any).username).replace(/^@/, "") : undefined;
      const telegramId = (profile as any)?.telegramId ? String((profile as any).telegramId) : undefined;

      const exists = summaries.some((client) => {
        if (telegramId && client.telegramId && String(client.telegramId) === telegramId) return true;
        if (username && client.username && client.username.toLowerCase() === username.toLowerCase()) return true;
        return false;
      });

      if (!exists && (username || telegramId)) {
        summaries.push(
          clientSummarySchema.parse({
            id: createHash("sha1").update(telegramId ? `id:${telegramId}` : `user:${username}`).digest("hex"),
            fullName: (profile as any)?.firstName || (profile as any)?.lastName
              ? `${(profile as any)?.firstName ?? ""} ${(profile as any)?.lastName ?? ""}`.trim() || "Гость"
              : "Гость",
            phone: (profile as any)?.phone ? String((profile as any).phone) : null,
            telegramId: telegramId ?? null,
            username: username ?? null,
            consentMarketing: false,
            tags: [],
            createdAt: (profile as any)?.createdAt ?? new Date().toISOString(),
            lastVisitAt: null,
            bookingsCount: 0,
          }),
        );
      }
    }

    this.writeDataFile(CLIENTS_FILE, summaries);
    return summaries;
  }

  async listCertificates(): Promise<Certificate[]> {
    await this.ensureReady();
    const stored = this.readDataFile<unknown[]>(CERTS_FILE, []);
    const parsed = z.array(certificateSchema).safeParse(stored);
    if (!parsed.success) {
      return [];
    }
    return parsed.data.map((item) => ({
      ...item,
      caption: item.caption ?? item.description ?? null,
      description: item.description ?? item.caption ?? null,
    }));
  }

  async addCertificate(input: { url: string; type: "image" | "video"; caption?: string | null; description?: string | null }): Promise<Certificate> {
    await this.ensureReady();
    const existing = await this.listCertificates();
    const normalizedUrl = normalizeUploadUrl(input.url) || input.url;
    const payload = insertCertificateSchema.parse({
      url: normalizedUrl,
      type: input.type,
      caption: input.caption ? String(input.caption).trim() || undefined : undefined,
      description: input.description ? String(input.description).trim() || undefined : undefined,
    });

    const entry = certificateSchema.parse({
      id: randomUUID(),
      url: payload.url,
      type: payload.type,
      caption: payload.caption ?? payload.description ?? null,
      description: payload.description ?? payload.caption ?? null,
      uploadedAt: new Date().toISOString(),
    });

    const next = [entry, ...existing];
    this.writeDataFile(CERTS_FILE, next);
    return entry;
  }

  async removeCertificate(id: string): Promise<boolean> {
    await this.ensureReady();
    const existing = await this.listCertificates();
    const index = existing.findIndex((item) => item.id === id);
    if (index === -1) return false;
    const [removed] = existing.splice(index, 1);
    this.writeDataFile(CERTS_FILE, existing);
    this.deleteUploadIfLocal(removed?.url);
    return true;
  }

  async listPortfolio(): Promise<PortfolioItem[]> {
    await this.ensureReady();
    const rows = await this.database
      .select()
      .from(portfolioTable)
      .orderBy(desc(portfolioTable.createdAt), desc(portfolioTable.id));
    const out: PortfolioItem[] = [];
    for (const row of rows) {
      try {
        out.push(this.mapPortfolio(row));
      } catch (e: any) {
        if (e && String(e.message).includes("skip_invalid_portfolio")) continue;
      }
    }
    return out;
  }

  async listPortfolioByMaster(
    masterId: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<{ items: PortfolioItem[]; total: number; page: number; pageSize: number }> {
    await this.ensureReady();
    const offset = (page - 1) * pageSize;
    
    const [countResult] = await this.database
      .select({ count: sql<number>`count(*)` })
      .from(portfolioTable)
      .where(eq(portfolioTable.masterId, masterId));
    
    const rows = await this.database
      .select()
      .from(portfolioTable)
      .where(eq(portfolioTable.masterId, masterId))
      .orderBy(desc(portfolioTable.createdAt), desc(portfolioTable.id))
      .limit(pageSize)
      .offset(offset);
    
    const items: PortfolioItem[] = [];
    for (const row of rows) {
      try {
        items.push(this.mapPortfolio(row));
      } catch (e: any) {
        if (e && String(e.message).includes("skip_invalid_portfolio")) continue;
      }
    }
    
    return {
      items,
      total: Number(countResult?.count ?? 0),
      page,
      pageSize,
    };
  }

  async addPortfolioItem(input: Omit<PortfolioItem, "id">): Promise<PortfolioItem> {
    await this.ensureReady();
    const validated = portfolioItemSchema.omit({ id: true }).parse(input);
    const [row] = await this.database
      .insert(portfolioTable)
      .values({
        id: randomUUID(),
        url: validated.url,
        title: validated.title,
        description: validated.description ?? "",
        masterId: validated.masterId ?? null,
        style: validated.style ?? null,
        mediaType: validated.mediaType,
        thumbnail: validated.thumbnail ?? null,
        attachments: validated.attachments ?? [],
      })
      .returning();

    return this.mapPortfolio(row);
  }

  async removePortfolioItem(id: string): Promise<boolean> {
    await this.ensureReady();
    const result = await this.database.delete(portfolioTable).where(eq(portfolioTable.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getSettings(): Promise<Settings> {
    await this.ensureReady();
    const rows = await this.database
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, "default"))
      .limit(1);

    if (rows.length === 0) {
      return settingsSchema.parse(DEFAULT_SETTINGS);
    }

    return settingsSchema.parse({
      botToken: rows[0].botToken ?? "",
      studioName: rows[0].studioName,
      address: rows[0].address,
      yandexMapUrl: (rows[0] as any).yandexMapUrl ?? undefined,
      latitude: (rows[0] as any).latitude ?? undefined,
      longitude: (rows[0] as any).longitude ?? undefined,
      paymentMethods: rows[0].paymentMethods ?? "",
      workingHours: rows[0].workingHours ?? "",
    });
  }

  async saveSettings(settings: Settings): Promise<Settings> {
    await this.ensureReady();
    const validated = settingsSchema.parse(settings);

    await this.database
      .insert(settingsTable)
      .values({
        id: "default",
        botToken: validated.botToken,
        studioName: validated.studioName,
        address: validated.address,
        yandexMapUrl: (validated as any).yandexMapUrl ?? null,
        latitude: (validated as any).latitude ?? null,
        longitude: (validated as any).longitude ?? null,
        paymentMethods: validated.paymentMethods,
        workingHours: validated.workingHours,
      })
      .onConflictDoUpdate({
        target: settingsTable.id,
        set: {
          botToken: validated.botToken,
          studioName: validated.studioName,
          address: validated.address,
          yandexMapUrl: (validated as any).yandexMapUrl ?? null,
          latitude: (validated as any).latitude ?? null,
          longitude: (validated as any).longitude ?? null,
          paymentMethods: validated.paymentMethods,
          workingHours: validated.workingHours,
          updatedAt: new Date(),
        },
      });

    return validated;
  }

  async dashboardSummary() {
    await this.ensureReady();
    const [bookings, clientSummaries, certificates, portfolio] = await Promise.all([
      this.listBookings(),
      this.listClientSummaries(),
      this.listCertificates(),
      this.listPortfolio(),
    ]);
    const today = new Date().toISOString().split("T")[0];
    const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const bookingsToday = bookings.filter(
      (b) => b.date === today && b.status !== "cancelled",
    ).length;

    const pendingBookings = bookings.filter((b) => b.status === "pending").length;
    const cancelledWeek = bookings.filter((b) => b.status === "cancelled" && b.date >= sevenDaysAgo).length;

    const newClientsWeek = clientSummaries.filter((client) => {
      const created = client.createdAt?.slice(0, 10) ?? "";
      return created >= sevenDaysAgo;
    }).length;

    const returningClientsWeek = clientSummaries.filter((client) => {
      if (!client.lastVisitAt || client.bookingsCount < 2) return false;
      return client.lastVisitAt.slice(0, 10) >= sevenDaysAgo;
    }).length;

    const activeMastersCount = await this.database
      .select({ id: mastersTable.id })
      .from(mastersTable)
      .where(eq(mastersTable.isActive, true));

    const revenueRows = await this.database
      .select({
        date: bookingsTable.date,
        time: bookingsTable.time,
        status: bookingsTable.status,
        price: servicesTable.price,
      })
      .from(bookingsTable)
      .innerJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .where(and(gte(bookingsTable.date, sevenDaysAgo), eq(bookingsTable.status, "confirmed")));

    const revenueWeek = revenueRows.reduce((total, row) => total + row.price, 0);

    const averageDuration = bookings.length
      ? bookings.reduce((sum, b) => sum + b.duration, 0) / bookings.length
      : 0;

    const recentBookings = bookings
      .slice()
      .sort((a, b) => {
        const aDate = new Date(`${a.date}T${a.time}:00`).getTime();
        const bDate = new Date(`${b.date}T${b.time}:00`).getTime();
        return bDate - aDate;
      })
      .slice(0, 5);

    return {
      stats: {
        bookingsToday,
        activeMasters: activeMastersCount.length,
        revenueWeek,
        averageDuration,
        pendingBookings,
        cancelledWeek,
        newClientsWeek,
        returningClientsWeek,
        certificatesCount: certificates.length,
        portfolioCount: portfolio.length,
        clientsTotal: clientSummaries.length,
      },
      recentBookings,
    };
  }

  
  async getAvailabilityCalendar(serviceId: string, days: number, startDate?: string): Promise<{ date: string; available: boolean }[]> {
    await this.ensureReady();
    const service = await this.database
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .limit(1);
    if (service.length === 0) {
      throw new Error("Service not found");
    }

    const duration = service[0].duration;
    const masters = await this.listActiveMasters();
    const start = startDate ? new Date(`${startDate}T00:00:00Z`) : new Date();

    const result: { date: string; available: boolean }[] = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = day.toISOString().slice(0, 10);
      let available = false;
      for (const master of masters) {
        const slots = await this.getAvailableSlots(master.id, dateStr, duration);
        if (slots.length > 0) {
          available = true;
          break;
        }
      }
      result.push({ date: dateStr, available });
    }

    return result;
  }

  async getMastersForSlot(serviceId: string, date: string, time: string): Promise<Master[]> {
    await this.ensureReady();
    const service = await this.database
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.id, serviceId))
      .limit(1);
    if (service.length === 0) {
      throw new Error("Service not found");
    }

    const duration = service[0].duration;
    const masters = await this.listActiveMasters();
    const available: Master[] = [];

    for (const master of masters) {
      if (await this.isSlotAvailable(master.id, date, time, duration)) {
        available.push(master);
      }
    }

    return available;
  }

  async getAvailableSlots(
    masterId: string,
    date: string,
    duration: number,
    ignoreBookingId?: string,
  ): Promise<string[]> {
    await this.ensureReady();
    const stepMinutes = 30;
    const slots: string[] = [];

    // read per-day availability
    const monthKey = date.slice(0,7);
    const { days: dayMap, defaults } = await this.getMasterAvailability(masterId, monthKey);
    const dayCfg = dayMap[date];
    if (!dayCfg || dayCfg.isWorking === false) return [];

    const workStart = dayCfg?.start || defaults?.start || "10:00";
    const workEnd   = dayCfg?.end   || defaults?.end   || "22:00";

    const conditions = [
      eq(bookingsTable.masterId, masterId),
      eq(bookingsTable.date, date),
      ne(bookingsTable.status, "cancelled"),
    ];
    if (ignoreBookingId) {
      conditions.push(ne(bookingsTable.id, ignoreBookingId));
    }

    const existing = await this.database
      .select({ time: bookingsTable.time, duration: bookingsTable.duration })
      .from(bookingsTable)
      .where(and(...conditions));

    const [whsH, whsM] = workStart.split(":").map(n => parseInt(n,10));
    const [wheH, wheM] = workEnd.split(":").map(n => parseInt(n,10));

    for (let hour = whsH; hour <= wheH; hour++) {
      for (let minute = (hour === whsH ? whsM : 0); minute < 60; minute += stepMinutes) {
        const time = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        const slotToInsert = formatSlot(date, time, duration);

        // ensure slot finishes before workEnd
        const endH = slotToInsert.end.getHours();
        const endM = slotToInsert.end.getMinutes();
        if (endH > wheH || (endH === wheH && endM > wheM)) continue;

        const available = existing.every((booking) => {
          const slot = formatSlot(
            date,
            booking.time.length > 5 ? booking.time.slice(0, 5) : booking.time,
            booking.duration,
          );
          return slotToInsert.end <= slot.start || slotToInsert.start >= slot.end;
        });

        if (available) slots.push(time);
      }
    }
    return slots;
  }
}

let _storage: DatabaseStorage | null = null;
export function getStorage(): DatabaseStorage {
  if (!_storage) _storage = new DatabaseStorage();
  return _storage;
}
