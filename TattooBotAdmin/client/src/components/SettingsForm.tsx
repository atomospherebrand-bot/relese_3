import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Settings } from "@shared/schema";

export function SettingsForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Settings | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: api.saveSettings,
    onSuccess: ({ settings: saved, botRestarted, botAction, botRestartMessage }) => {
      let description: string | undefined;
      let variant: "default" | "destructive" = "default";

      const actionLabels: Record<"start" | "restart" | "stop", string> = {
        start: "Бот запущен с новым токеном",
        restart: "Бот перезапущен с обновлённым токеном",
        stop: "Бот остановлен. Укажите новый токен, чтобы запустить его вновь",
      };

      if (botAction !== "none") {
        if (botRestarted) {
          description = actionLabels[botAction];
          if (botRestartMessage) {
            description += `. ${botRestartMessage}`;
          }
        } else {
          description =
            botRestartMessage ||
            (botAction === "stop"
              ? "Скрипт остановки бота не выполнен. Проверьте настройку BOT_STOP_SCRIPT."
              : "Скрипт перезапуска бота не выполнен. Проверьте настройку BOT_RESTART_SCRIPT.");
          variant = "destructive";
        }
      } else if (botRestartMessage) {
        description = botRestartMessage;
      }

      toast({ title: "Настройки сохранены", description, variant });
      setSettings(saved);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось сохранить", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!settings) return;
    saveMutation.mutate(settings);
  };

  if (settingsQuery.isLoading || !settings) {
    return <p>Загрузка настроек…</p>;
  }

  if (settingsQuery.isError) {
    return <p className="text-destructive">Не удалось загрузить настройки</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Настройки студии</h2>
          <p className="text-sm text-white/50">Обновите токен бота и контактные данные, чтобы бот отвечал корректно.</p>
        </div>
        <Button
          onClick={handleSave}
          data-testid="button-save-settings"
          disabled={saveMutation.isPending}
          className="self-start bg-indigo-600 hover:bg-indigo-500"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Сохраняем…" : "Сохранить"}
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
        <Card className="border-white/10 bg-[#121722] text-white">
          <CardHeader>
            <CardTitle>Telegram-бот</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bot-token">Bot Token</Label>
              <Input
                id="bot-token"
                type="password"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={settings.botToken}
                onChange={(e) => setSettings({ ...settings, botToken: e.target.value })}
                data-testid="input-bot-token"
                className="border-white/10 bg-black/20 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">Получите токен у @BotFather и вставьте его сюда.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="studio-name">Название студии</Label>
              <Input
                id="studio-name"
                value={settings.studioName}
                onChange={(e) => setSettings({ ...settings, studioName: e.target.value })}
                data-testid="input-studio-name"
                className="border-white/10 bg-black/20 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="working-hours">Режим работы</Label>
              <Input
                id="working-hours"
                value={settings.workingHours ?? ""}
                onChange={(e) => setSettings({ ...settings, workingHours: e.target.value })}
                data-testid="input-working-hours"
                className="border-white/10 bg-black/20 text-white placeholder:text-white/40"
              />
              <p className="text-xs text-white/40">Информация выводится в профиле бота и напоминаниях.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#121722] text-white">
          <CardHeader>
            <CardTitle>Локация студии</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Адрес</Label>
              <Input
                id="address"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                data-testid="input-address"
                className="border-white/10 bg-black/20 text-white placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="yandex-map-url">Ссылка на Яндекс.Карты</Label>
              <Input
                id="yandex-map-url"
                placeholder="https://yandex.ru/maps/..."
                value={settings.yandexMapUrl ?? ""}
                onChange={(e) => setSettings({ ...settings, yandexMapUrl: e.target.value })}
                data-testid="input-yandex-map-url"
                className="border-white/10 bg-black/20 text-white placeholder:text-white/40"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="latitude">Широта</Label>
                <Input
                  id="latitude"
                  placeholder="55.755800"
                  value={settings.latitude ?? ""}
                  onChange={(e) => setSettings({ ...settings, latitude: e.target.value })}
                  data-testid="input-latitude"
                  className="border-white/10 bg-black/20 text-white placeholder:text-white/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Долгота</Label>
                <Input
                  id="longitude"
                  placeholder="37.617700"
                  value={settings.longitude ?? ""}
                  onChange={(e) => setSettings({ ...settings, longitude: e.target.value })}
                  data-testid="input-longitude"
                  className="border-white/10 bg-black/20 text-white placeholder:text-white/40"
                />
              </div>
            </div>

            {settings.latitude && settings.longitude && (
              <div className="space-y-3">
                <Label>Превью карты</Label>
                <div className="relative aspect-[3/2] overflow-hidden rounded-lg border border-white/10 bg-black/20">
                  <img
                    src={`https://static-maps.yandex.ru/1.x/?ll=${settings.longitude},${settings.latitude}&size=600,360&z=16&l=map&pt=${settings.longitude},${settings.latitude},pm2rdm`}
                    alt="Map preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (settings.yandexMapUrl) {
                        window.open(settings.yandexMapUrl, "_blank");
                      }
                    }}
                    data-testid="button-open-yandex"
                    className="border-white/20 text-white/80 hover:bg-white/10"
                  >
                    Яндекс.Карты
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(`https://maps.google.com/?q=${settings.latitude},${settings.longitude}`, "_blank");
                    }}
                    data-testid="button-open-google"
                    className="border-white/20 text-white/80 hover:bg-white/10"
                  >
                    Google Maps
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      const tgUrl = `tg://resolve?domain=ya_maps&start=maps_${settings.latitude}_${settings.longitude}`;
                      window.location.href = tgUrl;
                    }}
                    data-testid="button-open-telegram"
                    className="border-white/20 text-white/80 hover:bg-white/10"
                  >
                    Telegram
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
