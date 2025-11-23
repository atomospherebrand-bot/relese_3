import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, User, Clock, Search, Filter, ArrowUpDown, Plus, Trash2 } from "lucide-react";
import { CalendarView } from "./CalendarView";
import { useState } from "react";

interface Booking {
  id: string;
  clientName: string;
  clientPhone: string;
  clientTelegram?: string;
  masterName: string;
  masterTelegram?: string;
  service: string;
  date: string;
  time: string;
  status: "confirmed" | "pending" | "cancelled";
}

interface BookingsListProps {
  bookings: Booking[];
  onAdd?: () => void;
  onStatusChange?: (id: string, status: Booking["status"]) => void;
  onDelete?: (id: string) => void;
}

const statusColors = {
  confirmed: "bg-green-500/10 text-green-700 dark:text-green-400",
  pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  cancelled: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const statusLabels = {
  confirmed: "Подтверждена",
  pending: "Ожидает",
  cancelled: "Отменена",
};

export function BookingsList({ bookings, onAdd, onStatusChange, onDelete }: BookingsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [showCalendar, setShowCalendar] = useState(false);

  const filteredBookings = bookings
    .filter((booking) => {
      const matchesSearch = booking.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           booking.clientPhone.includes(searchQuery);
      const matchesStatus = statusFilter === "all" || booking.status === statusFilter;
      const matchesDate = !selectedDate || booking.date === selectedDate;
      return matchesSearch && matchesStatus && matchesDate;
    })
    .sort((a, b) => {
      const dateA = new Date(a.date.split('.').reverse().join('-') + ' ' + a.time);
      const dateB = new Date(b.date.split('.').reverse().join('-') + ' ' + b.time);
      return sortOrder === "asc" ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Записи клиентов</h2>
        <div className="flex gap-2">
          {onAdd && (
            <Button onClick={onAdd} data-testid="button-add-booking">
              <Plus className="h-4 w-4 mr-2" />
              Новая запись
            </Button>
          )}
          <Button
            variant={showCalendar ? "default" : "outline"}
            onClick={() => setShowCalendar(!showCalendar)}
            data-testid="button-toggle-calendar"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Календарь
          </Button>
          <Button
            variant="outline"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            data-testid="button-sort-order"
          >
            <ArrowUpDown className="h-4 w-4 mr-2" />
            {sortOrder === "asc" ? "Старые → Новые" : "Новые → Старые"}
          </Button>
        </div>
      </div>

      {showCalendar && (
        <CalendarView
          bookings={bookings}
          onDateSelect={(date) => setSelectedDate(selectedDate === date ? undefined : date)}
          selectedDate={selectedDate}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Все записи</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по имени или телефону..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="confirmed">Подтверждена</SelectItem>
                  <SelectItem value="pending">Ожидает</SelectItem>
                  <SelectItem value="cancelled">Отменена</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredBookings.map((booking) => (
              <div
                key={booking.id}
                className="flex flex-col gap-3 p-4 border rounded-lg hover-elevate sm:flex-row sm:items-center sm:justify-between"
                data-testid={`booking-item-${booking.id}`}
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium" data-testid="text-client-name">{booking.clientName}</span>
                    <span className="text-sm text-muted-foreground">{booking.clientPhone}</span>
                    {booking.clientTelegram && (
                      <a 
                        href={`https://t.me/${booking.clientTelegram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                        data-testid={`link-client-telegram-${booking.id}`}
                      >
                        @{booking.clientTelegram}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span className="font-medium">{booking.masterName}</span>
                    {booking.masterTelegram && (
                      <a 
                        href={`https://t.me/${booking.masterTelegram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        @{booking.masterTelegram}
                      </a>
                    )}
                    <span>{booking.service}</span>
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
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[booking.status]} data-testid={`badge-status-${booking.status}`}>
                    {statusLabels[booking.status]}
                  </Badge>
                  {onStatusChange && (
                    <Select
                      value={booking.status}
                      onValueChange={(value) => onStatusChange(booking.id, value as Booking["status"])}
                    >
                      <SelectTrigger className="w-32" data-testid={`select-status-${booking.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Ожидает</SelectItem>
                        <SelectItem value="confirmed">Подтверждена</SelectItem>
                        <SelectItem value="cancelled">Отменена</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(booking.id)}
                      data-testid={`button-delete-booking-${booking.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
