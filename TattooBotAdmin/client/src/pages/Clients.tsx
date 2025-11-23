import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileSpreadsheet, RefreshCw, UserCheck, UserPlus, Users as UsersIcon } from "lucide-react";
import type { ClientSummary } from "@shared/schema";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return value.slice(0, 10).split("-").reverse().join(".");
}

export default function ClientsPage() {
  const { toast } = useToast();

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: api.getClients,
  });

  const clients = clientsQuery.data ?? [];

  const metrics = React.useMemo(() => {
    const total = clients.length;
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const weekIso = weekAgo.toISOString().slice(0, 10);

    const newClients = clients.filter((client) => (client.createdAt ?? "").slice(0, 10) >= weekIso).length;
    const returningClients = clients.filter(
      (client) => (client.lastVisitAt ?? "").slice(0, 10) >= weekIso && (client.bookingsCount ?? 0) > 1,
    ).length;
    const loyalClients = clients.filter((client) => (client.bookingsCount ?? 0) >= 3).length;

    return { total, newClients, returningClients, loyalClients };
  }, [clients]);

  const handleDownload = React.useCallback(async (format: "xlsx" | "csv") => {
    try {
      const blob = await api.exportClients(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "xlsx" ? "clients.xlsx" : "clients.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Не удалось экспортировать",
        description: error?.message ?? "Попробуйте ещё раз чуть позже",
        variant: "destructive",
      });
    }
  }, [toast]);

  const isLoading = clientsQuery.isLoading;
  const isError = clientsQuery.isError;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white">Клиенты</h1>
          <p className="text-sm text-white/60">
            Сводная база клиентов на основе записей: отслеживайте новые визиты, возвращаемость и активность.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => clientsQuery.refetch()}
            disabled={clientsQuery.isFetching}
            className="gap-2 border-white/20 text-white/80 hover:bg-white/10"
          >
            <RefreshCw className={`h-4 w-4 ${clientsQuery.isFetching ? "animate-spin" : ""}`} />
            Обновить
          </Button>
          <Button
            type="button"
            onClick={() => handleDownload("xlsx")}
            className="gap-2 bg-indigo-600 hover:bg-indigo-500"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleDownload("csv")}
            className="gap-2 bg-white/10 text-white hover:bg-white/20"
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          title="Всего клиентов"
          value={metrics.total}
          icon={UsersIcon}
          isLoading={isLoading}
        />
        <StatTile
          title="Новых за 7 дней"
          value={metrics.newClients}
          icon={UserPlus}
          isLoading={isLoading}
        />
        <StatTile
          title="Вернулись за неделю"
          value={metrics.returningClients}
          icon={UserCheck}
          isLoading={isLoading}
        />
        <StatTile
          title="Постоянные (3+)"
          value={metrics.loyalClients}
          icon={UsersIcon}
          isLoading={isLoading}
        />
      </div>

      {isError ? (
        <Alert variant="destructive" className="border border-red-500/40 bg-red-500/10 text-red-100">
          <AlertTitle>Не удалось загрузить клиентов</AlertTitle>
          <AlertDescription>{(clientsQuery.error as Error)?.message ?? "Попробуйте обновить страницу"}</AlertDescription>
        </Alert>
      ) : (
        <Card className="border-white/10 bg-[#151821] text-white">
          <CardHeader className="border-b border-white/5">
            <CardTitle className="text-base font-semibold text-white/80">Таблица клиентов</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-0.5 p-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full rounded-md bg-white/10" />
                ))}
              </div>
            ) : clients.length === 0 ? (
              <div className="p-6 text-sm text-white/60">Пока нет данных. Добавьте записи, чтобы сформировать список клиентов.</div>
            ) : (
              <Table>
                <TableHeader className="bg-white/5 text-xs uppercase tracking-wide text-white/60">
                  <TableRow className="border-white/5">
                    <TableHead>Имя</TableHead>
                    <TableHead>Телеграм</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Теги</TableHead>
                    <TableHead>Создан</TableHead>
                    <TableHead>Последний визит</TableHead>
                    <TableHead className="text-right">Записей</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client: ClientSummary) => (
                    <TableRow key={client.id} className="border-white/5">
                      <TableCell>{client.fullName || "—"}</TableCell>
                      <TableCell>
                        {client.username ? (
                          <span className="text-white/80">@{client.username}</span>
                        ) : (
                          <span className="text-white/40">—</span>
                        )}
                      </TableCell>
                      <TableCell>{client.phone || "—"}</TableCell>
                      <TableCell>{(client.tags ?? []).length ? client.tags?.join(", ") : "—"}</TableCell>
                      <TableCell>{formatDate(client.createdAt)}</TableCell>
                      <TableCell>{formatDate(client.lastVisitAt)}</TableCell>
                      <TableCell className="text-right font-semibold">{client.bookingsCount ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type StatTileProps = {
  title: string;
  value: number;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  isLoading: boolean;
};

function StatTile({ title, value, icon: Icon, isLoading }: StatTileProps) {
  return (
    <Card className="border-white/10 bg-[#141821] text-white">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-white/50">{title}</CardTitle>
        <Icon className="h-4 w-4 text-white/50" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20 rounded-md bg-white/10" />
        ) : (
          <div className="text-2xl font-semibold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}
