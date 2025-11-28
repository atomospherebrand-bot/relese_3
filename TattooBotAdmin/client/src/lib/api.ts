import { z } from "zod";
import {
  type Master,
  type Service,
  type Booking,
  type BotMessage,
  type Settings,
  type PortfolioItem,
  type BotAction,
  type Certificate,
  type ClientSummary,
  insertMasterSchema,
  insertServiceSchema,
  insertBookingSchema,
  insertCertificateSchema,
  botMessageSchema,
  settingsSchema,
  portfolioItemSchema,
} from "@shared/schema";

const BASE_URL = "/api";

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const method = init?.method ? init.method.toUpperCase() : "GET";
  let url = `${BASE_URL}${input}`;

  if (method === "GET") {
    const separator = url.includes("?") ? "&" : "?";
    url += `${separator}_=${Date.now()}`;
  }

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      ...(init?.headers ?? {}),
    },
    credentials: "same-origin",
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.message ?? text;
    } catch {}
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function sanitizeString(value?: string | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
}

function sanitizeUrl(value?: string | null): string | undefined {
  const trimmed = sanitizeString(value);
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/uploads/")) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function prune<T extends Record<string, unknown>>(input: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as T;
}

type UploadResult = {
  url: string;
  mediaType: "image" | "video";
  thumbnail?: string;
};

type PortfolioFiltersResponse = {
  masters: { id: string; name: string; nickname: string; isActive: boolean }[];
  styles: string[];
};

type DashboardResponse = {
  stats: {
    bookingsToday: number;
    activeMasters: number;
    revenueWeek: number;
    averageDuration: number;
    pendingBookings: number;
    cancelledWeek: number;
    newClientsWeek: number;
    returningClientsWeek: number;
    certificatesCount: number;
    portfolioCount: number;
    clientsTotal: number;
  };
  recentBookings: Booking[];
};

