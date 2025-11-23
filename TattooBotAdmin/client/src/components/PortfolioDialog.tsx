import React from "react";
import { api } from "@/lib/api";
import { type PortfolioItem } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ImageIcon, Loader2, Upload, Video } from "lucide-react";

const MEDIA_OPTIONS: { value: "image" | "video"; label: string; icon: React.ReactNode }[] = [
  { value: "image", label: "Фото", icon: <ImageIcon className="h-4 w-4" /> },
  { value: "video", label: "Видео", icon: <Video className="h-4 w-4" /> },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  item?: PortfolioItem & { masterName?: string | null };
};

type FiltersData = Awaited<ReturnType<typeof api.getPortfolioFilters>>;

function useFilePreview(file: File | null) {
  const [preview, setPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return preview;
}

export default function PortfolioDialog({ open, onClose, onSaved, item }: Props) {
  const { toast } = useToast();
  const { data } = useQuery<{ masters: FiltersData["masters"]; styles: FiltersData["styles"] }>({
    queryKey: ["portfolio", "filters"],
    queryFn: () => api.getPortfolioFilters(),
  });

  const masters = data?.masters ?? [];
  const styleSuggestions = data?.styles ?? [];

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [style, setStyle] = React.useState("");
  const [masterId, setMasterId] = React.useState<string | undefined>(undefined);
  const [mediaType, setMediaType] = React.useState<"image" | "video">("image");
  const [files, setFiles] = React.useState<File[]>([]);
  const [url, setUrl] = React.useState("");
  const [thumbnailFile, setThumbnailFile] = React.useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [existingAttachments, setExistingAttachments] = React.useState<PortfolioItem["attachments"]>([]);

  const preview = useFilePreview(files[0] ?? null);
  const thumbnailPreview = useFilePreview(thumbnailFile);

  React.useEffect(() => {
    if (!open) return;

    if (!item) {
      setTitle("");
      setStyle("");
      setMasterId(undefined);
      setMediaType("image");
      setFiles([]);
      setUrl("");
      setThumbnailFile(null);
      setThumbnailUrl("");
      setDescription("");
      setExistingAttachments([]);
      setIsSaving(false);
      return;
    }

    setTitle(item.title || "");
    setStyle(item.style || "");
    setMasterId(item.masterId || undefined);
    setMediaType((item.mediaType as "image" | "video") || "image");
    setFiles([]);
    setUrl(item.url || "");
    setThumbnailFile(null);
    setThumbnailUrl(item.thumbnail || "");
    setDescription(item.description || "");
    setIsSaving(false);

    const baseAttachment = {
      url: item.url,
      mediaType: item.mediaType ?? "image",
      thumbnail: item.thumbnail ?? null,
    };
    const attachments = (item.attachments?.length ? item.attachments : [baseAttachment]).filter(Boolean) as any[];
    setExistingAttachments(
      attachments.filter(
        (att, idx, arr) => idx === arr.findIndex((x) => x.url === att.url && (x.mediaType ?? "image") === (att.mediaType ?? "image")),
      ),
    );
  }, [item, open]);

  React.useEffect(() => {
    if (mediaType === "image") {
      setThumbnailFile(null);
      setThumbnailUrl("");
    }
  }, [mediaType]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length === 0) return;
    setFiles(selected);
    const first = selected[0];
    if (first.type.startsWith("video/")) {
      setMediaType("video");
    } else {
      setMediaType("image");
    }
  };

  const handleThumbnailSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setThumbnailFile(selected);
  };

  const sanitize = (value: string) => value.trim();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const finalTitle = sanitize(title) || "Работа";
    const finalDescription = sanitize(description);
    let finalUrl = sanitize(url);
    let finalThumbnail = sanitize(thumbnailUrl) || undefined;
    let finalMediaType: "image" | "video" = mediaType;

    if (!finalUrl && files.length === 0) {
      toast({
        title: "Нет файла",
        description: "Загрузите медиафайл или укажите ссылку",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const attachments: {
        url: string;
        mediaType: "image" | "video";
        thumbnail?: string | null;
      }[] = [...(existingAttachments || [])];

      if (files.length > 0) {
        for (const file of files) {
          const uploadResult = await api.uploadFile(file, {
            thumbnail: file.type.startsWith("video/") ? thumbnailFile ?? null : null,
          });
          attachments.push({
            url: uploadResult.url,
            mediaType: uploadResult.mediaType,
            thumbnail: uploadResult.thumbnail ?? null,
          });
        }
        finalUrl = attachments[0]?.url || finalUrl;
        finalMediaType = attachments[0]?.mediaType || finalMediaType;
        finalThumbnail = attachments[0]?.thumbnail ?? finalThumbnail;
      }

      if (finalUrl) {
        attachments.unshift({
          url: finalUrl,
          mediaType: finalMediaType,
          thumbnail: finalThumbnail ?? null,
        });
      }

      const uniqueAttachments = attachments.filter(
        (item, index, arr) => index === arr.findIndex((a) => a.url === item.url),
      );

      if (uniqueAttachments.length === 0) {
        throw new Error("Не удалось получить URL медиа");
      }

      if (item?.id) {
        await api.updatePortfolioItem(item.id, {
          url: uniqueAttachments[0].url,
          title: finalTitle,
          description: finalDescription,
          masterId,
          style: sanitize(style) || undefined,
          mediaType: uniqueAttachments[0].mediaType,
          thumbnail: uniqueAttachments[0].mediaType === "video" ? uniqueAttachments[0].thumbnail : undefined,
          attachments: uniqueAttachments,
        });
        toast({ title: "Сохранено", description: "Работа обновлена" });
      } else {
        await api.addPortfolioItem({
          url: uniqueAttachments[0].url,
          title: finalTitle,
          description: finalDescription,
          masterId,
          style: sanitize(style) || undefined,
          mediaType: uniqueAttachments[0].mediaType,
          thumbnail: uniqueAttachments[0].mediaType === "video" ? uniqueAttachments[0].thumbnail : undefined,
          attachments: uniqueAttachments,
        });
        toast({ title: "Готово", description: "Работа добавлена в портфолио" });
      }

      onSaved();
      onClose();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось сохранить работу",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="w-[98vw] max-w-4xl md:max-w-5xl max-h-[90vh] overflow-y-auto border-white/10 bg-[#12151d] text-white">
        <DialogHeader className="space-y-1">
          <DialogTitle>{item ? "Редактировать работу" : "Добавить работу"}</DialogTitle>
          <DialogDescription className="text-xs text-white/60">
            Загружайте изображения или видео, указывайте мастера и стиль — бот и сайт подхватят изменения автоматически.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Название</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например, Дракон на руке"
                className="border-white/10 bg-black/20 placeholder:text-white/40"
              />
            </div>

            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Расскажите детали, смысл или условия"
                className="border-white/10 bg-black/20 placeholder:text-white/40"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Медиа</Label>
              <Select value={mediaType} onValueChange={(value) => setMediaType(value as "image" | "video")}>
                <SelectTrigger className="border-white/10 bg-black/20 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1b1f27] text-white">
                  {MEDIA_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="flex items-center gap-2">
                      <div className="mr-2 inline-flex items-center justify-center rounded-full bg-white/10 p-1">
                        {option.icon}
                      </div>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {existingAttachments?.length ? (
            <div className="space-y-2">
              <Label>Текущие медиа</Label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {existingAttachments.map((media, idx) => (
                  <div
                    key={`${media.url}-${idx}`}
                    className="relative overflow-hidden rounded-lg border border-white/10 bg-white/5"
                  >
                    <img
                      src={(media.mediaType ?? "image") === "video" ? media.thumbnail || media.url : media.url}
                      alt="attachment"
                      className="h-28 w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/50 px-2 py-1 text-[11px] text-white/80">
                      <span>{(media.mediaType ?? "image") === "video" ? "Видео" : "Фото"}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-white/70 hover:bg-red-500/20 hover:text-red-200"
                        onClick={() =>
                          setExistingAttachments((prev) => prev.filter((_, inner) => inner !== idx))
                        }
                      >
                        <span className="text-lg leading-none">×</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* === Select мастер === */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Мастер</Label>
              <Select
                value={masterId ?? "none"}
                onValueChange={(val) => setMasterId(val === "none" ? undefined : val)}
              >
                <SelectTrigger className="border-white/10 bg-black/20 text-white">
                  <SelectValue placeholder="Без привязки" />
                </SelectTrigger>
                <SelectContent className="bg-[#1b1f27] text-white">
                  <SelectItem value="none">Без привязки</SelectItem>
                  {masters.map((master) => (
                    <SelectItem key={master.id} value={master.id}>
                      {master.nickname || master.name}
                      {!master.isActive ? " • скрыт" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Стиль / тег</Label>
            <Input
              list="portfolio-dialog-style"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="реализм, графика"
              className="border-white/10 bg-black/20 placeholder:text-white/40"
            />
            <datalist id="portfolio-dialog-style">
              {styleSuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div className="space-y-3">
            <Label>Файл или ссылка</Label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-black/20 text-sm text-white/60 hover:border-white/40">
                <Upload className="mb-2 h-5 w-5" />
                {files.length > 0 ? "Файлы выбраны" : "Выберите один или несколько файлов"}
                <Input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
                {files.length > 0 && (
                  <div className="mt-3 grid max-h-24 w-full grid-cols-1 gap-2 overflow-y-auto px-3 text-xs text-white sm:grid-cols-2">
                    {files.map((f) => (
                      <Badge
                        key={f.name}
                        variant="secondary"
                        className="flex max-w-full items-center justify-start truncate bg-white/10 text-white"
                        title={f.name}
                      >
                        {f.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </label>

              <div className="space-y-2">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http:// или /uploads/..."
                  className="border-white/10 bg-black/20 placeholder:text-white/40"
                />
                <p className="text-xs text-white/40">
                  Можно загрузить несколько файлов сразу или указать ссылку на готовое медиа.
                </p>
              </div>
            </div>

            {preview && (
              <div className="overflow-hidden rounded-xl border border-white/10">
                {mediaType === "video" ? (
                  <video src={preview} controls className="aspect-video w-full object-cover" />
                ) : (
                  <img src={preview} alt="Превью" className="aspect-video w-full object-cover" />
                )}
              </div>
            )}
          </div>

          {mediaType === "video" && (
            <div className="space-y-3">
              <Label>Обложка (для превью видео)</Label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-black/20 text-sm text-white/60 hover:border-white/40">
                  <Upload className="mb-2 h-5 w-5" />
                  {thumbnailFile ? "Файл выбран" : "Загрузить превью"}
                  <Input type="file" accept="image/*" className="hidden" onChange={handleThumbnailSelect} />
                  {thumbnailFile && (
                    <Badge variant="secondary" className="mt-2 max-w-[90%] truncate bg-white/10 text-xs text-white">
                      {thumbnailFile.name}
                    </Badge>
                  )}
                </label>

                <div className="space-y-2">
                  <Input
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="http:// или /uploads/..."
                    className="border-white/10 bg-black/20 placeholder:text-white/40"
                  />
                  <p className="text-xs text-white/40">Можно указать ссылку на готовый кадр</p>
                </div>
              </div>

              {thumbnailPreview && (
                <img src={thumbnailPreview} alt="Превью постера" className="h-32 w-full rounded-xl object-cover" />
              )}
            </div>
          )}

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSaving} className="inline-flex items-center gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Сохранить работу
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

