// server/routes.stats.ts
import type { Router, Request, Response, NextFunction } from "express";
import { getStorage } from "./storage";

const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

export function attachStatsRoutes(api: Router) {
  api.get("/stats", wrap(async (_req, res) => {
    const storage = getStorage();
    const [masters, services, bookings, clients, certs, portfolio] = await Promise.all([
      storage.listMasters(),
      storage.listServices(),
      storage.listBookings(),
      storage.listClientSummaries(),
      storage.listCertificates(),
      storage.listPortfolio(),
    ]);

    const todayISO = new Date().toISOString().slice(0,10);
    const in7 = new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0,10);

    const totalBookings = (bookings || []).length;
    const todayBookings = (bookings || []).filter((b: any) => String(b.date) === todayISO).length;
    const upcoming7d = (bookings || []).filter((b: any) => {
      const d = String(b.date || "");
      return d >= todayISO && d <= in7 && (b.status || "").toLowerCase() !== "cancelled";
    }).length;

    res.json({
      totalMasters: (masters || []).length,
      totalServices: (services || []).length,
      totalBookings,
      todayBookings,
      upcoming7d,
      totalClients: (clients || []).length,
      portfolioCount: (portfolio || []).length,
      certsCount: (certs || []).length,
    });
  }));
}
