// server/routes.notify.ts
import type { Router, Request, Response, NextFunction } from "express";
import { markNotification, readNotifications, registerChat } from "./notifications";

// local tiny async wrapper to avoid depending on project's asyncHandler
const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

export function attachNotificationRoutes(api: Router) {
  // GET /api/notifications — whole map (small)
  api.get("/notifications", wrap(async (_req, res) => {
    res.json(readNotifications());
  }));

  // POST /api/notifications/register-chat { bookingId, chatId }
  api.post("/notifications/register-chat", wrap(async (req, res) => {
    const id = String((req.body?.bookingId) || "");
    const chatId = (req.body?.chatId);
    if (!id || !chatId) return res.status(400).json({ message: "bookingId and chatId required" });
    res.json({ ok: true, map: registerChat(id, chatId) });
  }));

  // POST /api/notifications/mark { bookingId, type: "confirm"|"rem24"|"rem2" }
  api.post("/notifications/mark", wrap(async (req, res) => {
    const id = String((req.body?.bookingId) || "");
    const kind = String((req.body?.type) || "");
    if (!id || !kind) return res.status(400).json({ message: "bookingId and type required" });
    const map = markNotification(id, kind as any);
    res.json({ ok: true, map });
  }));
}
