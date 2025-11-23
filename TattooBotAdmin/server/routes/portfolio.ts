import { Router } from "express";
import { and, asc, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { db } from "../db";
import { portfolioTable, mastersTable } from "@shared/schema";
import { z } from "zod";

const router = Router();

const listSchema = z.object({
  masterId: z.string().uuid().optional(),
  style: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});

const createSchema = z.object({
  url: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  masterId: z.string().uuid().optional().nullable(),
  style: z.string().optional().nullable(),
  mediaType: z.enum(["image", "video"]).default("image"),
  thumbnail: z
    .string()
    .optional()
    .nullable()
    .refine(
      (value) => !value || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/uploads/"),
      "Invalid thumbnail",
    ),
  attachments: z
    .array(
      z.object({
        url: z
          .string()
          .min(1)
          .refine(
            (value) =>
              value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/uploads/"),
            "Invalid url",
          ),
        mediaType: z.enum(["image", "video"]).default("image"),
        thumbnail: z
          .string()
          .optional()
          .nullable()
          .refine(
            (value) =>
              !value || value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/uploads/"),
            "Invalid thumbnail",
          ),
      }),
    )
    .default([])
    .optional(),
});

const updateSchema = createSchema.partial();

router.get("/", async (req, res, next) => {
  try {
    const { masterId, style, q, page, pageSize } = listSchema.parse(req.query);
    const filters: SQL[] = [];

    if (masterId) {
      filters.push(eq(portfolioTable.masterId, masterId));
    }

    const normalizedStyle = style?.trim();
    if (normalizedStyle) {
      filters.push(ilike(portfolioTable.style, `%${normalizedStyle}%`));
    }

    const normalizedQuery = q?.trim();
    if (normalizedQuery) {
      filters.push(ilike(portfolioTable.title, `%${normalizedQuery}%`));
    }

    const where = filters.length ? and(...filters) : undefined;

    const baseCount = db.select({ count: sql<number>`count(*)` }).from(portfolioTable);
    const baseData = db
      .select({
        id: portfolioTable.id,
        url: portfolioTable.url,
        title: portfolioTable.title,
        description: portfolioTable.description,
        masterId: portfolioTable.masterId,
        style: portfolioTable.style,
        mediaType: portfolioTable.mediaType,
        thumbnail: portfolioTable.thumbnail,
        attachments: portfolioTable.attachments,
        createdAt: portfolioTable.createdAt,
        masterName: mastersTable.nickname,
        masterFullName: mastersTable.name,
      })
      .from(portfolioTable)
      .leftJoin(mastersTable, eq(mastersTable.id, portfolioTable.masterId))
      .orderBy(desc(portfolioTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const countQuery = where ? baseCount.where(where) : baseCount;
    const dataQuery = where ? baseData.where(where) : baseData;

    const [{ count }] = await countQuery.execute();
    const items = await dataQuery.execute();

    const portfolio = items.map((item) => {
      let attachments: unknown[] = [];
      try {
        if (Array.isArray(item.attachments)) attachments = item.attachments as any[];
        else if (typeof (item as any).attachments === "string") {
          attachments = JSON.parse((item as any).attachments as string);
        }
      } catch {
        attachments = [];
      }

      return {
        id: item.id,
        url: item.url,
        title: item.title,
        description: item.description ?? "",
        masterId: item.masterId,
        style: item.style,
        mediaType: item.mediaType,
        thumbnail: item.thumbnail,
        attachments,
        createdAt: item.createdAt,
        masterName: item.masterName || item.masterFullName,
      };
    });

    res.json({
      portfolio,
      total: Number(count ?? 0),
      page,
      pageSize,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const body = createSchema.parse(req.body);
    const isUpload = typeof body.url === "string" && body.url.startsWith("/uploads/");
    const isHttp = typeof body.url === "string" && (body.url.startsWith("http://") || body.url.startsWith("https://"));
    if (!isUpload && !isHttp) {
      return res.status(400).json({ message: "Invalid url" });
    }

    const [inserted] = await db
      .insert(portfolioTable)
      .values({
        url: body.url,
        title: body.title,
        description: body.description?.trim() || "",
        masterId: body.masterId ?? null,
        style: body.style ? body.style.trim() : null,
        mediaType: body.mediaType ?? "image",
        thumbnail: body.thumbnail ?? null,
        attachments: body.attachments ?? [],
      })
      .returning();

    res.status(201).json({ item: inserted });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const body = updateSchema.parse(req.body);

    const updateData: Record<string, unknown> = {};
    if (body.url !== undefined) updateData.url = body.url;
    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description?.trim() || "";
    if (body.masterId !== undefined) updateData.masterId = body.masterId ?? null;
    if (body.style !== undefined) updateData.style = body.style ? body.style.trim() : null;
    if (body.mediaType !== undefined) updateData.mediaType = body.mediaType;
    if (body.thumbnail !== undefined) updateData.thumbnail = body.thumbnail ?? null;
    if (body.attachments !== undefined) updateData.attachments = body.attachments;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "Нет данных для обновления" });
    }

    const [updated] = await db
      .update(portfolioTable)
      .set(updateData)
      .where(eq(portfolioTable.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Работа не найдена" });
    }

    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    await db.delete(portfolioTable).where(eq(portfolioTable.id, id));
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/filters", async (_req, res, next) => {
  try {
    const masters = await db
      .select({
        id: mastersTable.id,
        name: mastersTable.name,
        nickname: mastersTable.nickname,
        isActive: mastersTable.isActive,
      })
      .from(mastersTable)
      .orderBy(asc(mastersTable.nickname), asc(mastersTable.name));

    const stylesRows = await db
      .select({ style: portfolioTable.style })
      .from(portfolioTable)
      .where(sql`NULLIF(trim(${portfolioTable.style}), '') IS NOT NULL`)
      .groupBy(portfolioTable.style)
      .orderBy(asc(portfolioTable.style));

    const styles = stylesRows
      .map((row) => row.style)
      .filter((style): style is string => typeof style === "string" && style.trim().length > 0)
      .map((style) => style.trim());

    res.json({ masters, styles });
  } catch (err) {
    next(err);
  }
});

export default router;