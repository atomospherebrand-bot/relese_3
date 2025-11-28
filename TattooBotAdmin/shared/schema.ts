import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/** USERS */
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

/** MASTERS */
export const mastersTable = pgTable("masters", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nickname: text("nickname").notNull(),
  telegram: text("telegram"),
  specialization: text("specialization").notNull(),
  avatar: text("avatar"),
  teletypeUrl: text("teletype_url"),
  isActive: boolean("is_active").notNull().default(true),
});

/** SERVICES */
export const servicesTable = pgTable("services", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  duration: integer("duration").notNull(),
  price: integer("price").notNull(),
  description: text("description").notNull(),
});

/** BOOKINGS */
export const bookingsTable = pgTable("bookings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  clientTelegram: text("client_telegram"),
  clientUsername: text("client_username"),
  telegramId: text("telegram_id"),
  masterId: uuid("master_id").notNull().references(() => mastersTable.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").notNull().references(() => servicesTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  time: time("time").notNull(),
  duration: integer("duration").notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** BOT MESSAGES */
export const botMessagesTable = pgTable("bot_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  value: text("value").notNull(),
  type: text("type").notNull(),
  imageUrl: text("image_url"),
});

/** PORTFOLIO (images + videos) */
export type PortfolioMedia = {
  url: string;
  mediaType: "image" | "video";
  thumbnail?: string | null;
};

export const portfolioTable = pgTable("portfolio_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  url: text("url").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  masterId: uuid("master_id").references(() => mastersTable.id, { onDelete: "set null" }),
  style: text("style"),
  mediaType: text("media_type").notNull().default("image"), // 'image' | 'video'
  thumbnail: text("thumbnail"),
  attachments: jsonb("attachments")
    .$type<PortfolioMedia[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** SETTINGS */
export const settingsTable = pgTable("settings", {
  id: text("id").primaryKey(),
  botToken: text("bot_token").notNull().default(""),
  studioName: text("studio_name").notNull(),
  address: text("address").notNull(),
  yandexMapUrl: text("yandex_map_url"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  paymentMethods: text("payment_methods").notNull().default(""),
  workingHours: text("working_hours").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

/** ZOD */
export const insertUserSchema = createInsertSchema(users).pick({ username: true, password: true });

export const masterSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  nickname: z.string().min(1),
  telegram: z.string().min(1).optional(),
  specialization: z.string().min(1),
  avatar: z
    .string()
    .refine(v => !v || v.startsWith("http") || v.startsWith("/uploads/"), "Invalid url")
    .optional(),
  teletypeUrl: z.string().optional(),
  isActive: z.boolean(),
});
export const insertMasterSchema = masterSchema.omit({ id: true });

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  duration: z.number().int().positive(),
  price: z.number().int().nonnegative(),
  description: z.string().default(""),
});
export const insertServiceSchema = serviceSchema.omit({ id: true });

export const bookingStatusSchema = z.enum(["pending", "confirmed", "cancelled"]);
export const bookingSchema = z.object({
  id: z.string(),
  clientName: z.string().min(1),
  clientPhone: z.string().min(1),
  clientTelegram: z.string().optional(),
  clientUsername: z.string().optional(),
  telegramId: z.union([z.string(), z.number()]).optional(),
  masterId: z.string(),
  masterName: z.string(),
  masterTelegram: z.string().optional(),
  serviceId: z.string(),
  service: z.string(),
  date: z.string().regex(/\d{4}-\d{2}-\d{2}/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.number().int().positive(),
  status: bookingStatusSchema,
  notes: z.string().optional(),
});
export const insertBookingSchema = bookingSchema
  .omit({
    id: true,
    masterName: true,
    masterTelegram: true,
    service: true,
    status: true,
    duration: true,
  })
  .extend({ status: bookingStatusSchema.optional() });

export const botMessageSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  value: z.string(),
  type: z.enum(["text", "textarea"]),
  imageUrl: z.string().optional().nullable(),
});

export const settingsSchema = z.object({
  botToken: z.string().default(""),
  studioName: z.string().min(1),
  address: z.string().min(1),
  yandexMapUrl: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  paymentMethods: z.string().default(""),
  workingHours: z.string().default(""),
});

export const botActionSchema = z.enum(["none", "start", "restart", "stop"]);

export const portfolioItemSchema = z.object({
  id: z.string(),
  url: z.string().min(1).refine(v => v.startsWith("http") || v.startsWith("/uploads/"), "Invalid url"),
  title: z.string().min(1),
  masterId: z.string().optional().nullable(),
  style: z.string().optional().nullable(),
  mediaType: z.enum(["image", "video"]).default("image"),
  thumbnail: z
    .string()
    .optional()
    .nullable()
    .refine(v => !v || v.startsWith("http") || v.startsWith("/uploads/"), "Invalid url"),
  description: z.string().default("").optional(),
  attachments: z
    .array(
      z.object({
        url: z
          .string()
          .min(1)
          .refine(v => v.startsWith("http") || v.startsWith("/uploads/"), "Invalid url"),
        mediaType: z.enum(["image", "video"]).default("image"),
        thumbnail: z
          .string()
          .optional()
          .nullable()
          .refine(v => !v || v.startsWith("http") || v.startsWith("/uploads/"), "Invalid url"),
      }),
    )
    .default([])
    .optional(),
  createdAt: z.string().optional(),
});

export const certificateSchema = z.object({
  id: z.string(),
  url: z.string().min(1),
  type: z.enum(["image", "video"]),
  caption: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  uploadedAt: z.string(),
});

export const insertCertificateSchema = certificateSchema.omit({ id: true, uploadedAt: true });

export const clientSummarySchema = z.object({
  id: z.string(),
  fullName: z.string().min(1),
  phone: z.string().optional().nullable(),
  telegramId: z.union([z.string(), z.number()]).optional().nullable(),
  username: z.string().optional().nullable(),
  consentMarketing: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
  createdAt: z.string(),
  lastVisitAt: z.string().optional().nullable(),
  bookingsCount: z.number().int().nonnegative(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Master = z.infer<typeof masterSchema>;
export type InsertMaster = z.infer<typeof insertMasterSchema>;
export type Service = z.infer<typeof serviceSchema>;
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type BotMessage = z.infer<typeof botMessageSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type PortfolioItem = z.infer<typeof portfolioItemSchema>;
export type BotAction = z.infer<typeof botActionSchema>;
export type Certificate = z.infer<typeof certificateSchema>;
export type ClientSummary = z.infer<typeof clientSummarySchema>;
