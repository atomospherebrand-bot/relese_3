import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookingsList } from "@/components/BookingsList";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Booking, Master, Service } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const formatDisplayDate = (date: string) => {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
};

const todayIso = () => new Date().toISOString().split("T")[0];

type BookingFormState = {
  clientName: string;
  clientPhone: string;
  clientTelegram: string;
  masterId: string;
  serviceId: string;
  date: string;
  time: string;
  notes: string;
};

interface BookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  masters: Master[];
  services: Service[];
  onSubmit: (values: BookingFormState) => void;
  isSubmitting: boolean;
}

function BookingDialog({ open, onOpenChange, masters, services, onSubmit, isSubmitting }: BookingDialogProps) {
  const [form, setForm] = useState<BookingFormState>(() => ({
    clientName: "",
    clientPhone: "",
    clientTelegram: "",
    masterId: masters[0]?.id ?? "",
    serviceId: services[0]?.id ?? "",
    date: todayIso(),
    time: "",
    notes: "",
  }));

  useEffect(() => {
    if (open) {
      setForm({
        clientName: "",
        clientPhone: "",
        clientTelegram: "",
        masterId: masters[0]?.id ?? "",
        serviceId: services[0]?.id ?? "",
        date: todayIso(),
        time: "",
        notes: "",
      });
    }
  }, [open, masters, services]);

  const availabilityQuery = useQuery({
    queryKey: ["availability", form.masterId, form.serviceId, form.date],
    queryFn: () =>
      api.getAvailability({
        masterId: form.masterId,
        serviceId: form.serviceId,
        date: form.date,
      }),
    enabled: open && Boolean(form.masterId && form.serviceId && form.date),
  });

  const availableSlots = availabilityQuery.data?.slots ?? [];

  useEffect(() => {
    if (!open) return;
    if (availableSlots.length > 0 && !availableSlots.includes(form.time)) {
      setForm((prev) => ({ ...prev, time: availableSlots[0] }));
    }
    if (availableSlots.length === 0) {
      setForm((prev) => ({ ...prev, time: "" }));
    }
  }, [availableSlots, form.time, open]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.masterId || !form.serviceId || !form.date || !form.time) {
      return;
    }
    onSubmit({
      ...form,
      clientTelegram: form.clientTelegram.replace(/^@/, ""),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая запись</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="clientName">Имя клиента</Label>
              <Input
                id="clientName"
                value={form.clientName}
                onChange={(event) => setForm((prev) => ({ ...prev, clientName: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientPhone">Телефон</Label>
              <Input
                id="clientPhone"
                value={form.clientPhone}
                onChange={(event) => setForm((prev) => ({ ...prev, clientPhone: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientTelegram">Telegram</Label>
              <Input
                id="clientTelegram"
                value={form.clientTelegram}
                onChange={(event) => setForm((prev) => ({ ...prev, clientTelegram: event.target.value }))}
                placeholder="@username"
              />
            </div>
            <div className="space-y-2">
              <Label>Мастер</Label>
              <Select
                value={form.masterId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, masterId: value, time: "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите мастера" />
                </SelectTrigger>
                <SelectContent>
                  {masters.map((master) => (
                    <SelectItem key={master.id} value={master.id}>
                      {master.nickname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Услуга</Label>
              <Select
                value={form.serviceId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, serviceId: value, time: "" }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите услугу" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Дата</Label>
              <Input
                id="date"
                type="date"
                value={form.date}
                onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value, time: "" }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Свободное время</Label>
              <Select
                value={form.time}
                onValueChange={(value) => setForm((prev) => ({ ...prev, time: value }))}
                disabled={availableSlots.length === 0 || availabilityQuery.isFetching}
              >
                <SelectTrigger>
                  <SelectValue placeholder={availabilityQuery.isFetching ? "Загрузка..." : "Выберите время"} />
                </SelectTrigger>
                <SelectContent>
                  {availableSlots.length === 0 && (
                    <SelectItem value="no-slots" disabled>
                      Нет доступных слотов
                    </SelectItem>
                  )}
                  {availableSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Комментарий</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting || availableSlots.length === 0}>
              Создать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Bookings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api.getBookings(),
  });

  const mastersQuery = useQuery({
    queryKey: ["masters"],
    queryFn: () => api.getMasters(),
  });

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => api.getServices(),
  });

  const createMutation = useMutation({
    mutationFn: (values: BookingFormState) =>
      api.createBooking({
        clientName: values.clientName,
        clientPhone: values.clientPhone,
        clientTelegram: values.clientTelegram ? values.clientTelegram.replace(/^@/, "") : undefined,
        masterId: values.masterId,
        serviceId: values.serviceId,
        date: values.date,
        time: values.time,
        notes: values.notes || undefined,
      }),
    onSuccess: () => {
      toast({ title: "Запись создана" });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось создать запись", description: error.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Booking["status"] }) =>
      api.updateBookingStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось обновить статус", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteBooking,
    onSuccess: () => {
      toast({ title: "Запись удалена" });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось удалить запись", description: error.message, variant: "destructive" });
    },
  });

  const bookings = useMemo(
    () =>
      bookingsQuery.data?.map((booking) => ({
        ...booking,
        date: formatDisplayDate(booking.date),
      })) ?? [],
    [bookingsQuery.data],
  );

  const handleOpenDialog = () => {
    if (!mastersQuery.data?.length || !servicesQuery.data?.length) {
      toast({ title: "Не хватает данных", description: "Добавьте мастеров и услуги перед созданием записи", variant: "destructive" });
      return;
    }
    setIsDialogOpen(true);
  };

  if (bookingsQuery.isLoading) {
    return <p>Загрузка записей…</p>;
  }

  if (bookingsQuery.isError) {
    return <p className="text-destructive">Не удалось загрузить записи</p>;
  }

  if (mastersQuery.isError || servicesQuery.isError) {
    return <p className="text-destructive">Не удалось загрузить справочные данные</p>;
  }

  return (
    <>
      <BookingsList
        bookings={bookings}
        onAdd={handleOpenDialog}
        onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
        onDelete={(id) => {
          if (window.confirm("Удалить запись?")) {
            deleteMutation.mutate(id);
          }
        }}
      />
      {mastersQuery.data && servicesQuery.data && (
        <BookingDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          masters={mastersQuery.data}
          services={servicesQuery.data}
          onSubmit={(values) => createMutation.mutate(values)}
          isSubmitting={createMutation.isPending}
        />
      )}
    </>
  );
}
