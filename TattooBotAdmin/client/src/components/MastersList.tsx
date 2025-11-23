import React from "react";
import type { Master } from "@shared/schema";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, CardHeader, CardTitle, CardContent, CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type Props = {
  masters: Master[];
};

export default function MastersList({ masters }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const mUpdate = useMutation({
    mutationFn: (p: { id: string; patch: Partial<Master> }) =>
      api.updateMaster(p.id, p.patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["masters"] }),
    onError: (e: any) =>
      toast({ title: "Ошибка", description: e?.message || "Не удалось сохранить", variant: "destructive" }),
  });

  const mDelete = useMutation({
    mutationFn: (id: string) => api.deleteMaster(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["masters"] });
      toast({ title: "Мастер удалён" });
    },
    onError: (e: any) =>
      toast({ title: "Ошибка", description: e?.message || "Не удалось удалить", variant: "destructive" }),
  });

  const onToggleActive = (m: Master) =>
    mUpdate.mutate({ id: m.id, patch: { isActive: !m.isActive } });

  const onEdit = async (m: Master) => {
    const name = window.prompt("Имя мастера", m.name) ?? m.name;
    const nickname = window.prompt("Ник (необязательно)", m.nickname || "") ?? (m.nickname || "");
    const specialization = window.prompt("Специализация", m.specialization || "") ?? (m.specialization || "");
    // аватар можно сменить через существующую кнопку «Заменить фото» на карточке
    mUpdate.mutate({ id: m.id, patch: { name, nickname, specialization } });
  };

  const onDelete = (m: Master) => {
    if (!confirm(`Удалить мастера «${m.name}»?`)) return;
    mDelete.mutate(m.id);
  };

  const onChangeAvatar = async (m: Master) => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        if (!input.files || input.files.length === 0) return;
        const file = input.files[0]!;
        const uploaded = await api.uploadFile(file); // вернёт /uploads/...
        await api.updateMaster(m.id, { avatar: uploaded.url });
        qc.invalidateQueries({ queryKey: ["masters"] });
      };
      input.click();
    } catch (e: any) {
      toast({
        title: "Ошибка",
        description: e?.message || "Не удалось загрузить фото",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {masters.map((m) => (
        <Card key={m.id} className="overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <img
                src={m.avatar || "/placeholder.svg"}
                alt={m.name}
                className="h-14 w-14 rounded-xl object-cover"
              />
              <div className="flex flex-col">
                <span className="font-semibold">{m.name}</span>
                {m.nickname && <span className="text-sm opacity-70">@{m.nickname}</span>}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-xs opacity-70 mb-1">Специализация</div>
              <Input value={m.specialization || ""} disabled />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Активен</span>
              <Switch checked={!!m.isActive} onCheckedChange={() => onToggleActive(m)} />
            </div>
          </CardContent>
          <CardFooter className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => onChangeAvatar(m)}>Заменить фото</Button>
            <Button onClick={() => onEdit(m)}>Изменить</Button>
            <Button variant="destructive" onClick={() => onDelete(m)}>Удалить</Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
