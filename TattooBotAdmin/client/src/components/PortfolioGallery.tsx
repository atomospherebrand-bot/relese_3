import React from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ImageIcon, Pencil, Trash2, Video } from "lucide-react";

type Item = {
  id: string;
  url: string;
  title: string;
  description?: string;
  mediaType?: "image" | "video";
  masterId?: string | null;
  masterName?: string | null;
  style?: string | null;
  thumbnail?: string | null;
  createdAt?: string | null;
  attachments?: { url: string; mediaType?: "image" | "video"; thumbnail?: string | null }[];
};

type Props = {
  items: Item[];
  onDelete: (id: string) => void;
  onEdit?: (item: Item) => void;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function PortfolioGallery({ items, onDelete, onEdit }: Props) {
  if (!items?.length) {
    return (
      <Card className="flex flex-col items-center justify-center gap-3 border-white/10 bg-black/20 py-10 text-center text-white/60">
        <ImageIcon className="h-8 w-8" />
        <p className="max-w-sm text-sm text-white/70">
          Здесь появятся загруженные работы. Добавьте первое изображение или видео, чтобы заполнить портфолио студии.
        </p>
      </Card>
    );
  }

  const handleDelete = (item: Item) => {
    if (confirm(`Удалить работу «${item.title}»?`)) {
      onDelete(item.id);
    }
  };

  return (
    <TooltipProvider>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const attachments =
            item.attachments?.length && item.attachments[0]
              ? item.attachments
              : [{ url: item.url, mediaType: item.mediaType, thumbnail: item.thumbnail }];
          const primary = attachments[0];
          const isVideo = (primary.mediaType ?? item.mediaType ?? "image") === "video";
          const cover = isVideo ? primary.thumbnail || primary.url : primary.url;
          return (
            <Card key={item.id} className="overflow-hidden border-white/10 bg-[#161a20] text-white">
              <div className="relative aspect-video overflow-hidden">
                {isVideo ? (
                  <video
                    src={primary.url}
                    poster={cover}
                    controls
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img src={primary.url} alt={item.title} className="h-full w-full object-cover" />
                )}

                <div className="absolute right-3 top-3 flex gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1 bg-black/60 text-xs font-medium uppercase text-white">
                    {isVideo ? <Video className="h-3 w-3" /> : <ImageIcon className="h-3 w-3" />}
                    {isVideo ? "Видео" : "Фото"}
                  </Badge>
                </div>
              </div>

              <CardContent className="space-y-3 p-4">
                <div>
                  <h3 className="text-base font-semibold leading-tight">{item.title}</h3>
                  {item.description && (
                    <p className="mt-1 line-clamp-3 text-sm text-white/70 whitespace-pre-line">{item.description}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
                    {item.masterName && <Badge variant="outline" className="border-white/20 bg-white/5 text-xs">{item.masterName}</Badge>}
                    {item.style && <Badge className="bg-white/10 text-xs text-white">#{item.style}</Badge>}
                    {attachments.length > 1 && (
                      <Badge variant="secondary" className="bg-white/10 text-white/80">
                        {attachments.length} медиа
                      </Badge>
                    )}
                  </div>
                </div>

                {attachments.length > 1 && (
                  <div className="grid grid-cols-3 gap-2 rounded-lg border border-white/5 bg-white/5 p-2">
                    {attachments.slice(0, 6).map((media, idx) => {
                      const thumb = (media.mediaType ?? "image") === "video" ? media.thumbnail || media.url : media.url;
                      return (
                        <div key={`${media.url}-${idx}`} className="aspect-square overflow-hidden rounded">
                          <img src={thumb} alt="attachment" className="h-full w-full object-cover" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex items-center justify-between border-t border-white/5 bg-black/10 px-4 py-3 text-xs text-white/60">
                <span>{formatDate(item.createdAt)}</span>
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(item)}
                          className="text-white/70 hover:bg-white/10"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Редактировать</TooltipContent>
                    </Tooltip>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item)}
                        className="text-white/70 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Удалить работу</TooltipContent>
                  </Tooltip>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
