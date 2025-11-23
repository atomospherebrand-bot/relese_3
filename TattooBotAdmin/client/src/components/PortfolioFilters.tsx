import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, Plus } from "lucide-react";

type Props = {
  value: { masterId?: string; style?: string; q?: string };
  onChange: (v: Props["value"]) => void;
  onAdd: () => void;
};

export default function PortfolioFilters({ value, onChange, onAdd }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio", "filters"],
    queryFn: () => api.getPortfolioFilters(),
  });

  const masters = data?.masters ?? [];
  const styles = data?.styles ?? [];

  const handleReset = () => onChange({});

  return (
    <Card className="border-white/10 bg-gradient-to-br from-[#1c212b] to-[#151821] p-4">
      <div className="flex items-center gap-3 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80">
          <Filter className="h-4 w-4" />
        </div>
        <div className="flex flex-1 flex-col">
          <span className="text-sm font-medium text-white">Фильтры портфолио</span>
          <span className="text-xs text-white/60">Подберите подборку по мастеру, стилю или названию работы</span>
        </div>
        <Button
          variant="secondary"
          onClick={handleReset}
          disabled={isLoading || (!value.masterId && !value.style && !value.q)}
        >
          Сбросить
        </Button>
        <Button onClick={onAdd} className="inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Добавить работу
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label className="text-xs text-white/70">Мастер</Label>
          <Select
            value={value.masterId ?? "all"}
            onValueChange={(val) => onChange({ ...value, masterId: val === "all" ? undefined : val })}
            disabled={isLoading}
          >
            <SelectTrigger className="border-white/10 bg-black/20 text-sm text-white">
              <SelectValue placeholder="Все мастера" />
            </SelectTrigger>
            <SelectContent className="bg-[#1b1f27] text-white">
              <SelectItem value="all">Все мастера</SelectItem>
              {masters.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.nickname || m.name}
                  {!m.isActive ? " • скрыт" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-white/70">Стиль / тег</Label>
          <div>
            <Input
              list="portfolio-style-suggestions"
              placeholder="Например, реализм"
              value={value.style ?? ""}
              onChange={(e) => onChange({ ...value, style: e.target.value || undefined })}
              className="border-white/10 bg-black/20 text-sm text-white placeholder:text-white/40"
            />
            <datalist id="portfolio-style-suggestions">
              {styles.map((style) => (
                <option key={style} value={style} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-white/70">Поиск</Label>
          <Input
            placeholder="Название работы"
            value={value.q ?? ""}
            onChange={(e) => onChange({ ...value, q: e.target.value || undefined })}
            className="border-white/10 bg-black/20 text-sm text-white placeholder:text-white/40"
          />
        </div>
      </div>
    </Card>
  );
}
