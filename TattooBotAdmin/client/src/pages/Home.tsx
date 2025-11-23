// client/src/pages/Home.tsx
import React from "react";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "/api";

type Stats = {
  totalMasters: number;
  totalServices: number;
  totalBookings: number;
  todayBookings: number;
  upcoming7d: number;
  totalClients: number;
  portfolioCount: number;
  certsCount: number;
};

async function getStats(): Promise<Stats> {
  const res = await fetch(API_BASE + "/stats", { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function Home() {
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    getStats().then(setStats).catch(e => setErr(String(e)));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">Дашборд</h1>

      {err && <div className="text-sm text-red-400">{err}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card title="Мастера" value={stats?.totalMasters ?? "—"} />
        <Card title="Услуги" value={stats?.totalServices ?? "—"} />
        <Card title="Клиенты" value={stats?.totalClients ?? "—"} />
        <Card title="Акции" value={stats?.certsCount ?? "—"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Всего записей" value={stats?.totalBookings ?? "—"} />
        <Card title="Записей сегодня" value={stats?.todayBookings ?? "—"} />
        <Card title="Ближайшая неделя" value={stats?.upcoming7d ?? "—"} />
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#1c1f26] p-4">
      <div className="text-sm text-white/60">{title}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
