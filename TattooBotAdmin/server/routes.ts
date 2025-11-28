import type { Express, RequestHandler } from "express";
import { Router } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import multer from "multer";
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";
import { execFile as execFileCb } from "child_process";
import { getStorage } from "./storage";
import { botManager } from "./botManager";
function normalizeUrl(url?: string | null): string | undefined {
  if (url === undefined || url === null) return undefined;
  let v = String(url).trim();
  if (!v) return undefined;
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  return v;
}

import {
  insertMasterSchema,
  insertServiceSchema,
  insertBookingSchema,
  bookingStatusSchema,
  botMessageSchema,
  settingsSchema,
  insertCertificateSchema,
  type BotAction,
} from "@shared/schema";
import portfolioRouter from "./routes/portfolio";
import botRouter from "./routes/bot";
import { attachNotificationRoutes } from "./routes.notify";
import { attachStatsRoutes } from "./routes.stats";

const upload = multer({ storage: multer.memoryStorage() });
const execFile = promisify(execFileCb);

const asyncHandler = (handler: RequestHandler): RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};

function formatDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

const dayConfigSchema = z.object({
  isWorking: z.boolean(),
  start: z.string().optional(),
  end: z.string().optional(),
  note: z.string().optional().nullable(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  const api = Router();
  const storage = getStorage();
  attachStatsRoutes(api);
  attachNotificationRoutes(api);

  const botEnvFile = process.env.BOT_ENV_FILE || path.resolve(process.cwd(), "bot-config/bot.env");
  const skipBotRestart = process.env.SKIP_BOT_RESTART_SCRIPT === "1";

  const persistBotToken = (token: string) => {
    try {
      fs.mkdirSync(path.dirname(botEnvFile), { recursive: true });
      fs.writeFileSync(botEnvFile, `TELEGRAM_BOT_TOKEN=${token ?? ""}\n`, "utf8");
      console.info(`[bot] token persisted to ${botEnvFile}`);
    } catch (error) {
      console.error("[bot] failed to write bot env file", botEnvFile, error);
    }
  };

  // === TELEGRAM notify helper ===
  const applyPlaceholders = (text: string, replacements: Record<string, string | undefined>): string => {
    return Object.entries(replacements).reduce(
      (acc, [key, value]) => acc.replace(new RegExp(`{${key}}`, "g"), value ?? ""),
      text,
    );
  };

  async function resolveBotMessage(key: string): Promise<string | undefined> {
    try {
      const messages = await storage.listMessages();
      const found = messages.find((msg) => msg.key === key);
      if (!found) return undefined;
      return botMessageSchema.parse(found).value;
    } catch (error) {
      console.warn("[notify] failed to load bot message", key, error);
      return undefined;
    }
  }

  async function notifyTelegramOnStatus(booking: any, storage: ReturnType<typeof getStorage>) {
    try {
      if (!booking) return;
      const settings = await storage.getSettings();
      const token = (settings as any)?.botToken || process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN;
      if (!token) { console.warn("[notify] missing botToken"); return; }

      const mapFile = path.join(process.cwd(), "data", "notifications.json");
      let map: any = {}; try { map = JSON.parse(fs.readFileSync(mapFile, "utf-8")); } catch {}
      const rec = map[booking.id] || {};
      const chatId = rec.chatId || booking.telegramId;
      if (chatId && !rec.chatId) { rec.chatId = chatId; }
      if (!chatId) { console.warn("[notify] no chatId for booking", booking.id); return; }

      const dd = String(booking.date || "").split("-");
      const when = (dd.length===3 ? `${dd[2]}.${dd[1]}.${dd[0]}` : String(booking.date||"")) + (booking.time ? ` • ${booking.time}` : "");
      const address = (settings as any)?.address || "";
      const mapUrl = (settings as any)?.yandexMapUrl || "";
      const masterContact = (booking.masterTelegram ? `@${String(booking.masterTelegram).replace(/^@/, "")}` : "").trim();

      const replacements = {
        service: booking.service || "",
        master: booking.masterName || "",
        date: dd.length === 3 ? `${dd[2]}.${dd[1]}.${dd[0]}` : String(booking.date || ""),
        time: booking.time || "",
        address,
        master_contact: masterContact || "",
      };

      let text = "";
      switch (booking.status) {
        case "confirmed":
          text =
            applyPlaceholders(
              (await resolveBotMessage("booking_confirmed")) ??
                "✅ Запись подтверждена!\n\nУслуга: {service}\nМастер: {master}\nДата и время: {date} • {time}\nАдрес: {address}\n\n✅ Не забудь добавить в контакты. Напиши, если нужна помощь с маршрутом.\n{master_contact}",
              replacements,
            ) +
            (mapUrl ? `\nКак добраться: ${mapUrl}` : "");
          rec.confirmationSent = true;
          break;
        case "cancelled":
          text = `❌ Запись отменена.\n\nУслуга: ${booking.service || ""}\nМастер: ${booking.masterName || ""}\nДата и время: ${when}`;
          break;
        default:
          return;
      }

      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      map[booking.id] = rec;
      try {
        fs.mkdirSync(path.dirname(mapFile), { recursive: true });
        fs.writeFileSync(mapFile, JSON.stringify(map, null, 2), "utf-8");
      } catch {}
    } catch (e) {
      console.warn("notifyTelegramOnStatus failed", e);
    }
  }

  async function notifyMasterOnNewBooking(booking: any, storage: ReturnType<typeof getStorage>) {
    const logPrefix = "[notify-master]";
    try {
      if (!booking) return;

      const settings = await storage.getSettings();
      const token = (settings as any)?.botToken || process.env.BOT_TOKEN || process.env.TELEGRAM_TOKEN;
      if (!token) {
        console.warn(`${logPrefix} missing botToken`);
        return;
      }

      // Подтягиваем Telegram мастера из брони или из справочника, чтобы не пропустить уведомление.
      let masterHandle = (booking.masterTelegram ?? "").trim();
      if (!masterHandle && booking.masterId) {
        try {
          const masters = await storage.listMasters();
          masterHandle = masters.find((m) => m.id === booking.masterId)?.telegram?.trim() ?? "";
        } catch (err) {
          console.warn(`${logPrefix} failed to load master list`, err);
        }
      }

      const savedChat = booking.masterId ? await storage.getMasterChat(booking.masterId) : undefined;

      if (!masterHandle && !savedChat?.chatId) {
        console.warn(`${logPrefix} master has no telegram`, booking.masterId);
        return;
      }

      let chatId: string | number = savedChat?.chatId ??
        (masterHandle.startsWith("@") ? masterHandle : `@${masterHandle}`);
      console.log(`${logPrefix} resolving chat`, { masterId: booking.masterId, chatId, masterHandle, savedChat });
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
      console.warn("notifyMasterOnNewBooking failed", e);
    }
  }


  api.get(
    "/health",
    asyncHandler(async (_req, res) => {
      res.json({ status: "ok" });
    }),
  );

  api.get(
    "/masters",
    asyncHandler(async (_req, res) => {
      const masters = await storage.listMasters();
      res.json({ masters });
    }),
  );

  api.get(
    "/masters/:id/availability",
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const { ym } = z.object({ ym: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(req.query);
      const { days, defaults } = await storage.getMasterAvailability(id, ym);
      res.json({ days, defaults });
    }),
  );

  api.post(
    "/masters/:id/availability",
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const payload = z
        .object({
          ym: z.string().regex(/^\d{4}-\d{2}$/).optional(),
          update: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), dayConfigSchema),
          defaults: z
            .object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional() })
            .partial()
            .optional(),
        })
        .parse(req.body ?? {});
      const { days, defaults } = await storage.updateMasterAvailability(id, payload.update, payload.ym, payload.defaults);
      res.json({ days, defaults });
    }),
  );

  api.post(
    "/masters",
    asyncHandler(async (req, res) => {
      const raw = { ...(req.body ?? {}) } as Record<string, unknown>;
      if ("teletypeUrl" in raw) {
        raw.teletypeUrl = normalizeUrl(raw.teletypeUrl as string | null | undefined);
      }
      const payload = insertMasterSchema.parse(raw);
      const master = await storage.createMaster(payload);
      res.status(201).json({ master });
    }),
  );

  api.put(
    "/masters/:id",
    asyncHandler(async (req, res) => {
      const raw = { ...(req.body ?? {}) } as Record<string, unknown>;
      if ("teletypeUrl" in raw) {
        raw.teletypeUrl = normalizeUrl(raw.teletypeUrl as string | null | undefined);
      }
      const payload = insertMasterSchema.partial().parse(raw);
      const master = await storage.updateMaster(req.params.id, payload);
      if (!master) {
        return res.status(404).json({ message: "Мастер не найден" });
      }
      res.json({ master });
    }),
  );

  api.delete(
    "/masters/:id",
    asyncHandler(async (req, res) => {
      const removed = await storage.deleteMaster(req.params.id);
      if (!removed) {
        return res.status(404).json({ message: "Мастер не найден" });
      }
      res.status(204).send();
    }),
  );

  api.get(
    "/services",
    asyncHandler(async (_req, res) => {
      const services = await storage.listServices();
      res.json({ services });
    }),
  );

  api.post(
    "/services",
    asyncHandler(async (req, res) => {
      const payload = insertServiceSchema.parse(req.body);
      const service = await storage.createService(payload);
      res.status(201).json({ service });
    }),
  );

  api.put(
    "/services/:id",
    asyncHandler(async (req, res) => {
      const payload = insertServiceSchema.partial().parse(req.body);
      const service = await storage.updateService(req.params.id, payload);
      if (!service) {
        return res.status(404).json({ message: "Услуга не найдена" });
      }
      res.json({ service });
    }),
  );

  api.delete(
    "/services/:id",
    asyncHandler(async (req, res) => {
      const removed = await storage.deleteService(req.params.id);
      if (!removed) {
        return res.status(404).json({ message: "Услуга не найдена" });
      }
      res.status(204).send();
    }),
  );

  api.get(
    "/bookings",
    asyncHandler(async (_req, res) => {
      const bookings = await storage.listBookings();
      res.json({ bookings });
    }),
  );

  api.post(
    "/bookings",
    asyncHandler(async (req, res) => {
      const payload = insertBookingSchema.parse(req.body);
      const booking = await storage.createBooking(payload);
      res.status(201).json({ booking });
      notifyMasterOnNewBooking(booking, storage);
    }),
  );

  api.put(
    "/bookings/:id",
    asyncHandler(async (req, res) => {
      const payload = insertBookingSchema.partial().parse(req.body);
      const booking = await storage.updateBooking(req.params.id, payload);
      if (!booking) {
        return res.status(404).json({ message: "Запись не найдена" });
      }
      res.json({ booking });
    }),
  );

  api.patch(
    "/bookings/:id/status",
    asyncHandler(async (req, res) => {
      const { status } = z.object({ status: bookingStatusSchema }).parse(req.body);
      const booking = await storage.updateBookingStatus(req.params.id, status);
      if (!booking) { return res.status(404).json({ message: "Запись не найдена" }); }
      res.json({ booking });
      notifyTelegramOnStatus(booking, storage);
    }),
  );

  api.delete(
    "/bookings/:id",
    asyncHandler(async (req, res) => {
      const removed = await storage.deleteBooking(req.params.id);
      if (!removed) {
        return res.status(404).json({ message: "Запись не найдена" });
      }
      res.status(204).send();
    }),
  );

  api.get(
    "/availability",
    asyncHandler(async (req, res) => {
      const params = z
        .object({
          masterId: z.string().min(1),
          serviceId: z.string().min(1),
          date: z.string().regex(/\d{4}-\d{2}-\d{2}/),
        })
        .parse(req.query);
      const services = await storage.listServices();
      const service = services.find((item) => item.id === params.serviceId);
      if (!service) {
        return res.status(404).json({ message: "Услуга не найдена" });
      }
      const slots = await storage.getAvailableSlots(params.masterId, params.date, service.duration);
      res.json({ slots });
    }),
  );

  api.get(
    "/messages",
    asyncHandler(async (_req, res) => {
      const messages = await storage.listMessages();
      res.json({ messages });
    }),
  );

  api.put(
    "/messages",
    asyncHandler(async (req, res) => {
      const { messages } = z
        .object({
          messages: z.array(botMessageSchema),
        })
        .parse(req.body);
      const saved = await storage.saveMessages(messages);
      res.json({ messages: saved });
    }),
  );

  api.get(
    "/clients",
    asyncHandler(async (_req, res) => {
      const clients = await storage.listClientSummaries();
      res.json({ clients });
    }),
  );

  api.get(
    "/clients/export",
    asyncHandler(async (req, res) => {
      const { fmt } = z
        .object({ fmt: z.enum(["xlsx", "csv"]).default("xlsx") })
        .parse(req.query);

      const clients = await storage.listClientSummaries();
      const rows = clients.map((client) => ({
        Имя: client.fullName,
        Телеграм: client.username ? `@${client.username}` : "",
        Телефон: client.phone ?? "",
        Теги: (client.tags ?? []).join(", "),
        Создан: client.createdAt?.slice(0, 10) ?? "",
        Последний_визит: client.lastVisitAt?.slice(0, 10) ?? "",
        Записей: client.bookingsCount ?? 0,
      }));

      if (fmt === "csv") {
        const header = Object.keys(
          rows[0] ?? {
            Имя: "",
            Телеграм: "",
            Телефон: "",
            Теги: "",
            Создан: "",
            Последний_визит: "",
            Записей: 0,
          },
        );
        const lines = [header.join(";")].concat(
          rows.map((row) => header.map((key) => String((row as any)[key] ?? "")).join(";")),
        );
        const csv = "\uFEFF" + lines.join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=clients.csv");
        return res.send(csv);
      }

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Clients");
      const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", "attachment; filename=clients.xlsx");
      return res.send(buffer);
    }),
  );

  api.get(
    "/settings",
    asyncHandler(async (_req, res) => {
      const settings = await storage.getSettings();
      res.json({ settings });
    }),
  );

  api.put(
    "/settings",
    asyncHandler(async (req, res) => {
      const payload = settingsSchema.parse(req.body);
      const previousSettings = await storage.getSettings();
      const settings = await storage.saveSettings(payload);

      if (settings.botToken !== previousSettings.botToken) {
        persistBotToken(settings.botToken ?? "");
      }

      let botRestarted = false;
      let botAction: BotAction = "none";
      let botRestartMessage: string | undefined;

      if (!skipBotRestart && settings.botToken !== previousSettings.botToken) {
        const result = await botManager.handleTokenChange(previousSettings.botToken, settings.botToken);
        botRestarted = result.triggered;
        botAction = result.action;
        botRestartMessage = result.message;

        if (botRestartMessage) {
          console[result.triggered ? "info" : "warn"](
            `[bot] ${botRestartMessage} (действие: ${botAction})`,
          );
        }
      }

      if (skipBotRestart && settings.botToken !== previousSettings.botToken) {
        botRestartMessage =
          botRestartMessage ??
          "Скрипт перезапуска отключён (SKIP_BOT_RESTART_SCRIPT=1). Перезапустите контейнеры вручную.";
      }

      res.json({ settings, botRestarted, botAction, botRestartMessage });
    }),
  );

  api.get(
    "/certs",
    asyncHandler(async (_req, res) => {
      const certs = await storage.listCertificates();
      res.json({ certs });
    }),
  );

  api.post(
    "/certs",
    asyncHandler(async (req, res) => {
      const payload = insertCertificateSchema.parse(req.body ?? {});
      const cert = await storage.addCertificate(payload);
      res.status(201).json({ cert });
    }),
  );

  api.delete(
    "/certs/:id",
    asyncHandler(async (req, res) => {
      const removed = await storage.removeCertificate(req.params.id);
      if (!removed) {
        return res.status(404).json({ message: "Акция не найдена" });
      }
      res.status(204).send();
    }),
  );

  api.use("/portfolio", portfolioRouter);
  api.use("/bot", botRouter);

  api.get(
    "/dashboard",
    asyncHandler(async (_req, res) => {
      const summary = await storage.dashboardSummary();
      res.json(summary);
    }),
  );

  api.post(
    "/excel/import",
    upload.single("file"),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ message: "Файл не найден" });
      }
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        return res.status(400).json({ message: "Лист в файле не найден" });
      }
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

      let imported = 0;
      let skipped = 0;

      const masters = await storage.listMasters();
      const services = await storage.listServices();

      for (const row of rows) {
        try {
          const masterName = String(row["Мастер"] || row["master"] || row["Master"] || "").trim();
          const serviceName = String(row["Услуга"] || row["service"] || row["Service"] || "").trim();
          const dateRaw = String(row["Дата"] || row["date"] || row["Date"] || "").trim();
          const time = String(row["Время"] || row["time"] || row["Time"] || "").trim();
          if (!masterName || !serviceName || !dateRaw || !time) {
            skipped++;
            continue;
          }
          let parsedDate: Date | undefined;
          if (dateRaw.includes(".")) {
            const [day, month, year] = dateRaw.split(".");
            parsedDate = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`);
          } else {
            parsedDate = new Date(dateRaw);
          }

          if (Number.isNaN(parsedDate.getTime())) {
            skipped++;
            continue;
          }

          const date = parsedDate.toISOString().split("T")[0];

          const master = masters.find(
            (item) =>
              item.nickname.toLowerCase() === masterName.toLowerCase() ||
              item.name.toLowerCase() === masterName.toLowerCase(),
          );
          const service = services.find((item) => item.name.toLowerCase() === serviceName.toLowerCase());
          if (!master || !service) {
            skipped++;
            continue;
          }

          const statusRaw = String(row["Статус"] || row["status"] || "pending").toLowerCase();
          const statusMap: Record<string, "pending" | "confirmed" | "cancelled"> = {
            pending: "pending",
            confirmed: "confirmed",
            cancelled: "cancelled",
            "подтверждена": "confirmed",
            "подтверждено": "confirmed",
            "подтвержден": "confirmed",
            "ожидает": "pending",
            "в обработке": "pending",
            "отменена": "cancelled",
            "отменено": "cancelled",
          };

          const normalizedStatus = statusMap[statusRaw] ?? "pending";

          await storage.createBooking({
            clientName: String(row["Клиент"] || row["client"] || row["Client"] || "Гость"),
            clientPhone: String(row["Телефон"] || row["phone"] || row["Phone"] || ""),
            clientTelegram: String(row["Telegram"] || row["tg"] || row["Телеграм"] || "").replace(/^@/, "") || undefined,
            masterId: master.id,
            serviceId: service.id,
            date,
            time,
            status: normalizedStatus,
          });
          imported++;
        } catch (error) {
          skipped++;
        }
      }

      res.json({ imported, skipped });
    }),
  );

  api.get(
    "/excel/export",
    asyncHandler(async (req, res) => {
      const params = z
        .object({
          from: z.string().regex(/\d{4}-\d{2}-\d{2}/).optional(),
          to: z.string().regex(/\d{4}-\d{2}-\d{2}/).optional(),
        })
        .parse(req.query);
      const bookings = await storage.listBookings();
      const filtered = bookings.filter((booking) => {
        if (params.from && booking.date < params.from) return false;
        if (params.to && booking.date > params.to) return false;
        return true;
      });

      const rows = filtered.map((booking) => ({
        Дата: formatDate(booking.date),
        Время: booking.time,
        Мастер: booking.masterName,
        Услуга: booking.service,
        Клиент: booking.clientName,
        Телефон: booking.clientPhone,
        Telegram: booking.clientTelegram ?? "",
        Статус: booking.status,
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Записи");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=bookings.xlsx");
      res.send(buffer);
    }),
  );

  const DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://postgres:postgres@db:5432/tattooadmin";
  const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");

  api.get(
    "/backup/export",
    asyncHandler(async (_req, res) => {
      const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tattoo-backup-"));
      const dumpPath = path.join(tmpRoot, "db.sql");
      const archivePath = path.join(os.tmpdir(), `tattoo-backup-${Date.now()}.tar.gz`);

      await execFile("pg_dump", ["--format=plain", "--no-owner", "--no-acl", `--dbname=${DATABASE_URL}`, "-f", dumpPath]);

      const dataDir = path.join(process.cwd(), "data");
      if (fs.existsSync(dataDir)) {
        await fs.promises.cp(dataDir, path.join(tmpRoot, "data"), { recursive: true });
      }

      if (fs.existsSync(UPLOAD_DIR)) {
        await fs.promises.cp(UPLOAD_DIR, path.join(tmpRoot, "uploads"), { recursive: true });
      }

      await fs.promises.writeFile(
        path.join(tmpRoot, "manifest.json"),
        JSON.stringify({ createdAt: new Date().toISOString() }, null, 2),
        "utf-8",
      );

      await execFile("tar", ["-czf", archivePath, "-C", tmpRoot, "."]);

      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", "attachment; filename=tattoobot-backup.tar.gz");
      const stream = fs.createReadStream(archivePath);
      stream.on("close", () => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
        fs.rmSync(archivePath, { force: true });
      });
      stream.pipe(res);
    }),
  );

  api.post(
    "/backup/import",
    upload.single("file"),
    asyncHandler(async (req, res) => {
      if (!req.file) {
        return res.status(400).json({ message: "Файл архива не получен" });
      }

      const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "tattoo-restore-"));
      const archivePath = path.join(tmpRoot, "import.tar.gz");
      await fs.promises.writeFile(archivePath, req.file.buffer);

      await execFile("tar", ["-xzf", archivePath, "-C", tmpRoot]);

      const dumpPath = path.join(tmpRoot, "db.sql");
      if (!fs.existsSync(dumpPath)) {
        throw new Error("В архиве нет файла db.sql для восстановления");
      }

      await execFile("psql", [DATABASE_URL, "-c", "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"]);
      await execFile("psql", [DATABASE_URL, "-f", dumpPath]);

      const dataDir = path.join(process.cwd(), "data");
      const extractedData = path.join(tmpRoot, "data");
      if (fs.existsSync(extractedData)) {
        await fs.promises.rm(dataDir, { recursive: true, force: true });
        await fs.promises.cp(extractedData, dataDir, { recursive: true });
      }

      const extractedUploads = path.join(tmpRoot, "uploads");
      if (fs.existsSync(extractedUploads)) {
        await fs.promises.rm(UPLOAD_DIR, { recursive: true, force: true });
        await fs.promises.cp(extractedUploads, UPLOAD_DIR, { recursive: true });
      }

      fs.rmSync(tmpRoot, { recursive: true, force: true });

      res.json({ restored: true });
    }),
  );

  app.use("/api", api);

  const httpServer = createServer(app);

  return httpServer;
}
