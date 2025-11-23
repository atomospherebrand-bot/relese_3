// client/src/pages/Masters.tsx
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Master } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import MasterFormDialog from "@/components/MasterFormDialog";
import { Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";

export default function MastersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["masters"],
    queryFn: () => api.getMasters(),
  });

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOf, setEditOf] = React.useState<Master | null>(null);

  const mCreate = useMutation({
    mutationFn: (payload: Partial<Master>) => api.createMaster(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["masters"] });
      setCreateOpen(false);
      toast({ title: "Готово", description: "Мастер создан" });
    },
    onError: (e: any) =>
      toast({
        title: "Ошибка",
        description: e?.message || "Не удалось создать мастера",
        variant: "destructive",
      }),
  });

  const mUpdate = useMutation({
    mutationFn: (p: { id: string; data: Partial<Master> }) =>
      api.updateMaster(p.id, p.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["masters"] });
      setEditOf(null);
      toast({ title: "Сохранено", description: "Данные обновлены" });
    },
    onError: (e: any) =>
      toast({
        title: "Ошибка",
        description: e?.message || "Не удалось сохранить мастера",
        variant: "destructive",
      }),
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => api.deleteMaster(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["masters"] });
      toast({ title: "Удалено" });
    },
    onError: (e: any) =>
      toast({
        title: "Ошибка",
        description: e?.message || "Не удалось удалить мастера",
        variant: "destructive",
      }),
  });

  const toggleActive = (m: Master) =>
    mUpdate.mutate({
      id: m.id,
      data: { isActive: !m.isActive },
    });

  if (isLoading) return <div className="p-6">Загрузка…</div>;
  if (isError)
    return (
      <div className="p-6 text-red-500">
        {(error as any)?.message || "Не удалось загрузить мастеров"}
      </div>
    );

  const masters = data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Мастера</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 active:translate-y-px"
        >
          Добавить мастера
        </button>
      </div>

      {/* сетка карточек как на твоём скрине */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {masters.map((m) => (
          <div
            key={m.id}
            className="rounded-xl border border-white/10 bg-[#1c1f26] p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              {/* аватар / плейсхолдер */}
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-black/30 text-xs text-white/60">
                {m.avatar ? (
                  <img
                    src={m.avatar}
                    alt={m.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>нет фото</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="truncate text-base font-semibold">{m.name}</div>
                  {m.nickname && (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">
                      @{m.nickname}
                    </span>
                  )}

                  {/* Бейдж статуса — зелёный активен, серый/красный скрыт */}
                  <span
                    className={
                      "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs " +
                      (m.isActive
                        ? "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-600/30"
                        : "bg-rose-600/20 text-rose-300 ring-1 ring-rose-600/30")
                    }
                    title={m.isActive ? "Виден в боте" : "Скрыт в боте"}
                  >
                    {m.isActive ? "активен" : "скрыт"}
                  </span>
                </div>

                {m.telegram && (
                  <div className="mt-1 text-sm text-white/70">{m.telegram}</div>
                )}

                {m.specialization && (
                  <div className="mt-2 text-sm text-white/80">
                    {m.specialization}
                  </div>
                )}
              </div>

              {/* быстрый тоггл активности */}
              <button
                onClick={() => toggleActive(m)}
                className="ml-2 rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white"
                title={m.isActive ? "Скрыть мастера" : "Сделать активным"}
              >
                {m.isActive ? (
                  <ToggleRight className="h-5 w-5" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
              </button>
            </div>

            {/* действия */}
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => setEditOf(m)}
                className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
              >
                <Pencil className="h-4 w-4" />
                Изменить
              </button>

              <button
                onClick={() => {
                  if (confirm("Удалить мастера?")) mDelete.mutate(m.id);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-rose-600/90 px-3 py-2 text-sm text-white hover:bg-rose-600"
              >
                <Trash2 className="h-4 w-4" />
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Диалог создания */}
      {createOpen && (
        <MasterFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={(payload) => mCreate.mutate(payload)}
          title="Новый мастер"
          submitText={mCreate.isPending ? "Сохраняю…" : "Создать"}
        />
      )}

      {/* Диалог редактирования */}
      {editOf && (
        <MasterFormDialog
          open={!!editOf}
          onOpenChange={(o) => !o && setEditOf(null)}
          initialData={editOf}
          onSubmit={(payload) =>
            mUpdate.mutate({ id: editOf.id, data: payload })
          }
          title="Изменить мастера"
          submitText={mUpdate.isPending ? "Сохраняю…" : "Сохранить"}
        />
      )}
    </div>
  );
}
