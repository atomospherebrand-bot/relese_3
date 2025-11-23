import React from "react";
import type { Service } from "@shared/schema";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Service | null;
  onSubmit: (payload: Partial<Service>) => void;
  title?: string;
  submitText?: string;
};

export default function ServiceFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  title = "Добавить услугу",
  submitText = "Добавить",
}: Props) {
  const [name, setName] = React.useState(initialData?.name ?? "");
  const [duration, setDuration] = React.useState(String(initialData?.duration ?? 60));
  const [price, setPrice] = React.useState(String(initialData?.price ?? 0));
  const [description, setDescription] = React.useState(initialData?.description ?? "");

  React.useEffect(() => {
    if (!open) return;
    setName(initialData?.name ?? "");
    setDuration(String(initialData?.duration ?? 60));
    setPrice(String(initialData?.price ?? 0));
    setDescription(initialData?.description ?? "");
  }, [open, initialData?.id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const durationNum = parseInt(duration, 10);
    const priceNum = parseInt(price, 10);

    if (!name.trim()) {
      alert("Введите название услуги");
      return;
    }
    if (isNaN(durationNum) || durationNum <= 0) {
      alert("Длительность должна быть положительным числом");
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      alert("Цена не может быть отрицательной");
      return;
    }

    onSubmit({
      name: name.trim(),
      duration: durationNum,
      price: priceNum,
      description: description.trim(),
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-2xl bg-[#161a20] p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md p-2 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-white/70">Название услуги</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например, Татуировка маленькая"
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm text-white/70">Длительность (мин)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="60"
                min="1"
                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-white/70">Цена (₽)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-white/70">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Краткое описание услуги..."
              rows={3}
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              {submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
