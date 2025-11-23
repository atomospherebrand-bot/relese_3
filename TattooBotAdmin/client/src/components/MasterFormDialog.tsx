// client/src/components/MasterFormDialog.tsx
import React from "react";
import type { Master } from "@shared/schema";
import { api } from "@/lib/api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Master | null;
  onSubmit: (payload: Partial<Master>) => void;
  title?: string;
  submitText?: string;
};

export default function MasterFormDialog({
  open,
  onOpenChange,
  initialData,
  onSubmit,
  title = "Добавить мастера",
  submitText = "Добавить",
}: Props) {
  const [name, setName] = React.useState(initialData?.name ?? "");
  const [nickname, setNickname] = React.useState(initialData?.nickname ?? "");
  const [telegram, setTelegram] = React.useState(initialData?.telegram ?? "");
  const [specialization, setSpecialization] = React.useState(
    initialData?.specialization ?? "",
  );
  const [avatar, setAvatar] = React.useState(initialData?.avatar ?? "");
  const [teletypeUrl, setTeletypeUrl] = React.useState(initialData?.teletypeUrl ?? "");
  const [isActive, setIsActive] = React.useState<boolean>(
    initialData?.isActive ?? true,
  );
  const [loading, setLoading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(initialData?.name ?? "");
    setNickname(initialData?.nickname ?? "");
    setTelegram(initialData?.telegram ?? "");
    setSpecialization(initialData?.specialization ?? "");
    setAvatar(initialData?.avatar ?? "");
    setTeletypeUrl(initialData?.teletypeUrl ?? "");
    setIsActive(initialData?.isActive ?? true);
  }, [open, initialData?.id]); // сбрасываем при открытии/смене мастера

  const handlePickFile = () => fileRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setLoading(true);
      const uploaded = await api.uploadFile(f); // <-- вернёт url и тип медиа
      setAvatar(uploaded.url);
    } catch (err: any) {
      alert(err?.message || "Не удалось загрузить файл");
    } finally {
      setLoading(false);
      // очистим value, чтобы можно было выбрать тот же файл повторно
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      nickname: nickname.trim(),
      telegram: telegram.trim(),
      specialization: specialization.trim(),
      avatar: avatar.trim() || undefined,
      teletypeUrl: teletypeUrl.trim() || undefined,
      isActive,
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
          {/* АВАТАР + ЗАГРУЗКА */}
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-black/30 text-xs text-white/60">
              {avatar ? (
                <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <span>нет фото</span>
              )}
            </div>

            <div className="flex-1">
              <label className="mb-1 block text-sm text-white/70">Аватар</label>
              <div className="flex gap-2">
                <input
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="Ссылка или /uploads/xxx.jpg"
                  className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={handlePickFile}
                  className="shrink-0 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  disabled={loading}
                >
                  {loading ? "Загрузка…" : "Загрузить"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              <p className="mt-1 text-xs text-white/40">
                Можно вставить URL или загрузить файл с компьютера (файл сохранится в /uploads).
              </p>
            </div>
          </div>

          {/* ИМЯ */}
          <div>
            <label className="mb-1 block text-sm text-white/70">Имя</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Иван Петров"
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* ПСЕВДОНИМ */}
          <div>
            <label className="mb-1 block text-sm text-white/70">Псевдоним</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="INKMASTER"
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* TELEGRAM */}
          <div>
            <label className="mb-1 block text-sm text-white/70">Telegram</label>
            <input
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="@nickname"
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>

          {/* СПЕЦИАЛИЗАЦИЯ */}
          <div>
            <label className="mb-1 block text-sm text-white/70">Специализация</label>
            <input
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="Реализм, графика…"
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* TELETYPE URL */}
          <div>
            <label className="mb-1 block text-sm text-white/70">Ссылка на Teletype</label>
            <input
              value={teletypeUrl}
              onChange={(e) => setTeletypeUrl(e.target.value)}
              placeholder="https://teletype.in/@username/article"
              type="url"
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <p className="mt-1 text-xs text-white/40">
              Ссылка на статью о мастере в Teletype. Будет показана в боте при нажатии "Подробнее".
            </p>
          </div>

          {/* АКТИВЕН */}
          <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
            <div>
              <div className="text-sm">Активен</div>
              <div className="text-xs text-white/50">
                Отображать в боте и в поиске свободных слотов
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className={
                "relative h-6 w-11 rounded-full transition " +
                (isActive ? "bg-emerald-500/80" : "bg-white/20")
              }
              aria-pressed={isActive}
            >
              <span
                className={
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white transition " +
                  (isActive ? "right-0.5" : "left-0.5")
                }
              />
            </button>
          </div>

          {/* КНОПКИ */}
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
              disabled={loading}
            >
              {submitText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
