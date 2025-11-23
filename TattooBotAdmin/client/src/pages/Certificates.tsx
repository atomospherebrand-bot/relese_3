import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, RefreshCw, PlusCircle, Clock3 } from "lucide-react";
import type { Certificate } from "@shared/schema";

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CertificatesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setDialogOpen] = React.useState(false);

  const certificatesQuery = useQuery({
    queryKey: ["certificates"],
    queryFn: api.getCertificates,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.deleteCertificate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      toast({ title: "Удалено", description: "Акция удалена из витрины" });
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось удалить",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    certificatesQuery.refetch();
  };

  const certificates = certificatesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white">Акции</h1>
          <p className="text-sm text-white/60">
            Загружайте баннеры и тексты акций, чтобы витрина бота всегда показывала актуальные спецпредложения студии.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleRefresh}
            disabled={certificatesQuery.isFetching}
            className="gap-2 border-white/20 text-white/80 hover:bg-white/10"
          >
            <RefreshCw className={`h-4 w-4 ${certificatesQuery.isFetching ? "animate-spin" : ""}`} />
            Обновить
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" className="gap-2 bg-indigo-600 hover:bg-indigo-500">
                <PlusCircle className="h-4 w-4" />
                Добавить акцию
              </Button>
            </DialogTrigger>
            <CertificateDialog
              onClose={() => setDialogOpen(false)}
              onCreated={() => {
                setDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["certificates"] });
              }}
            />
          </Dialog>
        </div>
      </div>

      {certificatesQuery.isError ? (
        <Alert variant="destructive" className="border border-red-500/40 bg-red-500/10 text-red-100">
          <AlertTitle>Не удалось загрузить акции</AlertTitle>
          <AlertDescription>{(certificatesQuery.error as Error)?.message ?? "Попробуйте обновить страницу"}</AlertDescription>
        </Alert>
      ) : (
        <Card className="border-white/10 bg-[#141821] text-white">
          <CardHeader className="flex items-center justify-between border-b border-white/5">
            <CardTitle className="text-base font-semibold text-white/80">
              Всего акций: {certificates.length}
            </CardTitle>
            <Badge variant="outline" className="border-white/20 text-white/60">
              <Clock3 className="mr-1 h-3 w-3" />
              Обновлено {formatDate(new Date().toISOString())}
            </Badge>
          </CardHeader>
          <CardContent className="p-6">
            {certificatesQuery.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="h-56 w-full rounded-xl bg-white/10" />
                ))}
              </div>
            ) : certificates.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-white/60">
                <p>Здесь пока пусто.</p>
                <p>Загрузите баннер или видео, чтобы акция появилась в боте.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {certificates.map((cert) => (
                  <CertificateCard
                    key={cert.id}
                    certificate={cert}
                    onRemove={() => removeMutation.mutate(cert.id)}
                    removing={removeMutation.isPending && removeMutation.variables === cert.id}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type CertificateDialogProps = {
  onClose: () => void;
  onCreated: () => void;
};

function CertificateDialog({ onClose, onCreated }: CertificateDialogProps) {
  const { toast } = useToast();
  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof api.createCertificate>[0]) => api.createCertificate(payload),
    onSuccess: () => {
      toast({ title: "Готово", description: "Акция добавлена" });
      setFile(null);
      setUrl("");
      setDescription("");
      setType("image");
      onCreated();
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось сохранить", description: error.message, variant: "destructive" });
    },
  });

  const [file, setFile] = React.useState<File | null>(null);
  const [url, setUrl] = React.useState("");
  const [type, setType] = React.useState<"image" | "video">("image");
  const [description, setDescription] = React.useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate({
      file: file ?? undefined,
      url: url || undefined,
      type,
      description,
    });
  };

  return (
    <DialogContent className="sm:max-w-lg border-white/10 bg-[#141821] text-white">
      <DialogHeader>
        <DialogTitle>Новая акция</DialogTitle>
        <DialogDescription className="text-xs text-white/60">
          Загрузите файл или вставьте прямую ссылку на изображение/видео. Подпись появится в карточке акции.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Тип медиа</Label>
            <Select value={type} onValueChange={(value) => setType(value as "image" | "video") }>
              <SelectTrigger className="border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent className="bg-[#141821] text-white">
                <SelectItem value="image">Изображение</SelectItem>
                <SelectItem value="video">Видео</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Описание</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Полное описание и условия"
              className="border-white/10 bg-black/20 text-white placeholder:text-white/40"
              rows={3}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Файл</Label>
          <Input
            type="file"
            accept={type === "image" ? "image/*" : "video/*"}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="border-white/10 bg-black/20 text-white file:text-white"
          />
          <p className="text-xs text-white/40">Можно загрузить файл или указать публичный URL ниже.</p>
        </div>

        <div className="space-y-2">
          <Label>Ссылка на медиа</Label>
          <Textarea
            value={url}
            onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/promo-banner.jpg"
            className="border-white/10 bg-black/20 text-white placeholder:text-white/40"
            rows={2}
          />
        </div>

        <CardFooter className="flex items-center justify-end gap-2 border-t border-white/5 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} className="text-white/70 hover:bg-white/10">
            Отмена
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-500"
          >
            {createMutation.isPending ? "Сохраняем…" : "Добавить"}
          </Button>
        </CardFooter>
      </form>
    </DialogContent>
  );
}

type CertificateCardProps = {
  certificate: Certificate;
  onRemove: () => void;
  removing: boolean;
};

function CertificateCard({ certificate, onRemove, removing }: CertificateCardProps) {
  return (
    <Card className="overflow-hidden border-white/10 bg-black/20 text-white">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-black/30">
        {certificate.type === "video" ? (
          <video src={certificate.url} controls className="h-full w-full object-cover" />
        ) : (
          <img src={certificate.url} alt={certificate.description ?? certificate.caption ?? ""} className="h-full w-full object-cover" />
        )}
      </div>
      <CardContent className="space-y-2 p-4">
        <p className="text-sm font-medium whitespace-pre-line text-white/90">
          {certificate.description || certificate.caption || "Без описания"}
        </p>
        <p className="text-xs text-white/50">Добавлено {formatDate(certificate.uploadedAt)}</p>
      </CardContent>
      <CardFooter className="flex items-center justify-end gap-2 border-t border-white/5 bg-black/10 p-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={removing}
          className="gap-1 text-red-300 hover:bg-red-500/10 hover:text-red-200"
        >
          <Trash2 className="h-4 w-4" />
          {removing ? "Удаляем…" : "Удалить"}
        </Button>
      </CardFooter>
    </Card>
  );
}