export const api = {
  async uploadFile(
    file: File,
    options?: { thumbnail?: File | null; subdir?: string },
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    if (options?.thumbnail) {
      formData.append("thumbnail", options.thumbnail);
    }

    const query = options?.subdir ? `?subdir=${encodeURIComponent(options.subdir)}` : "";
    const response = await fetch(`${BASE_URL}/upload${query}`, {
      method: "POST",
      body: formData,
      cache: "no-store",
      headers: {
        "Cache-Control": "no-store",
        Pragma: "no-cache",
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Ошибка загрузки файла");
    }

    const data = (await response.json()) as Partial<UploadResult>;
    const mediaType = (data.mediaType as UploadResult["mediaType"]) || (file.type.startsWith("video/") ? "video" : "image");

    return {
      url: data.url ?? "",
      mediaType,
      ...(data.thumbnail ? { thumbnail: data.thumbnail } : {}),
    };
  },

  async getMasters(): Promise<Master[]> {
    const { masters } = await request<{ masters: Master[] }>(`/masters`);
    return masters;
  },

  async createMaster(payload: Partial<Master>): Promise<Master> {
    const body = insertMasterSchema.parse({
      name: (payload.name ?? "").trim(),
      nickname: (payload.nickname ?? "").trim(),
      telegram: sanitizeString(payload.telegram),
      specialization: (payload.specialization ?? "").trim(),
      avatar: sanitizeString(payload.avatar),
      teletypeUrl: sanitizeUrl(payload.teletypeUrl),
      isActive: payload.isActive ?? true,
    });

    const { master } = await request<{ master: Master }>(`/masters`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return master;
  },

  async updateMaster(id: string, payload: Partial<Master>): Promise<Master | undefined> {
    const partial = insertMasterSchema.partial().parse({
      name: payload.name !== undefined ? (payload.name ?? "").trim() : undefined,
      nickname: payload.nickname !== undefined ? (payload.nickname ?? "").trim() : undefined,
      telegram: payload.telegram !== undefined ? sanitizeString(payload.telegram) : undefined,
      specialization:
        payload.specialization !== undefined ? (payload.specialization ?? "").trim() : undefined,
      avatar: payload.avatar !== undefined ? sanitizeString(payload.avatar) : undefined,
      teletypeUrl: payload.teletypeUrl !== undefined ? sanitizeUrl(payload.teletypeUrl) : undefined,
      isActive: payload.isActive,
    });

    const { master } = await request<{ master: Master }>(`/masters/${id}`, {
      method: "PUT",
      body: JSON.stringify(prune(partial)),
    });
    return master;
  },

  async deleteMaster(id: string): Promise<void> {
    await request<void>(`/masters/${id}`, { method: "DELETE" });
  },

  async getServices(): Promise<Service[]> {
    const { services } = await request<{ services: Service[] }>(`/services`);
    return services;
  },

  async createService(payload: Partial<Service>): Promise<Service> {
    const body = insertServiceSchema.parse({
      name: (payload.name ?? "").trim(),
      duration: Number(payload.duration ?? 0),
      price: Number(payload.price ?? 0),
      description: (payload.description ?? "").trim(),
    });

    const { service } = await request<{ service: Service }>(`/services`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return service;
  },

  async updateService(id: string, payload: Partial<Service>): Promise<Service> {
    const partial = insertServiceSchema.partial().parse({
      name: payload.name !== undefined ? (payload.name ?? "").trim() : undefined,
      duration: payload.duration !== undefined ? Number(payload.duration) : undefined,
      price: payload.price !== undefined ? Number(payload.price) : undefined,
      description: payload.description !== undefined ? (payload.description ?? "").trim() : undefined,
    });

    const { service } = await request<{ service: Service }>(`/services/${id}`, {
      method: "PUT",
      body: JSON.stringify(prune(partial)),
    });
    return service;
  },

  async deleteService(id: string): Promise<void> {
    await request<void>(`/services/${id}`, { method: "DELETE" });
  },

  async getBookings(): Promise<Booking[]> {
    const { bookings } = await request<{ bookings: Booking[] }>(`/bookings`);
    return bookings;
  },

  async createBooking(payload: Partial<Booking>): Promise<Booking> {
    const body = insertBookingSchema.parse({
      clientName: (payload.clientName ?? "").trim(),
      clientPhone: (payload.clientPhone ?? "").trim(),
      clientTelegram: sanitizeString(payload.clientTelegram),
      masterId: payload.masterId ?? "",
      serviceId: payload.serviceId ?? "",
      date: payload.date ?? "",
      time: payload.time ?? "",
      status: payload.status,
      notes: sanitizeString(payload.notes),
    });

    const { booking } = await request<{ booking: Booking }>(`/bookings`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return booking;
  },

  async updateBooking(id: string, payload: Partial<Booking>): Promise<Booking> {
    const partial = insertBookingSchema.partial().parse({
      clientName: payload.clientName !== undefined ? (payload.clientName ?? "").trim() : undefined,
      clientPhone: payload.clientPhone !== undefined ? (payload.clientPhone ?? "").trim() : undefined,
      clientTelegram: payload.clientTelegram !== undefined ? sanitizeString(payload.clientTelegram) : undefined,
      masterId: payload.masterId,
      serviceId: payload.serviceId,
      date: payload.date,
      time: payload.time,
      status: payload.status,
      notes: payload.notes !== undefined ? sanitizeString(payload.notes) : undefined,
    });

    const { booking } = await request<{ booking: Booking }>(`/bookings/${id}`, {
      method: "PUT",
      body: JSON.stringify(prune(partial)),
    });
    return booking;
  },

  async updateBookingStatus(id: string, status: Booking["status"]): Promise<Booking> {
    const { booking } = await request<{ booking: Booking }>(`/bookings/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    return booking;
  },

  async deleteBooking(id: string): Promise<void> {
    await request<void>(`/bookings/${id}`, { method: "DELETE" });
  },

  async getAvailability(params: { masterId: string; serviceId: string; date: string }): Promise<{ slots: string[] }> {
    const query = new URLSearchParams(params).toString();
    return request<{ slots: string[] }>(`/availability?${query}`);
  },

  async getMessages(): Promise<BotMessage[]> {
    const { messages } = await request<{ messages: BotMessage[] }>(`/messages`);
    return messages;
  },

  async saveMessages(messages: BotMessage[]): Promise<BotMessage[]> {
    const payload = z.array(botMessageSchema).parse(messages);
    const { messages: saved } = await request<{ messages: BotMessage[] }>(`/messages`, {
      method: "PUT",
      body: JSON.stringify({ messages: payload }),
    });
    return saved;
  },

  async getSettings(): Promise<Settings> {
    const { settings } = await request<{ settings: Settings }>(`/settings`);
    return settingsSchema.parse(settings);
  },

  async saveSettings(settings: Settings): Promise<{ settings: Settings; botRestarted: boolean; botAction: BotAction; botRestartMessage?: string }> {
    const payload = settingsSchema.parse(settings);
    return request<{ settings: Settings; botRestarted: boolean; botAction: BotAction; botRestartMessage?: string }>(`/settings`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },

  async getDashboard(): Promise<DashboardResponse> {
    return request<DashboardResponse>(`/dashboard`);
  },

  async importExcel(file: File): Promise<{ imported: number; skipped: number }> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${BASE_URL}/excel/import`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Не удалось импортировать Excel");
    }
    return (await response.json()) as { imported: number; skipped: number };
  },

  async exportExcel(params: { from?: string; to?: string }): Promise<Blob> {
    const query = new URLSearchParams(prune(params)).toString();
    const response = await fetch(`${BASE_URL}/excel/export?${query}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Не удалось выгрузить Excel");
    }
    return await response.blob();
  },

  async getPortfolio(
    params: { masterId?: string; style?: string; q?: string; page?: number; pageSize?: number } = {},
  ): Promise<{
    portfolio: (PortfolioItem & { masterName?: string | null; thumbnail?: string | null })[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const query = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params)
          .filter(([_, v]) => {
            if (v === undefined || v === null) return false;
            const value = typeof v === "string" ? v.trim() : String(v);
            return value.length > 0;
          })
          .map(([k, v]) => [k, String(v)]),
      ),
    );

    const queryString = query.toString();
    const path = queryString.length > 0 ? `/portfolio?${queryString}` : "/portfolio";

    return request<{
      portfolio: (PortfolioItem & { masterName?: string | null; thumbnail?: string | null })[];
      total: number;
      page: number;
      pageSize: number;
    }>(path);
  },

  async addPortfolioItem(payload: {
    url: string;
    title: string;
    description?: string;
    masterId?: string;
    style?: string;
    mediaType?: "image" | "video";
    thumbnail?: string | null;
    attachments?: {
      url: string;
      mediaType?: "image" | "video";
      thumbnail?: string | null;
    }[];
  }): Promise<PortfolioItem> {
    const body = portfolioItemSchema
      .omit({ id: true, createdAt: true })
      .extend({ thumbnail: portfolioItemSchema.shape.thumbnail })
      .parse({
        ...payload,
        style: sanitizeString(payload.style) ?? undefined,
        description: sanitizeString(payload.description) ?? undefined,
        masterId: payload.masterId ?? undefined,
        thumbnail: sanitizeString(payload.thumbnail ?? undefined) ?? undefined,
        attachments: payload.attachments?.map((item) => ({
          url: item.url,
          mediaType: item.mediaType ?? "image",
          thumbnail: sanitizeString(item.thumbnail ?? undefined) ?? undefined,
        })),
      });

    const { item } = await request<{ item: PortfolioItem }>(`/portfolio`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return item;
  },

  async updatePortfolioItem(
    id: string,
    payload: Partial<{
      url: string;
      title: string;
      description?: string;
      masterId?: string;
      style?: string;
      mediaType?: "image" | "video";
      thumbnail?: string | null;
      attachments?: {
        url: string;
        mediaType?: "image" | "video";
        thumbnail?: string | null;
      }[];
    }>,
  ): Promise<PortfolioItem> {
    const body = portfolioItemSchema
      .partial()
      .extend({ thumbnail: portfolioItemSchema.shape.thumbnail })
      .parse({
        ...payload,
        style: sanitizeString(payload.style) ?? undefined,
        description: sanitizeString(payload.description) ?? undefined,
        masterId: payload.masterId ?? undefined,
        thumbnail: sanitizeString(payload.thumbnail ?? undefined) ?? undefined,
        attachments: payload.attachments?.map((item) => ({
          url: item.url,
          mediaType: item.mediaType ?? "image",
          thumbnail: sanitizeString(item.thumbnail ?? undefined) ?? undefined,
        })),
      });

    const { item } = await request<{ item: PortfolioItem }>(`/portfolio/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return item;
  },

  async deletePortfolioItem(id: string): Promise<void> {
    await request<void>(`/portfolio/${id}`, { method: "DELETE" });
  },

  async getPortfolioFilters(): Promise<PortfolioFiltersResponse> {
    return request<PortfolioFiltersResponse>(`/portfolio/filters`);
  },

  async getClients(): Promise<ClientSummary[]> {
    const { clients } = await request<{ clients: ClientSummary[] }>(`/clients`);
    return clients;
  },

  async exportClients(format: "xlsx" | "csv" = "xlsx"): Promise<Blob> {
    const response = await fetch(`${BASE_URL}/clients/export?fmt=${encodeURIComponent(format)}`, {
      credentials: "same-origin",
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Не удалось экспортировать клиентов");
    }
    return await response.blob();
  },

  async getCertificates(): Promise<Certificate[]> {
    const { certs } = await request<{ certs: Certificate[] }>(`/certs`);
    return certs;
  },

  async createCertificate(payload: {
    file?: File | null;
    url?: string | null;
    type: "image" | "video";
    caption?: string;
    description?: string;
  }): Promise<Certificate> {
    let mediaUrl = sanitizeString(payload.url);

    if (payload.file) {
      const uploaded = await this.uploadFile(payload.file, { subdir: "certs" });
      mediaUrl = uploaded.url;
    }

    if (!mediaUrl) {
      throw new Error("Не указан файл или ссылка на медиа");
    }

    const body = insertCertificateSchema.parse({
      url: mediaUrl,
      type: payload.type,
      caption: sanitizeString(payload.caption),
      description: sanitizeString(payload.description),
    });

    const { cert } = await request<{ cert: Certificate }>(`/certs`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return cert;
  },

  async deleteCertificate(id: string): Promise<void> {
    await request<void>(`/certs/${id}`, { method: "DELETE" });
  },

  async exportBackup(): Promise<Blob> {
    const response = await fetch(`${BASE_URL}/backup/export`, { credentials: "same-origin" });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Не удалось выгрузить резервную копию");
    }
    return await response.blob();
  },

  async importBackup(file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${BASE_URL}/backup/import`, {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "Не удалось восстановить резервную копию");
    }
  },
};
