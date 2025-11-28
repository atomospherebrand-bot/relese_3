// server/routes.notify.ts
import type { Router, Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";

// local tiny async wrapper to avoid depending on project's asyncHandler
const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// File-backed flags: { [bookingId]: { confirmationSent?: boolean, rem24hSent?: boolean, rem2hSent?: boolean, chatId?: number } }
const notifFile = path.join(process.cwd(), "data", "notifications.json");
function readNotif(): any { try { return JSON.parse(fs.readFileSync(notifFile, "utf-8")); } catch { return {}; } }
function writeNotif(map: any) { fs.mkdirSync(path.dirname(notifFile), { recursive: true }); fs.writeFileSync(notifFile, JSON.stringify(map, null, 2), "utf-8"); }

export function attachNotificationRoutes(api: Router) {
  // GET /api/notifications — whole map (small)
  api.get("/notifications", wrap(async (_req, res) => {
    res.json(readNotif());
  }));

  // POST /api/notifications/register-chat { bookingId, chatId }
  api.post("/notifications/register-chat", wrap(async (req, res) => {
    const id = String((req.body?.bookingId) || "");
    const chatId = (req.body?.chatId);
    if (!id || !chatId) return res.status(400).json({ message: "bookingId and chatId required" });
    const map = readNotif();
    map[id] = { ...(map[id] || {}), chatId };
    writeNotif(map);
    res.json({ ok: true });
  }));

  // POST /api/notifications/mark { bookingId, type: "confirm"|"rem24"|"rem2" }
  api.post("/notifications/mark", wrap(async (req, res) => {
    const id = String((req.body?.bookingId) || "");
    const kind = String((req.body?.type) || "");
    if (!id || !kind) return res.status(400).json({ message: "bookingId and type required" });
    const map = readNotif();
    const cur = map[id] || {};
    if (kind === "confirm") cur.confirmationSent = true;
    if (kind === "rem24") cur.rem24hSent = true;
    if (kind === "rem2") cur.rem2hSent = true;
    map[id] = cur;
    writeNotif(map);
    res.json({ ok: true });
  }));
}
