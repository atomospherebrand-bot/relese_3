import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, Clock, MessageCircleWarning } from "lucide-react";
import { cn } from "@/lib/utils";

interface Booking {
  id: string;
  clientName: string;
  clientTelegram?: string;
  masterName: string;
  masterTelegram?: string;
  service: string;
  date: string;
  time: string;
  status: "confirmed" | "pending" | "cancelled";
}

interface RecentBookingsProps {
  bookings: Booking[];
}

const statusColors = {
  confirmed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
};

const statusLabels = {
  confirmed: "Подтверждена",
  pending: "Ожидает",
  cancelled: "Отменена",
};

export function RecentBookings({ bookings }: RecentBookingsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Последние записи</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-white/5 bg-white/5 py-10 text-center text-sm text-white/60">
              <MessageCircleWarning className="h-8 w-8 text-white/30" />
              <div className="space-y-1">
                <p className="font-medium text-white/80">Пока нет записей</p>
                <p className="text-xs text-white/50">Записи появятся здесь сразу после подтверждения заявок</p>
              </div>
            </div>
          ) : (
            bookings.map((booking) => (
              <div
                key={booking.id}
                className="flex flex-col gap-3 rounded-xl border border-white/5 bg-[#111620] p-4 transition hover:border-white/15 hover:bg-[#151c29] sm:flex-row sm:items-center sm:justify-between"
                data-testid={`booking-item-${booking.id}`}
              >
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-white/40" />
                    <span className="font-medium text-white" data-testid="text-client-name">
                      {booking.clientName}
                    </span>
                    {booking.clientTelegram && (
                      <a
                        href={`https://t.me/${booking.clientTelegram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary/80 hover:text-primary hover:underline"
                      >
                        @{booking.clientTelegram}
                      </a>
                    )}
                    <span className="text-white/30">→</span>
                    <span className="text-sm text-white/70">{booking.masterName}</span>
                    {booking.masterTelegram && (
                      <a
                        href={`https://t.me/${booking.masterTelegram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary/80 hover:text-primary hover:underline"
                      >
                        @{booking.masterTelegram}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-wide text-white/40">
                    <span className="text-white/60">{booking.service}</span>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{booking.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{booking.time}</span>
                    </div>
                  </div>
                </div>
                <Badge
                  className={cn("border px-3 py-1", statusColors[booking.status])}
                  data-testid={`badge-status-${booking.status}`}
                >
                  {statusLabels[booking.status]}
                </Badge>
              </div>
            ))
          )}
        </div>
        <Button
          variant="outline"
          className="mt-6 w-full border-white/10 text-white/80 hover:bg-white/10"
          data-testid="button-view-all"
          disabled={bookings.length === 0}
        >
          Показать все
        </Button>
      </CardContent>
    </Card>
  );
}
