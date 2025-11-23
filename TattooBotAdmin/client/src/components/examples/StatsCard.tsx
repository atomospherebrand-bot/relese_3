import { StatsCard } from "../StatsCard";
import { Calendar, Users, DollarSign, Clock } from "lucide-react";

export default function StatsCardExample() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 p-6">
      <StatsCard
        title="Записи сегодня"
        value={12}
        icon={Calendar}
        description="+3 с вчерашнего дня"
      />
      <StatsCard
        title="Активные мастера"
        value={5}
        icon={Users}
      />
      <StatsCard
        title="Доход за неделю"
        value="₽48,500"
        icon={DollarSign}
        description="+15% к прошлой неделе"
      />
      <StatsCard
        title="Ср. время записи"
        value="2.4ч"
        icon={Clock}
      />
    </div>
  );
}
