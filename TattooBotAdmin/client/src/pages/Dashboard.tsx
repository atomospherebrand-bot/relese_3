import React from "react";
import { StatsCard } from "@/components/StatsCard";
import { RecentBookings } from "@/components/RecentBookings";
import { Calendar, Users, DollarSign, Clock, UserPlus, Image as ImageIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

const formatCurrency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const formatDate = (date: string) => {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
};

export default function Dashboard() {
  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboard,
  });

  const bookings = React.useMemo(() => {
    if (!dashboardQuery.data?.recentBookings) return [];
    return dashboardQuery.data.recentBookings.map((booking) => ({
      ...booking,
      clientTelegram: booking.clientTelegram ?? undefined,
      masterTelegram: booking.masterTelegram ?? undefined,
      date: formatDate(booking.date),
    }));
  }, [dashboardQuery.data?.recentBookings]);

  const averageHours = React.useMemo(() => {
    const avg = dashboardQuery.data?.stats.averageDuration ?? 0;
    return avg > 0 ? `${(avg / 60).toFixed(1)}ч` : "—";
  }, [dashboardQuery.data?.stats.averageDuration]);

  if (dashboardQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-2xl bg-white/5" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl bg-white/5" />
      </div>
    );
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
        Не удалось загрузить данные дашборда. Попробуйте обновить страницу позже.
      </div>
    );
  }

  const {
    bookingsToday,
    activeMasters,
    revenueWeek,
    pendingBookings,
    cancelledWeek,
    newClientsWeek,
    returningClientsWeek,
    portfolioCount,
    clientsTotal,
  } = dashboardQuery.data.stats;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-white">Главная</h1>
        <p className="text-sm text-white/50">
          Следите за динамикой записей, активностью мастеров и последними бронированиями в реальном времени
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard title="Записи сегодня" value={bookingsToday} icon={Calendar} />
        <StatsCard title="Активные мастера" value={activeMasters} icon={Users} />
        <StatsCard title="Доход за неделю" value={formatCurrency.format(revenueWeek)} icon={DollarSign} />
        <StatsCard title="Ср. время записи" value={averageHours} icon={Clock} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Клиентская база"
          value={clientsTotal}
          icon={Users}
          description={`+${newClientsWeek} новых, ${returningClientsWeek} возвратов`}
        />
        <StatsCard
          title="В ожидании"
          value={pendingBookings}
          icon={Clock}
          description={`Отменено за 7 дней: ${cancelledWeek}`}
        />
        <StatsCard
          title="Новые клиенты"
          value={`+${newClientsWeek}`}
          icon={UserPlus}
          description="За последние 7 дней"
        />
        <StatsCard
          title="Работы в портфолио"
          value={portfolioCount}
          icon={ImageIcon}
          description="Отображаются пользователям"
        />
      </div>

      <RecentBookings bookings={bookings} />
    </div>
  );
}
